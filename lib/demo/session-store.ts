// Types only: livekit-client itself is loaded inside connect(), so it stays out of first-load JS.
import type { Participant, Room, TrackPublication, TranscriptionSegment } from "livekit-client";
import { formatSeconds, median } from "@/lib/landing/math";
import { createAnalyser, levelOf } from "./audio";
import { DEMO_CONFIG, HISTORY, VOICE_THRESHOLD } from "./config";

/** idle → connecting → listening ⇄ speaking → idle; `preview` is mic-only (no token endpoint). */
export type SessionState = "idle" | "connecting" | "listening" | "speaking" | "preview";
export type Stats = { label: string; value: string; note: string };
export type Captions = { you: string; agent: string };

export type Snapshot = {
  state: SessionState;
  /** Status line under the orb button (errors, preview notice, session cap). */
  message: string;
  captions: Captions;
  stats: Stats;
  /** Median response time of this visitor's turns, in seconds; null until a turn was measured. */
  medianTurn: number | null;
};

/** A sample agent the visitor picked; `id` is the public slug the demo route maps to a Platform agent. */
export type DemoAgent = { id: string; name: string };

type SessionResponse = { url: string; token: string; sessionId?: string; endToken?: string; maxSeconds?: number };

export const MESSAGES = {
  blocked: "Microphone is blocked. Allow it in your browser to try the demo.",
  unreachable: "Could not reach the demo agent. Please try again in a moment.",
  rateLimited: "Too many demo sessions from your network. Please try again in a few minutes.",
  agentUnavailable: "This sample agent is not available for live demos yet.",
  preview: "Mic preview — the demo agent is not connected yet.",
  capped: "The demo session ended after 3 minutes.",
} as const;

const INITIAL_STATS: Stats = {
  label: "Response time",
  value: "—",
  note: "End of your speech → first agent audio, measured in your browser",
};

class DemoError extends Error {
  constructor(readonly kind: "rate" | "session" | "agent") {
    super(kind);
  }
}

/**
 * The one demo session on the page, shared by the hero orb and the signal band (never two connections).
 * React reads the low-rate `Snapshot` through useSyncExternalStore; the canvases and the orb read the
 * high-rate fields (analysers, history, turn timing) directly every frame.
 */
export class DemoSession {
  /* ---------- Live data read by the canvases ---------- */
  readonly histYou = new Float32Array(HISTORY);
  readonly histAgent = new Float32Array(HISTORY);
  micAnalyser: AnalyserNode | null = null;
  agentAnalyser: AnalyserNode | null = null;
  agentSpeaking = false;
  userTurnOpen = false;
  lastUserVoice = 0;
  /** Time the agent's reply arrived, for the bridge flash. */
  flashAt = -Infinity;

  private snap: Snapshot = { state: "idle", message: "", captions: { you: "", agent: "" }, stats: INITIAL_STATS, medianTurn: null };
  private subs = new Set<() => void>();
  private generation = 0;
  private audioCtx: AudioContext | null = null;
  private sources: AudioNode[] = [];
  private room: Room | null = null;
  private micStream: MediaStream | null = null;
  private micTrackSid: string | null = null;
  private agentAudioEl: HTMLMediaElement | null = null;
  private endInfo: { sessionId: string; endToken: string } | null = null;
  private agent: DemoAgent | null = null;
  private capTimer: ReturnType<typeof setTimeout> | undefined;
  private frame = 0;
  private lastSample = 0;
  private lastStat = 0;
  private lastAgentVoice = 0;
  private turns: number[] = [];

  constructor(private readonly config: { tokenEndpoint: string; agentId: string; maxSessionSeconds: number } = DEMO_CONFIG) {}

  get hasAgent() {
    return Boolean(this.config.tokenEndpoint);
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  };

  getSnapshot = () => this.snap;

  isLive() {
    const s = this.snap.state;
    return s === "listening" || s === "speaking" || s === "preview";
  }

  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.subs.forEach((fn) => fn());
  }

  private setCaption(who: keyof Captions, text: string) {
    if (this.snap.captions[who] === text) return;
    this.set({ captions: { ...this.snap.captions, [who]: text } });
  }

  /** Agent gallery: end any running session and talk to `agent` instead. */
  talkTo = (agent: DemoAgent) => {
    if (this.snap.state !== "idle") this.stop();
    this.start(agent);
  };

  toggle = () => {
    if (this.snap.state === "idle") this.start();
    else this.stop();
  };

  /**
   * Must be called from a click handler: the AudioContext is created/resumed inside the gesture (iOS).
   * `agent` picks a sample agent (agent gallery); the default is DEMO_CONFIG.agentId.
   */
  start = (agent?: DemoAgent) => {
    if (this.snap.state !== "idle") return;
    const gen = ++this.generation;
    this.agent = agent ?? null;
    this.primeAudio();
    this.set({ state: "connecting", message: "" });
    this.connect(gen).catch((err: unknown) => {
      if (gen !== this.generation) return;
      const name = (err as { name?: string } | null)?.name;
      const message = name === "NotAllowedError" || name === "SecurityError"
        ? MESSAGES.blocked
        : err instanceof DemoError && err.kind === "rate" ? MESSAGES.rateLimited
        : err instanceof DemoError && err.kind === "agent" ? MESSAGES.agentUnavailable : MESSAGES.unreachable;
      this.stop(message);
    });
  };

  /** Disconnects, releases the mic and tells the backend the session is over. */
  stop = (message = "") => {
    this.generation++;
    clearTimeout(this.capTimer);
    cancelAnimationFrame(this.frame);
    const room = this.room;
    this.room = null;
    void room?.disconnect();
    this.endBackendSession();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.agentAudioEl?.remove();
    this.agentAudioEl = null;
    this.sources.forEach((n) => n.disconnect());
    this.sources = [];
    this.micAnalyser = null;
    this.agentAnalyser = null;
    this.micTrackSid = null;
    this.agentSpeaking = false;
    this.userTurnOpen = false;
    this.histYou.fill(0);
    this.histAgent.fill(0);
    if (this.snap.state === "idle" && !message) return;
    this.set({
      state: "idle",
      message,
      captions: { you: "", agent: "" },
      // Keep the last measured result on screen after the session ends; otherwise reset.
      stats: this.turns.length ? this.snap.stats : INITIAL_STATS,
    });
  };

  private primeAudio() {
    if (!this.audioCtx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.audioCtx = new Ctor();
    }
    if (this.audioCtx.state === "suspended") void this.audioCtx.resume().catch(() => undefined);
  }

  private analyse(track: MediaStreamTrack) {
    if (!this.audioCtx) return null;
    const an = createAnalyser(this.audioCtx, new MediaStream([track]));
    this.sources.push(an);
    return an;
  }

  private async connect(gen: number) {
    if (!navigator.mediaDevices?.getUserMedia) {
      // Insecure context (getUserMedia needs https:// or http://localhost).
      throw Object.assign(new Error("insecure context"), { name: "SecurityError" });
    }
    if (!this.hasAgent) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (gen !== this.generation) { stream.getTracks().forEach((t) => t.stop()); return; }
      this.micStream = stream;
      this.micAnalyser = this.analyse(stream.getAudioTracks()[0]);
      this.goLive("preview", MESSAGES.preview, this.config.maxSessionSeconds);
      return;
    }

    let res: Response;
    try {
      res = await fetch(this.config.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: this.agent?.id ?? this.config.agentId }),
      });
    } catch {
      throw new DemoError("session");
    }
    if (res.status === 429) throw new DemoError("rate");
    if (res.status === 404) throw new DemoError("agent");
    if (!res.ok) throw new DemoError("session");
    const data = (await res.json()) as SessionResponse;
    if (data.sessionId && data.endToken) this.endInfo = { sessionId: data.sessionId, endToken: data.endToken };
    if (gen !== this.generation) { this.endBackendSession(); return; }

    const { Room, RoomEvent, Track } = await import("livekit-client");
    if (gen !== this.generation) { this.endBackendSession(); return; }
    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    const local = () => room.localParticipant;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== "audio" || this.room !== room) return;
      const el = track.attach();
      el.style.display = "none";
      document.body.appendChild(el);
      this.agentAudioEl = el;
      this.agentAnalyser = this.analyse(track.mediaStreamTrack);
    });
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      if (this.room !== room) return;
      this.agentSpeaking = speakers.some((p) => p !== local());
      const s = this.snap.state;
      if (s === "listening" || s === "speaking") this.set({ state: this.agentSpeaking ? "speaking" : "listening" });
    });
    // Only a live session ends here. While connecting, a failed connect rejects connect() instead,
    // which shows the error message.
    room.on(RoomEvent.Disconnected, () => {
      if (this.room === room && this.isLive()) this.stop();
    });

    // Live captions, when the agent publishes LiveKit transcriptions. User transcripts may come from the
    // agent's identity but carry the user's mic track id, so check both.
    const isYou = (identity?: string, trackId?: string) => identity === local().identity || (!!trackId && trackId === this.micTrackSid);
    room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant?: Participant, publication?: TrackPublication) => {
      if (this.room !== room) return;
      const text = segments.map((s) => s.text).join(" ").trim();
      if (text) this.setCaption(isYou(participant?.identity, publication?.trackSid) ? "you" : "agent", text);
    });
    room.registerTextStreamHandler("lk.transcription", async (reader, info) => {
      const who = isYou(info.identity, reader.info.attributes?.["lk.transcribed_track_id"]) ? "you" : "agent";
      let text = "";
      for await (const chunk of reader) {
        if (this.room !== room) return;
        text += chunk;
        if (text.trim()) this.setCaption(who, text.trim());
      }
    });

    await room.connect(data.url, data.token);
    if (gen !== this.generation) { void room.disconnect(); return; }
    await room.localParticipant.setMicrophoneEnabled(true, { echoCancellation: true, noiseSuppression: true });
    if (gen !== this.generation) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (pub?.track) {
      this.micTrackSid = pub.trackSid;
      this.micAnalyser = this.analyse(pub.track.mediaStreamTrack);
    }
    const cap = Math.min(this.config.maxSessionSeconds, data.maxSeconds ?? Infinity);
    this.goLive("listening", this.agent ? `Talking to ${this.agent.name}.` : "", cap);
  }

  private goLive(state: SessionState, message: string, capSeconds: number) {
    this.set({ state, message });
    this.capTimer = setTimeout(() => this.stop(MESSAGES.capped), capSeconds * 1000);
    const loop = (now: number) => {
      this.tick(now);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  /** Best effort: frees the Platform session now instead of waiting for the agent to time out. */
  private endBackendSession() {
    const info = this.endInfo;
    this.endInfo = null;
    if (!info) return;
    void fetch(`${this.config.tokenEndpoint}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(info),
      keepalive: true,
    }).catch(() => undefined);
  }

  /* ---------- Live levels, history and turn timing (once per frame while live) ---------- */
  tick(now: number) {
    if (!this.isLive()) return;
    const micL = levelOf(this.micAnalyser);
    const agentL = levelOf(this.agentAnalyser);
    if (now - this.lastSample > 40) {
      this.lastSample = now;
      this.histYou.copyWithin(0, 1); this.histYou[HISTORY - 1] = micL;
      this.histAgent.copyWithin(0, 1); this.histAgent[HISTORY - 1] = agentL;
    }
    if (micL > VOICE_THRESHOLD && agentL < VOICE_THRESHOLD) { this.lastUserVoice = now; this.userTurnOpen = true; }
    let medianTurn = this.snap.medianTurn;
    if (agentL > VOICE_THRESHOLD) {
      // The agent started answering after the user went quiet (not while the agent was already talking).
      if (this.userTurnOpen && this.lastAgentVoice < this.lastUserVoice && now - this.lastUserVoice > 120) {
        this.turns.push((now - this.lastUserVoice) / 1000);
        if (this.turns.length > 8) this.turns.shift();
        this.flashAt = now;
        medianTurn = median(this.turns);
      }
      this.userTurnOpen = false;
      this.lastAgentVoice = now;
    }
    if (now - this.lastStat <= 100 && medianTurn === this.snap.medianTurn) return;
    this.lastStat = now;
    const stats = this.statsAt(now, micL);
    const prev = this.snap.stats;
    if (medianTurn !== this.snap.medianTurn || stats.label !== prev.label || stats.value !== prev.value || stats.note !== prev.note) {
      this.set({ stats, medianTurn });
    }
  }

  /** The bridge is "waiting" between the end of the user's speech and the agent's first audio. */
  isWaiting(now: number) {
    return this.snap.state !== "preview" && this.userTurnOpen && now - this.lastUserVoice > 250;
  }

  private statsAt(now: number, micL: number): Stats {
    if (this.snap.state === "preview") {
      return { label: "Mic preview", value: micL > VOICE_THRESHOLD ? "Hearing you" : "Say something", note: "Connect the demo agent to measure real response time" };
    }
    if (this.isWaiting(now)) {
      return { label: "Responding…", value: formatSeconds((now - this.lastUserVoice) / 1000), note: "Timing from the end of your speech" };
    }
    const n = this.turns.length;
    if (n) {
      return {
        label: "Last response",
        value: `${formatSeconds(this.turns[n - 1])}  ·  median ${formatSeconds(median(this.turns))}`,
        note: `${n}${n === 1 ? " turn" : " turns"} · end of your speech → first agent audio, measured in your browser`,
      };
    }
    return { label: "Response time", value: "Listening", note: "Ask it anything — in English, Russian, or both" };
  }
}
