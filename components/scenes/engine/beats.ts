/**
 * The beats of chapter 05, in chapter progress (0–1). The subject is the transformation of one voice
 * (VOICE → SIGNAL → UNDERSTANDING → REASONING → RESPONSE), seen through one continuous camera that
 * travels inside the runtime and finally pulls back to show it whole. The SVG system (system/), the
 * typography (engine-scene.tsx), the canvas (visual.ts) and the sound (lib/cinematic/sound.ts) all
 * read these.
 */
export const BEATS = {
  /** Chapter 04's layered wave arrives as one thin cyan wave; the camera follows it. */
  enter: [0, 0.06],
  /** The camera enters the voice: oscillations, traces, points. VOICE IN · STREAM · REAL TIME flicker. */
  dive: [0.04, 0.12],
  /** A scan line segments speech / silence / speech; the turn ends. VAD · TURN DETECTION. */
  vad: [0.12, 0.24],
  /** Fragments of language rise out of the wave and assemble into the sentence. STT · SPEECH → LANGUAGE. */
  stt: [0.24, 0.34],
  /** The sentence breaks into meaning: TIME · TOMORROW · MORNING · MEETING · AVAILABILITY. */
  understand: [0.34, 0.42],
  /** Streams converge into a reasoning field: history, intent, language, context, tools, knowledge. */
  reason: [0.42, 0.52],
  /** A signal leaves for a tool (is tomorrow morning free?) and returns before the answer. */
  act: [0.52, 0.6],
  /** The branches collapse into one decision: INTENT → RESPONSE; the reply appears and dissolves. */
  respond: [0.6, 0.66],
  /** Language becomes voice again, the inverse of STT. TTS · LANGUAGE → VOICE. */
  tts: [0.66, 0.72],
  /** Pull back: every stage is one continuous living path; T0–T4 instrumentation; a KO → EN pass. */
  runtime: [0.72, 0.82],
  /** SERIOUS ENGINEERING, OUT OF SIGHT. + the tagline, over the running system. */
  statement: [0.8, 0.88],
  /** Capabilities attach to the system one at a time as metadata. */
  capabilities: [0.82, 0.92],
  /** The camera moves away; the outgoing signal grows; the runtime falls behind it. */
  exit: [0.88, 0.94],
  /** ONE RUNTIME. / MANY CONVERSATIONS. */
  many: [0.91, 0.97],
  /** The outgoing signal multiplies 1 → 2 → 10 → 100 and becomes chapter 06's network. */
  multiply: [0.94, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type Beat = keyof typeof BEATS;

/** The runtime's regions in signal order (one continuous path, not boxes). */
export const STAGES = [
  { id: "voice-in", label: "VOICE IN" },
  { id: "vad", label: "VAD · TURN" },
  { id: "stt", label: "STT" },
  { id: "agent", label: "VOICE AGENT · LLM" },
  { id: "tools", label: "TOOLS / CONTEXT" },
  { id: "tts", label: "TTS" },
  { id: "voice-out", label: "VOICE OUT" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

/** Instrumentation markers along the runtime: where latency is measured. Never values unless real. */
export const MARKERS = ["T0 · SPEECH", "T1 · TURN", "T2 · UNDERSTANDING", "T3 · RESPONSE", "T4 · FIRST AUDIO"] as const;

/** What the voice says and how it is understood (illustrative). */
export const UTTERANCE = { text: "내일 오전에 회의 가능할까요?", lang: "ko", fragments: ["내일", "오전", "회의", "가능할까요"] } as const;
export const MEANING = ["TIME", "TOMORROW", "MORNING", "MEETING", "AVAILABILITY"] as const;
export const REASON_INPUTS = ["HISTORY", "INTENT", "LANGUAGE", "CONTEXT", "TOOLS", "KNOWLEDGE"] as const;
export const BRANCHES = ["CONTEXT", "KNOWLEDGE", "TOOLS", "INTEGRATIONS", "MEMORY"] as const;
export const RESPONSE = { text: "네, 내일 오전 10시는 괜찮습니다.", lang: "ko" } as const;

/** Metadata attached to the system during `capabilities`. */
export const CAPABILITIES = ["REAL TIME", "NATURAL TURN-TAKING", "INTERRUPTION AWARE", "MULTILINGUAL", "PROVIDER-INDEPENDENT", "MEASURABLE", "REUSABLE"] as const;
