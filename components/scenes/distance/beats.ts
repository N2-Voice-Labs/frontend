/**
 * The beats of chapter 02, in chapter progress (0–1). The canvas (visual.ts), the typography
 * (distance-scene.tsx) and the sound (lib/cinematic/sound.ts) all read these.
 *
 * chapter 01's dissolved letters → two voices, close → the camera pulls back: more voices, languages,
 * language worlds → signals reach between worlds and fail → everything slows → THE WORLD IS FULL OF
 * VOICES. → BUT WE DON'T ALL SPEAK THE SAME LANGUAGE. → LANGUAGE SHOULD NOT BECOME A WALL. → silence →
 * one connection holds → more → they become the bridge chapter 03 opens on.
 */
export const BEATS = {
  /** Chapter 01's spread particles gather into the two voices (KO, EN), seen very close. */
  handoff: [0, 0.06],
  /** First pull-back: a few more voices around them. */
  pullNear: [0.06, 0.16],
  /** Wide: hundreds of voices with depth, gathering into language worlds. */
  pullWide: [0.16, 0.3],
  /** Words surface from their worlds, one language at a time, then fade. */
  languages: [0.12, 0.36],
  /** Signals reach from world to world and break up on the way; the field is at its densest. */
  attempts: [0.26, 0.46],
  /** Everything slows almost to stillness; a few words hang in the dark. */
  slow: [0.44, 0.52],
  /** THE WORLD IS FULL OF VOICES. */
  statement1: [0.48, 0.6],
  /** BUT WE DON'T ALL SPEAK THE SAME LANGUAGE. */
  statement2: [0.6, 0.72],
  /** LANGUAGE SHOULD NOT BECOME A WALL. — most particles fall away, attention to the centre. */
  thesis: [0.72, 0.82],
  /** Silence, then one cyan signal reaches a magenta one and holds. */
  firstLink: [0.8, 0.87],
  /** 1 → 3 → 10 → dozens of connections. */
  links: [0.86, 0.93],
  /** The connections line up into a bridge; the camera moves toward it. At p = 1 the field is chapter 03's opening frame. */
  bridge: [0.92, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type Beat = keyof typeof BEATS;

/**
 * The language worlds, in the order their words surface. `ko` and `en` are the two people of chapter 01
 * and keep their cyan/magenta; every other world is warm neutral. Visually diverse scripts on purpose.
 */
export const LANGUAGES = [
  { id: "ko", lang: "ko", word: "안녕하세요" },
  { id: "en", lang: "en", word: "hello" },
  { id: "ja", lang: "ja", word: "こんにちは" },
  { id: "es", lang: "es", word: "hola" },
  { id: "ar", lang: "ar", word: "مرحبا" },
  { id: "hi", lang: "hi", word: "नमस्ते" },
  { id: "fr", lang: "fr", word: "bonjour" },
  { id: "zh", lang: "zh", word: "你好" },
  { id: "ru", lang: "ru", word: "привет" },
  { id: "kk", lang: "kk", word: "сәлем" },
  { id: "tr", lang: "tr", word: "merhaba" },
] as const;
