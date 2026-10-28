import type { TextPoints } from "@/lib/cinematic/text-points";

/**
 * The beats of chapter 01, in chapter progress (0–1). The canvas visual (visual.ts), the typography
 * timeline (silence-scene.tsx) and the sound (lib/cinematic/sound.ts) all read these, so retiming the
 * opening happens here.
 *
 * darkness → a signal (KO) → it speaks → silence → a far answer (EN) → they approach and fail →
 * a question that does not arrive → silence → WE SPEAK DIFFERENTLY. → the signals sync →
 * BUT CONVERSATION SHOULD FEEL NATURAL. → the words become particles → chapter 02.
 */
export const BEATS = {
  /** Only grain, header and chapters. */
  dark: [0, 0.04],
  /** A tiny cyan signal is detected on the left; KO · SEOUL 09:41. */
  koSignal: [0.04, 0.1],
  /** "안녕하세요…" */
  koHello: [0.1, 0.2],
  silence1: [0.2, 0.25],
  /** A small, dim magenta signal far to the right; EN · TORONTO 20:41. */
  enSignal: [0.25, 0.3],
  /** "Hello?" */
  enHello: [0.3, 0.36],
  /** The signals drift toward each other and lose coherence near the centre. */
  approach: [0.36, 0.46],
  /** "내일 오전에 회의 가능할까요?" — fragments cross toward the other side and scatter. */
  koAsk: [0.46, 0.54],
  /** What arrives on the other side is incomplete: "…?" */
  enLost: [0.54, 0.59],
  /** Everything stops; the screen is almost black again. */
  silence2: [0.59, 0.66],
  /** WE · SPEAK · DIFFERENTLY. placed word by word, then held. */
  statement: [0.66, 0.8],
  /** The signals return and share one rhythm; the centre wakes up. */
  sync: [0.78, 0.92],
  /** BUT CONVERSATION / SHOULD FEEL NATURAL. */
  thesis: [0.82, 0.92],
  /** The thesis letters become particles (KO/EN colours) and spread into chapter 02's field. */
  dissolve: [0.92, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type Beat = keyof typeof BEATS;

/**
 * Glyph points of the thesis title, sampled by the scene from the rendered HTML (on mount, resize and
 * after fonts load) and read every frame by the canvas during `dissolve`. Empty until sampled.
 */
export const thesisPoints: { current: TextPoints | null } = { current: null };
