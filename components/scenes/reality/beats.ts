import { DURATION, SYSTEM_REVEAL } from "./conversation-events";

/**
 * The beats of chapter 07, in chapter progress (0–1). The conversation itself runs on its own clock
 * (seconds, conversation-events.ts); during `talk` the scroll position is mapped onto that clock, so the
 * call plays as the visitor moves through it, and every layer reads the same event stream. The SVG system
 * (system/), the typography (reality-scene.tsx), the canvas (visual.ts) and the sound all read these.
 */
export const BEATS = {
  /** Chapter 06's line parts in the middle: KO · SEOUL on the left, EN · TORONTO on the right, quiet. */
  enter: [0, 0.05],
  /** TWO LANGUAGES. / ONE CONVERSATION. over almost nothing. */
  title: [0.03, 0.1],
  /** The two portraits draw themselves in graphite; names and places. */
  portraits: [0.07, 0.13],
  /** The conversation, clock 0 → DURATION. */
  talk: [0.12, 0.66],
  /** Silence: two people, nothing else. */
  silence: [0.64, 0.7],
  /** CONVERSATION IS MORE THAN TRANSLATION. */
  thesis: [0.7, 0.78],
  /** TIMING. CONTEXT. INTERRUPTION. INTENT. VOICE. — one at a time around the signal. */
  words: [0.75, 0.83],
  /** NATURAL CONVERSATION. */
  natural: [0.82, 0.86],
  /** The two voices connect: the bridge, VOICE LABS, the tagline, and the real thing one click away. */
  brand: [0.85, 0.93],
  /** The two voices merge into one point of light that joins chapter 08's network. */
  exit: [0.92, 1],
} as const satisfies Record<string, readonly [number, number]>;

const [T0, T1] = BEATS.talk;

/** Scroll → conversation clock (seconds). */
export const clockAt = (p: number) => Math.max(0, Math.min(1, (p - T0) / (T1 - T0))) * DURATION;
/** Conversation clock (seconds) → chapter progress. */
export const progressAt = (t: number) => T0 + (t / DURATION) * (T1 - T0);

/** The brief pull toward the centre that shows the machinery (chapter progress). */
export const REVEAL_AT = progressAt(SYSTEM_REVEAL);

/** Around the signal, one at a time. */
export const WORDS = ["TIMING.", "CONTEXT.", "INTERRUPTION.", "INTENT.", "VOICE."] as const;

/** The machinery, glimpsed for a moment (Scene 05's runtime, named for this conversation). */
export const PIPELINE = ["KO VOICE", "TURN", "UNDERSTAND", "CONTEXT", "REASON", "EN VOICE"] as const;
