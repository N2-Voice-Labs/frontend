/**
 * Browser-side audio timing for a translated call (opt-in diagnostics, off by default).
 *
 * What it measures: when the *translated audio track this person listens to* (the Runtime's
 * `translation-for-<identity>` track, in the private listen room) connects, subscribes, starts playing and carries
 * voiced audio, utterance by utterance. All times are `performance.now()` of this browser. They are NOT on the
 * Runtime's clock and must never be subtracted from a Runtime timestamp: compare durations (gaps between onsets,
 * connection to first onset) instead, or line a call up by its ordinal per listener.
 *
 * What it does not prove: `browser_first_voiced_audio` is the first moment this page's analyser read non-silent
 * PCM from the received track, at the sampling resolution (default 20 ms; coarser in a background tab). It is not
 * proof that sound reached the person's ears (output device, volume, muting and the OS are out of view).
 *
 * Nothing here records speech, transcripts or credentials: event names, times, identities, track names and counts.
 */

export const DIAG_STORAGE_KEY = "vl-latency-diag";

/** On with `?latency=1` in the page address or `localStorage["vl-latency-diag"] = "1"`; never otherwise. */
export function latencyDiagnosticsEnabled(search: string, storage?: Pick<Storage, "getItem">): boolean {
  try {
    if (new URLSearchParams(search).get("latency") === "1") return true;
  } catch {
    // Malformed query: fall through.
  }
  try {
    return storage?.getItem(DIAG_STORAGE_KEY) === "1";
  } catch {
    return false; // private mode: storage throws
  }
}

export type LatencyEventName =
  | "listener_room_connected"
  | "listener_connect_failed"
  | "translated_track_subscribed"
  | "translated_track_unsubscribed"
  | "first_rtp_audio_received"
  | "audio_concealment"
  | "receiver_stats_unavailable"
  | "analyser_unavailable"
  | "browser_first_voiced_audio"
  | "browser_voiced_audio_ended"
  | "playback_started"
  | "playback_failed"
  | "playback_blocked"
  | "playback_allowed"
  | "element_waiting"
  | "element_stalled"
  | "element_error"
  | "listener_reconnecting"
  | "listener_reconnected"
  | "listener_disconnected";

export type LatencyDetail = Record<string, string | number | boolean | null>;

export type LatencyEvent = {
  name: LatencyEventName;
  /** `performance.now()` of this browser, in milliseconds. */
  at: number;
  /** This browser's identity in the call (the listener). */
  listener: string | null;
  /** The other person's identity as seen in the session room (two-person calls only), or null. Inferred, not tagged in the audio. */
  speaker: string | null;
  /** The LiveKit track name, `translation-for-<listener>`. */
  track: string | null;
  /** 1, 2, 3… for `browser_first_voiced_audio` / `browser_voiced_audio_ended`: the nth voiced stretch on this track. */
  seq?: number;
  detail?: LatencyDetail;
};

export const LIMITATIONS = [
  "Times are performance.now() of this browser; they are not on the Runtime clock and are never subtracted from it.",
  "browser_first_voiced_audio is the analyser reading non-silent PCM from the received track at its sampling resolution, not confirmed audibility.",
  "No turn_id travels in the audio: utterances are identified by their ordinal (seq) on this listener's track, valid only while no utterance is dropped, merged or split.",
  "The speaker is the other participant of the two-person call, inferred from the session room.",
  "Background tabs throttle timers: onsets measured there are late by up to a second.",
] as const;

/** A bounded, opt-in log of timing events. Disabled: every call is a no-op. */
export class LatencyRecorder {
  private events: LatencyEvent[] = [];
  private readonly max: number;
  private readonly clock: () => number;
  readonly enabled: boolean;
  context: { listener: string | null; speaker: string | null; track: string | null } = { listener: null, speaker: null, track: null };

  constructor(options: { enabled: boolean; max?: number; now?: () => number }) {
    this.enabled = options.enabled;
    this.max = options.max ?? 500;
    this.clock = options.now ?? (() => performance.now());
  }

  record(name: LatencyEventName, extra: { seq?: number; at?: number; detail?: LatencyDetail } = {}) {
    if (!this.enabled) return;
    if (this.events.length >= this.max) this.events.shift();
    this.events.push({ name, at: extra.at ?? this.clock(), ...this.context, ...(extra.seq !== undefined ? { seq: extra.seq } : {}), ...(extra.detail ? { detail: extra.detail } : {}) });
  }

  snapshot(): LatencyEvent[] {
    return this.events.map((event) => ({ ...event }));
  }

  clear() {
    this.events = [];
  }

  /** The record as JSON, with its limits spelled out. Contains no speech and no credentials. */
  export(): string {
    return JSON.stringify(
      {
        version: 1,
        clock: "performance.now() of this browser",
        // The wall-clock instant of performance.now() = 0 in this page. Only for lining a page up with another clock on the
        // SAME host (a synthetic publisher in a validation run); meaningless against a Runtime on another machine.
        time_origin_epoch_ms: typeof performance !== "undefined" ? performance.timeOrigin : null,
        limitations: LIMITATIONS,
        events: this.events,
      },
      null,
      1,
    );
  }
}

export type VoicedChange = { type: "onset" | "end"; seq: number; /** performance.now() of the first voiced (onset) or last voiced (end) sample. */ at: number };

/**
 * Finds voiced stretches in a stream of levels (0..1, e.g. the analyser RMS): an onset needs `minVoicedMs` of
 * continuous level at or above `threshold`; it ends after `gapMs` below it. A click shorter than `minVoicedMs`
 * and silence never count. One detector per listener track: nothing is shared between listeners.
 */
export class VoicedOnsetDetector {
  private readonly threshold: number;
  private readonly minVoicedMs: number;
  private readonly gapMs: number;
  private voicedSince: number | null = null;
  private lastVoiced: number | null = null;
  private inUtterance = false;
  private count = 0;

  constructor(options: { threshold?: number; minVoicedMs?: number; gapMs?: number } = {}) {
    this.threshold = options.threshold ?? 0.04;
    this.minVoicedMs = options.minVoicedMs ?? 40;
    this.gapMs = options.gapMs ?? 400;
  }

  get utterances() {
    return this.count;
  }

  feed(level: number, now: number): VoicedChange | null {
    const voiced = Number.isFinite(level) && level >= this.threshold;
    if (voiced) {
      this.lastVoiced = now;
      if (this.voicedSince === null) this.voicedSince = now;
      if (!this.inUtterance && now - this.voicedSince >= this.minVoicedMs) {
        this.inUtterance = true;
        this.count += 1;
        return { type: "onset", seq: this.count, at: this.voicedSince };
      }
      return null;
    }
    if (!this.inUtterance) {
      this.voicedSince = null; // a click that did not last
      return null;
    }
    if (this.lastVoiced !== null && now - this.lastVoiced >= this.gapMs) {
      this.inUtterance = false;
      this.voicedSince = null;
      return { type: "end", seq: this.count, at: this.lastVoiced };
    }
    return null;
  }
}
