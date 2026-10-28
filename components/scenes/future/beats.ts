/**
 * The beats of chapter 08, in chapter progress (0–1). One continuous pull-back (the conversation of
 * chapter 07 becomes a point, the point a network, the network a world made of voices, the world small in
 * the dark), then one push-in down a single signal to one voice, silence, the final line, the brand, the
 * doorway. The canvas (visual.ts), the SVG foreground (system/), the typography (future-scene.tsx) and the
 * sound (lib/cinematic/sound.ts) all read these; the shared globe is in system/globe.ts.
 */
export const BEATS = {
  /** Chapter 07's two voices, connected, recede into one point of light. */
  point: [0, 0.07],
  /** The point joins another, then another: nodes and arcs appear, tiny language tags among them. */
  many: [0.05, 0.2],
  /** Connections become clusters, clusters regions; the flat network wraps into a globe. */
  form: [0.16, 0.3],
  /** The globe dominant: arcs across oceans, nearby links, signals through several nodes. */
  globe: [0.28, 0.42],
  /** Language labels fade; the signals remain. */
  unlabel: [0.34, 0.42],
  /** Pulse → response, connection after connection; the globe breathes. */
  breathe: [0.38, 0.5],
  /** Pull back further: the world small and luminous in an enormous darkness. */
  far: [0.44, 0.56],
  /** THE WORLD IS FULL OF VOICES. */
  world: [0.5, 0.58],
  /** WE SHOULD ALL BE ABLE TO HEAR EACH OTHER. (never on screen with the first) */
  hear: [0.58, 0.66],
  /** One connection brightens; the camera goes in and travels down the signal to one voice. */
  focus: [0.65, 0.74],
  /** One tiny waveform, smaller, still. Then nothing. Held longer than comfortable. */
  silence: [0.73, 0.8],
  /** A VOICE SHOULD NEVER NEED / A TRANSLATION TO BE HEARD. — the whole sentence, slowly. */
  line: [0.8, 0.88],
  /** Black, then VOICE LABS and the tagline. */
  brand: [0.88, 0.94],
  /** The doorway (one primary action, two quiet links) and a minimal footer. */
  cta: [0.93, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type Beat = keyof typeof BEATS;
