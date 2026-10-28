/**
 * The conversation of chapter 04 as plain data, separate from any animation. Times are chapter progress
 * (0–1). A live Voice Labs stream can later produce the same shapes (with times in seconds, mapped onto
 * the chapter) and replace this script without touching the signals, typography or canvas.
 * Illustrative, not a recording.
 */
export type Speaker = "minji" | "daniel";

export const PEOPLE: Record<Speaker, { name: string; lang: string; place: string }> = {
  minji: { name: "Minji", lang: "KO", place: "Seoul" },
  daniel: { name: "Daniel", lang: "EN", place: "Toronto" },
};

/** One stretch of speech heard by everyone on the call. */
export type Utterance = {
  id: string;
  /** Whose side of the call the audio is on. */
  speaker: Speaker;
  /** `human`: the person speaks. `voice`: Voice Labs speaks to that person, in their language. */
  source: "human" | "voice";
  lang: string;
  /** Spoken languages, e.g. ["KO", "EN"] for a code-switch. */
  langs: readonly string[];
  text: string;
  start: number;
  end: number;
  /** Cut off by a barge-in at `end`. */
  interrupted?: boolean;
  /** Memory ids this utterance relies on. */
  uses?: readonly string[];
};

/** Something the system noticed; `word` lights one of the five words. */
export type ConversationEvent = {
  at: number;
  type: "turn-end" | "first-audio" | "interruption" | "code-switch" | "context" | "intent";
  speaker?: Speaker;
  /** Small mono marker, e.g. "END OF TURN". */
  label: string;
  word?: Word;
  /** Memory id, for `context`. */
  ref?: string;
};

/** What the conversation remembers: stays faintly visible once said, lights up when used again. */
export type Memory = { id: string; text: string; from: string; at: number };

export type Word = "Timing" | "Context" | "Interruption" | "Intent" | "Voice";
export const WORDS: readonly Word[] = ["Timing", "Context", "Interruption", "Intent", "Voice"];

export const UTTERANCES: readonly Utterance[] = [
  // 1 — a question, the turn ends, the answer arrives after a breath.
  { id: "m1", speaker: "minji", source: "human", lang: "ko", langs: ["KO"], text: "내일 오전에 회의 가능할까요?", start: 0.1, end: 0.16 },
  { id: "v1", speaker: "daniel", source: "voice", lang: "en", langs: ["EN"], text: "Could we meet tomorrow morning?", start: 0.185, end: 0.235 },
  // 2 — context: "그 시간" means the 10:00 Daniel just offered.
  { id: "d1", speaker: "daniel", source: "human", lang: "en", langs: ["EN"], text: "Sure — around 10?", start: 0.27, end: 0.305 },
  { id: "v2", speaker: "minji", source: "voice", lang: "ko", langs: ["KO"], text: "네, 10시쯤 어떠세요?", start: 0.325, end: 0.355 },
  { id: "m2", speaker: "minji", source: "human", lang: "ko", langs: ["KO"], text: "네, 그 시간 좋아요.", start: 0.375, end: 0.4, uses: ["ten"] },
  { id: "v3", speaker: "daniel", source: "voice", lang: "en", langs: ["EN"], text: "Yes, 10 works for me.", start: 0.42, end: 0.45, uses: ["ten"] },
  // 3 — interruption: the voice yields the moment Minji speaks.
  { id: "d2", speaker: "daniel", source: "human", lang: "en", langs: ["EN"], text: "Great. I'll send the room details, and—", start: 0.48, end: 0.515 },
  { id: "v4", speaker: "minji", source: "voice", lang: "ko", langs: ["KO"], text: "좋아요. 회의실 정보를 보내드리고—", start: 0.525, end: 0.55, interrupted: true },
  { id: "m3", speaker: "minji", source: "human", lang: "ko", langs: ["KO"], text: "아, 잠깐만요.", start: 0.55, end: 0.57 },
  // 4 — code-switch, mid-sentence; nothing breaks.
  { id: "m4", speaker: "minji", source: "human", lang: "ko", langs: ["KO", "EN"], text: "내일 meeting 전에 자료 보내주실 수 있나요?", start: 0.6, end: 0.645 },
  { id: "v5", speaker: "daniel", source: "voice", lang: "en", langs: ["EN"], text: "Could you send the materials before tomorrow's meeting?", start: 0.665, end: 0.7 },
  // 5 — intent: not the words, what she means.
  { id: "d3", speaker: "daniel", source: "human", lang: "en", langs: ["EN"], text: "Sure. Can you review them today?", start: 0.71, end: 0.735 },
  { id: "v6", speaker: "minji", source: "voice", lang: "ko", langs: ["KO"], text: "네. 오늘 검토해 주실 수 있나요?", start: 0.745, end: 0.765 },
  { id: "m5", speaker: "minji", source: "human", lang: "ko", langs: ["KO"], text: "오늘은 조금 어려울 것 같아요.", start: 0.775, end: 0.805 },
  { id: "v7", speaker: "daniel", source: "voice", lang: "en", langs: ["EN"], text: "Today might be difficult for me.", start: 0.828, end: 0.855 },
];

export const EVENTS: readonly ConversationEvent[] = [
  { at: 0.165, type: "turn-end", speaker: "minji", label: "END OF TURN", word: "Timing" },
  { at: 0.185, type: "first-audio", speaker: "daniel", label: "FIRST AUDIO", word: "Voice" },
  { at: 0.31, type: "turn-end", speaker: "daniel", label: "END OF TURN" },
  { at: 0.405, type: "context", speaker: "minji", label: "CONTEXT · 그 시간 = 10:00", word: "Context", ref: "ten" },
  { at: 0.55, type: "interruption", speaker: "minji", label: "INTERRUPTION · VOICE YIELDS", word: "Interruption" },
  { at: 0.615, type: "code-switch", speaker: "minji", label: "KO / EN" },
  { at: 0.81, type: "intent", speaker: "minji", label: "INTENT · NOT TODAY", word: "Intent" },
];

export const MEMORIES: readonly Memory[] = [
  { id: "tomorrow", text: "tomorrow morning", from: "m1", at: 0.16 },
  { id: "ten", text: "10:00", from: "d1", at: 0.305 },
  { id: "materials", text: "materials", from: "m4", at: 0.645 },
];

/** The first time each word's event happens. */
export const wordAt = (word: Word) => EVENTS.find((e) => e.word === word)!.at;

/** The utterance audible on `speaker`'s side at chapter progress `p`, if any. */
export function utteranceAt(speaker: Speaker, p: number) {
  for (const u of UTTERANCES) if (u.speaker === speaker && p >= u.start && p <= u.end) return u;
  return null;
}
