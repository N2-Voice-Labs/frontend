/**
 * The beats of chapter 03, in chapter progress (0–1). One visual object changes form all the way through:
 * connections → bridge → one signal → VOICE LABS → the runtime → the outgoing voice that chapter 04 picks up.
 * The SVG system (bridge-system.tsx), the typography (bridge-scene.tsx), the canvas (visual.ts) and the
 * sound (lib/cinematic/sound.ts) all read these.
 *
 * SVG draws the Voice Labs system; canvas particles are the world around it; DOM carries the type.
 */
export const BEATS = {
  /** Chapter 02's connections, already lying on the arc, steady and gain coherence. */
  stabilize: [0, 0.08],
  /** Several strands align into one continuous abstract bridge (no pillars). */
  align: [0.08, 0.18],
  /** The camera moves into the bridge; the world of particles goes peripheral. */
  enter: [0.18, 0.3],
  /** The strands collapse into one primary line and one signal crosses the screen (cyan → magenta). */
  signal: [0.3, 0.4],
  /** VOICE LABS emerges where the signal passes the centre. */
  title: [0.38, 0.48],
  /** Real-time voice infrastructure for a multilingual world. */
  tagline: [0.46, 0.56],
  /** One signal through four states: SPEECH (wave) → UNDERSTAND (language) → REASON (context network) → RESPOND (wave). */
  concept: [0.56, 0.66],
  /** The same line reorganises into the runtime, stage by stage (see STAGES). */
  runtime: [0.64, 0.8],
  /** Packets flow through every stage; the active stage moves like a heartbeat. */
  flow: [0.78, 0.9],
  /** SPEECH IN ONE LANGUAGE. / UNDERSTOOD. / REASONED OVER. / ANSWERED NATURALLY IN ANOTHER. */
  statement: [0.88, 0.96],
  /** VOICE OUT's waveform carries on and becomes chapter 04's first lane. */
  handoff: [0.95, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type Beat = keyof typeof BEATS;

/** Runtime stages in signal order, each revealed at `at` (chapter progress, inside BEATS.runtime). */
export const STAGES = [
  { id: "voice-in", label: "VOICE IN", at: 0.645 },
  { id: "vad", label: "VAD · TURN", at: 0.665 },
  { id: "stt", label: "STT", at: 0.685 },
  { id: "agent", label: "VOICE AGENT · LLM", at: 0.71 },
  { id: "tools", label: "TOOLS · CONTEXT", at: 0.735 },
  { id: "tts", label: "TTS", at: 0.755 },
  { id: "voice-out", label: "VOICE OUT", at: 0.775 },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

/** Small branches around the agent (secondary, never cards). Only what the product claims. */
export const AGENT_BRANCHES = ["CONTEXT", "KNOWLEDGE", "TOOLS", "CONVERSATION"] as const;

/** Quiet metadata around the system during `flow`. */
export const MICRO_LABELS = ["REAL TIME", "TURN-TAKING", "MULTILINGUAL", "PROVIDER-INDEPENDENT", "MEASURED", "REUSABLE"] as const;

/** The four statement lines, in the rhythm of the signal. */
export const STATEMENT = ["Speech in one language.", "Understood.", "Reasoned over.", "Answered naturally in another."] as const;
