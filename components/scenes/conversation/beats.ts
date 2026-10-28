/**
 * The beats of chapter 04, in chapter progress (0–1). The spoken content and system events live in
 * conversation-data.ts; these are the scene-level beats around them. The SVG signals
 * (conversation-signals.tsx), the typography (conversation-scene.tsx), the canvas (visual.ts) and the
 * sound (lib/cinematic/sound.ts) all read both files.
 */
export const BEATS = {
  /** Chapter 03's VOICE OUT wave arrives, grows organic, and becomes Minji (magenta → cyan). */
  enter: [0, 0.08],
  /** Minji asks; the turn ends; Daniel hears the answer. */
  exchange: [0.08, 0.25],
  /** Daniel offers 10:00; "그 시간" is understood through what came before. */
  context: [0.26, 0.46],
  /** Voice Labs yields the moment Minji speaks over it. */
  interruption: [0.47, 0.59],
  /** Korean and English in one sentence; the signal never breaks. */
  codeSwitch: [0.59, 0.7],
  /** Words → meaning → intent → a natural answer, after a small pause. */
  intent: [0.7, 0.86],
  /** CONVERSATION IS MORE THAN TRANSLATION. */
  headline: [0.86, 0.94],
  /** The conversation becomes one signal and separates into layers: chapter 05 starts underneath. */
  handoff: [0.94, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type Beat = keyof typeof BEATS;
