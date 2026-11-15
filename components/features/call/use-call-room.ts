"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
// Types only: the module itself is loaded inside connect() so it stays out of first-load JS on the
// setup and lobby screens (performance review finding 2).
import type {
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  TrackPublication,
} from "livekit-client";
import {
  callReducer,
  classifyParticipant,
  initialCallState,
  normalizeQuality,
  PEER_GRACE_MS,
  TRANSLATING_TIMEOUT_MS,
  type EndReason,
  type Seat,
} from "@/lib/call-state";
import { endCall as endCallSession, type ListenConnection } from "@/lib/platform";
import { LatencyRecorder, VoicedOnsetDetector, latencyDiagnosticsEnabled } from "@/lib/audio-latency";
import { createLevelSampler, LevelStore, type LevelSampler } from "./level-store";

/**
 * LiveKit side of a two-person interpreter call. Deliberately separate from the agent playground
 * (`app/(dashboard)/agents/[id]/test/page.tsx`), whose lifecycle and end-on-drop rule stay untouched.
 *
 * Differences from the playground, by design (UX spec §4.4, product decision 3):
 * - An unexpected disconnect never calls `/end` (that would end the call for the other person).
 *   The UI offers Rejoin while the LiveKit token is still valid.
 * - When the other person drops, they show as "Reconnecting…" for PEER_GRACE_MS, then the call ends.
 * - "End call" ends it for both people (the backend has no leave-without-end).
 * - Unmounting disconnects but sends nothing, like closing the tab.
 *
 * Web Audio: browsers (Safari/iOS especially) keep an AudioContext suspended unless it is created or
 * resumed inside a user gesture. Call `primeAudio()` synchronously in the Start/Join click handler.
 * Until the context is actually running, no analyser is used: the local meter falls back to LiveKit's
 * speaker level and the bridge shows no hearing direction ("Interpreter speaking"), never a guess.
 */

/** Starts downloading livekit-client early (e.g. once the mic check passes), without blocking. */
export function preloadLiveKit() {
  void import("livekit-client").catch(() => undefined);
}

export type CallCredentials = {
  url: string;
  token: string;
  sessionId: string;
  /** Session-scoped Bearer token (creator or guest). */
  sessionToken?: string | null;
  /**
   * Private listening: where this person's translation arrives (a second, subscribe-only room). The session-room
   * token cannot subscribe to anything, so without this the browser would receive no translated audio at all.
   */
  listen?: ListenConnection;
  /** Unix seconds after which `token` no longer works (LiveKit TTL is 10 minutes). */
  tokenExpiresAt: number;
  micDeviceId?: string;
};

// livekit DisconnectReason values (protocol enum). Compared numerically so tests can mock the module.
const DUPLICATE_IDENTITY = 2;
const PARTICIPANT_REMOVED = 4;
const ROOM_DELETED = 5;

function safeStorage(): Pick<Storage, "getItem"> | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined; // blocked storage throws on access
  }
}

const AUDIO_ATTRIBUTE = "voiceLabsAudio"; // data-voice-labs-audio (shared with the playground's cleanup)

export function useCallRoom(options: { otherName?: string } = {}) {
  const [state, dispatch] = useReducer(callReducer, initialCallState);
  const levels = useMemo(() => new LevelStore(), []);
  const roomRef = useRef<Room | null>(null);
  /** The private listen room (subscribe-only) that carries this person's translation. */
  const listenRoomRef = useRef<Room | null>(null);
  /** Opt-in browser-side audio timing (lib/audio-latency.ts): a disabled recorder is a no-op. */
  const latencyRef = useRef<LatencyRecorder>(new LatencyRecorder({ enabled: false }));
  const diagSampler = useRef<LevelSampler | null>(null);
  /** Starts the diagnostics tap on the current translation track (set by connect; used after "turn on sound"). */
  const startDiagRef = useRef<(() => void) | null>(null);
  const diagTimers = useRef<number[]>([]);
  const otherIdentityRef = useRef<string | null>(null);
  const credentialsRef = useRef<CallCredentials | null>(null);
  const mountedRef = useRef(true);
  const intentionalRef = useRef(false);
  const endingRef = useRef(false);
  /** Set once End (or a remote end) was requested, so a connect that resolves late is not an error. */
  const endRequestedRef = useRef(false);
  const audioElements = useRef(new Set<HTMLMediaElement>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const localSampler = useRef<LevelSampler | null>(null);
  const translationSampler = useRef<LevelSampler | null>(null);
  const hearingRef = useRef<boolean | null>(null);
  /** The subscribed translation track (ours), so a sampler can be created once audio is running. */
  const translationTrack = useRef<MediaStreamTrack | null>(null);
  const graceTimer = useRef<number | undefined>(undefined);
  const volumeRef = useRef(1);
  const otherNameRef = useRef(options.otherName);
  otherNameRef.current = options.otherName;

  const safeDispatch = useCallback((action: Parameters<typeof dispatch>[0]) => {
    if (mountedRef.current) dispatch(action);
  }, []);

  /**
   * Creates or resumes the AudioContext. Must run synchronously inside a user gesture (Start call /
   * Join call / Tap to turn on sound), which is the only reliable way to get a running context on iOS.
   */
  const primeAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const Ctor = typeof window !== "undefined"
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
      if (!Ctor) return;
      try {
        audioContextRef.current = new Ctor();
      } catch {
        return;
      }
    }
    if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume().catch(() => undefined);
  }, []);

  /** The AudioContext only when it is really running; otherwise null (no analyser, no direction). */
  const liveContext = useCallback(() => {
    const context = audioContextRef.current;
    return context && context.state === "running" ? context : null;
  }, []);

  const clearGrace = useCallback(() => {
    if (graceTimer.current !== undefined) window.clearTimeout(graceTimer.current);
    graceTimer.current = undefined;
  }, []);

  const disposeTranslationSampler = useCallback(() => {
    translationSampler.current?.dispose();
    translationSampler.current = null;
    translationTrack.current = null;
  }, []);

  const stopDiagnostics = useCallback(() => {
    startDiagRef.current = null;
    diagSampler.current?.dispose();
    diagSampler.current = null;
    diagTimers.current.forEach((timer) => window.clearInterval(timer));
    diagTimers.current = [];
  }, []);

  const removeAudio = useCallback(() => {
    stopDiagnostics();
    audioElements.current.forEach((element) => element.remove());
    audioElements.current.clear();
    localSampler.current?.dispose();
    localSampler.current = null;
    disposeTranslationSampler();
    levels.reset();
  }, [levels, disposeTranslationSampler, stopDiagnostics]);

  const teardownListen = useCallback(async () => {
    const listenRoom = listenRoomRef.current;
    listenRoomRef.current = null;
    if (!listenRoom) return;
    try {
      await listenRoom.disconnect();
    } catch {
      // Already gone.
    }
    listenRoom.removeAllListeners?.();
  }, []);

  const teardownRoom = useCallback(async (room: Room | null) => {
    intentionalRef.current = true;
    if (roomRef.current === room) roomRef.current = null;
    try {
      await room?.disconnect();
    } catch {
      // Already gone.
    }
    room?.removeAllListeners?.();
    await teardownListen();
    removeAudio();
  }, [removeAudio, teardownListen]);

  const endSession = useCallback(async (reason: EndReason) => {
    const credentials = credentialsRef.current;
    if (endingRef.current) return;
    endingRef.current = true;
    endRequestedRef.current = true;
    clearGrace();
    safeDispatch({ type: "ending" });
    await teardownRoom(roomRef.current);
    if (!credentials) {
      endingRef.current = false;
      safeDispatch({ type: "ended", reason });
      return;
    }
    try {
      await endCallSession(credentials.sessionId, credentials.sessionToken);
      safeDispatch({ type: "ended", reason });
    } catch (cause) {
      // Keep the session id so "Retry end call" can try again (same rule as the playground).
      safeDispatch({ type: "end-failed", message: cause instanceof Error ? cause.message : "Could not end the call." });
    } finally {
      endingRef.current = false;
    }
  }, [clearGrace, safeDispatch, teardownRoom]);

  /** Called when polling or the server says the call is over: disconnect, send nothing. */
  const markEnded = useCallback((reason: EndReason) => {
    endRequestedRef.current = true;
    clearGrace();
    void teardownRoom(roomRef.current);
    safeDispatch({ type: "ended", reason });
  }, [clearGrace, safeDispatch, teardownRoom]);

  const connect = useCallback(async (credentials: CallCredentials) => {
    credentialsRef.current = credentials;
    intentionalRef.current = false;
    endRequestedRef.current = false;
    await teardownListen(); // a rejoin starts from nothing: no second translation track on top of the old one
    otherIdentityRef.current = null;
    const recorder = new LatencyRecorder({
      enabled: typeof window !== "undefined" && latencyDiagnosticsEnabled(window.location.search, safeStorage()),
    });
    latencyRef.current = recorder;
    if (recorder.enabled) {
      (window as unknown as { __voiceLabsLatency?: unknown }).__voiceLabsLatency = {
        export: () => recorder.export(),
        events: () => recorder.snapshot(),
      };
    }
    safeDispatch({ type: "connect" });
    if (!credentials.url || !credentials.token) {
      safeDispatch({ type: "connect-failed", message: "Calls aren’t set up on this server yet." });
      return false;
    }
    let livekit: typeof import("livekit-client");
    try {
      livekit = await import("livekit-client");
    } catch {
      safeDispatch({ type: "connect-failed", message: "Couldn’t load the call audio. Check your connection and try again." });
      return false;
    }
    if (!mountedRef.current) return false;
    const { Room, RoomEvent, Track } = livekit;
    const room = new Room({
      audioCaptureDefaults: {
        deviceId: credentials.micDeviceId,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    roomRef.current = room;
    const isCurrent = () => mountedRef.current && roomRef.current === room;

    const seatOf = (participant: Participant) =>
      classifyParticipant({ identity: participant.identity, isAgent: participant.isAgent, isLocal: participant.identity === room.localParticipant?.identity });

    const setHearing = (hearing: boolean | null) => {
      if (hearing === hearingRef.current) return;
      hearingRef.current = hearing;
      safeDispatch({ type: "hearing", hearing });
    };

    /** Builds the analyser on our translation track, but only on a running AudioContext. */
    const ensureTranslationSampler = () => {
      if (translationSampler.current || !translationTrack.current) return translationSampler.current;
      const context = liveContext();
      if (!context) return null;
      translationSampler.current = createLevelSampler(translationTrack.current, context, (level) => {
        levels.set("interp", level);
        // A context that got suspended again reads silence: report "unknown", never a direction.
        if (context.state !== "running") { setHearing(null); return; }
        if (level > 0.04) setHearing(true);
        else if (level === 0) setHearing(false); // end of the silent tail: the translation went to them
      }, { tailMs: 900 });
      return translationSampler.current;
    };

    const joined = (participant: RemoteParticipant) => {
      const seat = seatOf(participant);
      if (seat === "self") return;
      if (seat === "other") {
        clearGrace();
        otherIdentityRef.current = participant.identity;
      }
      const micPublication = participant.getTrackPublication?.(Track.Source.Microphone);
      safeDispatch({ type: "participant-joined", seat, identity: participant.identity, muted: micPublication?.isMuted });
    };

    /** Diagnostics only: a continuous tap on the track we play, never on our own microphone. */
    const ensureDiagSampler = (track: MediaStreamTrack) => {
      const recorder = latencyRef.current;
      if (!recorder.enabled || diagSampler.current) return;
      const context = liveContext();
      if (!context) {
        recorder.record("analyser_unavailable", { detail: { reason: "audio_context_not_running" } });
        return;
      }
      const detector = new VoicedOnsetDetector();
      const sampler = createLevelSampler(
        track,
        context,
        (level) => {
          const change = detector.feed(level, performance.now());
          if (change) recorder.record(change.type === "onset" ? "browser_first_voiced_audio" : "browser_voiced_audio_ended", { seq: change.seq, at: change.at });
        },
        { intervalMs: 20, tailMs: Number.POSITIVE_INFINITY },
      );
      if (!sampler) {
        recorder.record("analyser_unavailable", { detail: { reason: "web_audio_missing" } });
        return;
      }
      diagSampler.current = sampler;
      sampler.start();
    };

    /** Diagnostics only: RTP arrival and concealed samples (packet loss / underrun) of the translated track. */
    const watchReceiver = (track: RemoteTrack) => {
      const recorder = latencyRef.current;
      const receiver = track as unknown as { getReceiverStats?: () => Promise<Record<string, unknown> | undefined> };
      if (!recorder.enabled) return;
      if (typeof receiver.getReceiverStats !== "function") {
        recorder.record("receiver_stats_unavailable", { detail: { reason: "not_supported" } });
        return;
      }
      let seen = false;
      let concealed = 0;
      let polls = 0;
      let reportedMissing = false;
      const timer = window.setInterval(() => {
        polls += 1;
        void receiver.getReceiverStats?.().then((stats) => {
          // livekit-client's audio receiver stats carry bytesReceived (not packetsReceived).
          const bytes = Number(stats?.bytesReceived ?? 0);
          if (!seen && bytes > 0) {
            seen = true;
            recorder.record("first_rtp_audio_received", { detail: { bytes } });
          } else if (!seen && polls >= 12 && !reportedMissing) {
            reportedMissing = true; // honest "could not measure", with which fields the browser gave
            recorder.record("receiver_stats_unavailable", { detail: { reason: stats ? "no_bytes_counted" : "no_stats", fields: stats ? Object.keys(stats).slice(0, 12).join(",") : null } });
          }
          const now = Number(stats?.concealedSamples ?? 0);
          if (seen && now > concealed) recorder.record("audio_concealment", { detail: { added_samples: now - concealed } });
          concealed = now;
        }).catch(() => undefined);
      }, 250);
      diagTimers.current.push(timer);
    };

    startDiagRef.current = () => {
      if (translationTrack.current) ensureDiagSampler(translationTrack.current);
    };

    /** Our translation arrived: attach it for playback (unchanged) and, when asked to, time it. */
    const onAudioTrack = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant, viaListenRoom: boolean) => {
      if (!isCurrent()) {
        track.detach().forEach((element) => element.remove());
        return;
      }
      if (track.kind !== Track.Kind.Audio) return;
      const element = track.attach();
      element.autoplay = true;
      element.setAttribute("playsinline", "true");
      element.dataset[AUDIO_ATTRIBUTE] = "true";
      element.dataset.voiceLabsCall = "true";
      element.volume = volumeRef.current;
      document.body.appendChild(element);
      audioElements.current.add(element);
      const isTranslation = viaListenRoom || seatOf(participant) === "interpreter" || publication.trackName?.startsWith("translation-for-");
      const recorder = latencyRef.current;
      if (recorder.enabled && isTranslation) {
        recorder.context = { listener: room.localParticipant?.identity ?? null, speaker: otherIdentityRef.current, track: publication.trackName ?? null };
        recorder.record("translated_track_subscribed", { detail: { via: viaListenRoom ? "listen_room" : "session_room" } });
        element.addEventListener("playing", () => recorder.record("playback_started"));
        element.addEventListener("waiting", () => recorder.record("element_waiting"));
        element.addEventListener("stalled", () => recorder.record("element_stalled"));
        element.addEventListener("error", () => recorder.record("element_error", { detail: { code: element.error?.code ?? null } }));
      }
      const played = (() => {
        try {
          return element.play();
        } catch {
          return Promise.reject(new Error("play failed"));
        }
      })();
      void Promise.resolve(played).then(() => safeDispatch({ type: "sound-blocked", blocked: false })).catch((cause: unknown) => {
        if (recorder.enabled && isTranslation) recorder.record("playback_failed", { detail: { reason: cause instanceof Error ? cause.name : "unknown" } });
        if (element.isConnected) safeDispatch({ type: "sound-blocked", blocked: true });
      });
      // Our translation: the Runtime publishes `translation-for-<our identity>` (only we may subscribe).
      if (isTranslation) {
        disposeTranslationSampler();
        translationTrack.current = track.mediaStreamTrack;
        setHearing(null);
        if (recorder.enabled) {
          watchReceiver(track);
          ensureDiagSampler(track.mediaStreamTrack);
        }
      }
    };
    const onAudioTrackGone = (track: RemoteTrack) => {
      if (track.mediaStreamTrack && track.mediaStreamTrack === translationTrack.current) disposeTranslationSampler();
      latencyRef.current.record("translated_track_unsubscribed");
      track.detach().forEach((element) => {
        audioElements.current.delete(element);
        element.remove();
      });
    };
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => onAudioTrack(track, publication, participant, false));
    room.on(RoomEvent.TrackUnsubscribed, onAudioTrackGone);
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (isCurrent()) joined(participant);
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (!isCurrent()) return;
      const seat = seatOf(participant);
      if (seat === "self") return;
      safeDispatch({ type: "participant-left", seat });
      if (seat === "other") {
        clearGrace();
        graceTimer.current = window.setTimeout(() => {
          graceTimer.current = undefined;
          if (!mountedRef.current) return;
          safeDispatch({ type: "peer-gone" });
          void endSession("peer-lost");
        }, PEER_GRACE_MS);
      }
    });
    let wasInterpreterSpeaking = false;
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      if (!isCurrent()) return;
      let self = false;
      let other = false;
      let interpreter = false;
      let otherLevel = 0;
      let selfLevel = 0;
      for (const speaker of speakers) {
        const seat = seatOf(speaker);
        if (seat === "self") { self = true; selfLevel = speaker.audioLevel ?? 0; }
        else if (seat === "other") { other = true; otherLevel = Math.max(otherLevel, speaker.audioLevel ?? 0); }
        else { interpreter = true; }
      }
      levels.set("other", otherLevel);
      if (self) {
        if (!localSampler.current) {
          const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
          const context = liveContext();
          if (micTrack && context) localSampler.current = createLevelSampler(micTrack, context, (level) => levels.set("self", level));
        }
        if (localSampler.current) localSampler.current.start();
        else levels.set("self", selfLevel);
      } else if (!localSampler.current) {
        levels.set("self", 0);
      }
      if (interpreter) {
        // A new interpreter turn starts with no direction until our own track has been measured.
        if (!wasInterpreterSpeaking) hearingRef.current = null;
        ensureTranslationSampler()?.start();
      } else if (!translationSampler.current?.running) {
        levels.set("interp", 0);
      }
      wasInterpreterSpeaking = interpreter;
      safeDispatch({ type: "speakers", self, other, interpreter, at: Date.now() });
    });
    const onMute = (muted: boolean) => (publication: TrackPublication, participant: Participant) => {
      if (!isCurrent() || publication.source !== Track.Source.Microphone) return;
      const seat = seatOf(participant);
      if (seat === "self" || seat === "other") safeDispatch({ type: "muted", seat, muted });
    };
    room.on(RoomEvent.TrackMuted, onMute(true));
    room.on(RoomEvent.TrackUnmuted, onMute(false));
    room.on(RoomEvent.ConnectionQualityChanged, (quality: unknown, participant: Participant) => {
      if (!isCurrent()) return;
      const seat = seatOf(participant);
      if (seat === "self" || seat === "other") safeDispatch({ type: "quality", seat, quality: normalizeQuality(quality) });
    });
    room.on(RoomEvent.Reconnecting, () => { if (isCurrent()) safeDispatch({ type: "reconnecting" }); });
    room.on(RoomEvent.SignalReconnecting, () => { if (isCurrent()) safeDispatch({ type: "reconnecting" }); });
    room.on(RoomEvent.Reconnected, () => { if (isCurrent()) safeDispatch({ type: "reconnected" }); });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (isCurrent()) safeDispatch({ type: "sound-blocked", blocked: !room.canPlaybackAudio });
    });
    room.on(RoomEvent.Disconnected, (reason?: number) => {
      // A superseded room (an earlier connect) must not tear down the current one.
      if (roomRef.current !== null && roomRef.current !== room) return;
      roomRef.current = null;
      removeAudio();
      if (!mountedRef.current || intentionalRef.current) return;
      // Never POST /end here: that would end the call for the other person too.
      if (reason === ROOM_DELETED) {
        safeDispatch({ type: "ended", reason: "remote" });
        return;
      }
      safeDispatch({
        type: "disconnected",
        message: reason === PARTICIPANT_REMOVED ? "You were removed from the call." : "You were disconnected.",
        inUseElsewhere: reason === DUPLICATE_IDENTITY,
      });
    });

    // Private listening: the translation arrives in a second, subscribe-only room, joined alongside the session room.
    let listenRoom: Room | null = null;
    if (credentials.listen?.token) {
      const listen = credentials.listen;
      listenRoom = new Room();
      listenRoomRef.current = listenRoom;
      listenRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => onAudioTrack(track, publication, participant, true));
      listenRoom.on(RoomEvent.TrackUnsubscribed, onAudioTrackGone);
      listenRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!isCurrent()) return;
        const allowed = Boolean(room.canPlaybackAudio && listenRoom?.canPlaybackAudio);
        latencyRef.current.record(allowed ? "playback_allowed" : "playback_blocked");
        safeDispatch({ type: "sound-blocked", blocked: !allowed });
      });
      listenRoom.on(RoomEvent.Reconnecting, () => latencyRef.current.record("listener_reconnecting"));
      listenRoom.on(RoomEvent.Reconnected, () => latencyRef.current.record("listener_reconnected"));
      listenRoom.on(RoomEvent.Disconnected, (reason?: number) => {
        latencyRef.current.record("listener_disconnected", { detail: { reason: reason ?? null } });
        // Losing the listen room means no translated audio, even though the session room is fine.
        if (!mountedRef.current || intentionalRef.current || listenRoomRef.current !== listenRoom) return;
        safeDispatch({ type: "disconnected", message: "You lost the translation audio.", inUseElsewhere: reason === DUPLICATE_IDENTITY });
      });
    }
    try {
      await Promise.all([
        room.connect(credentials.url, credentials.token),
        listenRoom && credentials.listen
          ? listenRoom.connect(credentials.listen.url, credentials.listen.token).then(() => latencyRef.current.record("listener_room_connected"))
          : Promise.resolve(),
      ]).catch((cause: unknown) => {
        if (listenRoom) latencyRef.current.record("listener_connect_failed", { detail: { reason: cause instanceof Error ? cause.name : "unknown" } });
        throw cause;
      });
      if (!isCurrent()) {
        await room.disconnect().catch(() => undefined);
        await teardownListen();
        return false;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      if (!isCurrent()) return false;
      safeDispatch({ type: "connected", at: Date.now() });
      room.remoteParticipants?.forEach((participant) => joined(participant));
      return true;
    } catch (cause) {
      intentionalRef.current = true;
      if (roomRef.current === room) roomRef.current = null;
      await room.disconnect().catch(() => undefined);
      await teardownListen();
      removeAudio();
      intentionalRef.current = false;
      const message = cause instanceof Error && /token|expired|unauthori[sz]ed|401/i.test(cause.message)
        ? "This invite has expired."
        : "Couldn’t connect the call audio. Check your connection and try again.";
      safeDispatch({ type: "connect-failed", message });
      return false;
    }
  }, [clearGrace, disposeTranslationSampler, endSession, levels, liveContext, removeAudio, safeDispatch, teardownListen]);

  // Inferred "Translating" never outlives its timeout (UX spec §5.3).
  useEffect(() => {
    const since = state.translating?.since;
    if (since === undefined) return;
    const timer = window.setTimeout(() => dispatch({ type: "translating-timeout", since }), TRANSLATING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [state.translating?.since]);

  useEffect(() => {
    mountedRef.current = true;
    const elements = audioElements.current;
    return () => {
      mountedRef.current = false;
      intentionalRef.current = true;
      if (graceTimer.current !== undefined) window.clearTimeout(graceTimer.current);
      const room = roomRef.current;
      roomRef.current = null;
      if (room) void room.disconnect().catch(() => undefined);
      const listenRoom = listenRoomRef.current;
      listenRoomRef.current = null;
      if (listenRoom) void listenRoom.disconnect().catch(() => undefined);
      stopDiagnostics();
      elements.forEach((element) => element.remove());
      elements.clear();
      localSampler.current?.dispose();
      translationSampler.current?.dispose();
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      // Like closing the tab: no /end is sent on unmount (UX spec §4.4).
    };
  }, []);

  const setMuted = useCallback(async (muted: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!muted);
      if (muted) {
        localSampler.current?.stop();
        levels.set("self", 0);
      }
      safeDispatch({ type: "muted", seat: "self", muted });
    } catch {
      // Device busy or permission revoked; keep the old state.
    }
  }, [levels, safeDispatch]);

  const startAudio = useCallback(async () => {
    const room = roomRef.current;
    primeAudio(); // this runs in the "Tap to turn on sound" click
    try {
      await room?.startAudio();
      await listenRoomRef.current?.startAudio();
      await Promise.all([...audioElements.current].map((element) => element.play().catch(() => undefined)));
      await audioContextRef.current?.resume().catch(() => undefined);
      const listenRoom = listenRoomRef.current;
      safeDispatch({ type: "sound-blocked", blocked: room ? !(room.canPlaybackAudio && (listenRoom ? listenRoom.canPlaybackAudio : true)) : false });
      // A diagnostics tap that could not start because the audio context was suspended starts now.
      startDiagRef.current?.();
    } catch {
      safeDispatch({ type: "sound-blocked", blocked: true });
    }
  }, [primeAudio, safeDispatch]);

  const rejoin = useCallback(async () => {
    const credentials = credentialsRef.current;
    if (!credentials || Date.now() / 1000 >= credentials.tokenExpiresAt) return false;
    primeAudio(); // Rejoin is a click
    return connect(credentials);
  }, [connect, primeAudio]);

  const switchDevice = useCallback(async (kind: "audioinput" | "audiooutput", deviceId: string) => {
    const room = roomRef.current;
    if (!room) return false;
    try {
      const switched = await room.switchActiveDevice(kind, deviceId);
      // LiveKit restarts the mic track; the old analyser would read a stopped track.
      if (kind === "audioinput") {
        localSampler.current?.dispose();
        localSampler.current = null;
      }
      return switched;
    } catch {
      return false;
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    volumeRef.current = Math.min(1, Math.max(0, volume));
    audioElements.current.forEach((element) => { element.volume = volumeRef.current; });
  }, []);

  const end = useCallback(() => endSession("self"), [endSession]);

  const canRejoin = () => {
    const credentials = credentialsRef.current;
    return Boolean(credentials && Date.now() / 1000 < credentials.tokenExpiresAt);
  };

  return {
    state,
    dispatch: safeDispatch,
    levels,
    connect,
    setMuted,
    /** Ends the call for both people. */
    end,
    /** Call synchronously in the Start/Join click handler. */
    primeAudio,
    /** True when End (or a remote end) happened, e.g. while connect() was still running. */
    wasEnded: () => endRequestedRef.current,
    markEnded,
    startAudio,
    rejoin,
    canRejoin,
    switchDevice,
    setVolume,
    /** Opt-in browser-side audio timing (?latency=1): `enabled` is false and the rest empty unless switched on. */
    latency: {
      get enabled() { return latencyRef.current.enabled; },
      snapshot: () => latencyRef.current.snapshot(),
      export: () => latencyRef.current.export(),
    },
  };
}

export type CallRoom = ReturnType<typeof useCallRoom>;
export type { Seat };
