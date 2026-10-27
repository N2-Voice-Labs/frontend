/**
 * The scripted conversation of chapter 04, in chapter progress (0–1). The canvas draws the segments as a
 * scrolling two-lane timeline; the HTML layer shows their captions and lights a word per event.
 * Illustrative, not a recording.
 */
export type Lane = "ko" | "en";

export type Segment = {
  lane: Lane;
  /** `human`: the person speaks. `voice`: Voice Labs speaks to that person in their language. */
  kind: "human" | "voice";
  start: number;
  end: number;
  text: string;
  lang: string;
  /** The voice was cut off by a barge-in. */
  cut?: boolean;
};

export type ConversationEvent = { at: number; label: string; word: RailWord };

export type RailWord = "Timing" | "Interruption" | "Context" | "Intent" | "Voice";

export const SEGMENTS: readonly Segment[] = [
  { lane: "ko", kind: "human", start: 0.1, end: 0.235, text: "내일 오전에 회의 가능할까요?", lang: "ko" },
  { lane: "en", kind: "voice", start: 0.27, end: 0.36, text: "Could we meet tomorrow morning?", lang: "en" },
  { lane: "en", kind: "human", start: 0.39, end: 0.46, text: "Sure — how about ten?", lang: "en" },
  { lane: "ko", kind: "voice", start: 0.47, end: 0.505, text: "물론이죠, 10시 어떠—", lang: "ko", cut: true },
  { lane: "ko", kind: "human", start: 0.505, end: 0.61, text: "아, 잠깐만요 — actually, eleven works better.", lang: "ko" },
  { lane: "en", kind: "voice", start: 0.645, end: 0.72, text: "Actually, eleven would work better for me.", lang: "en" },
  { lane: "en", kind: "human", start: 0.75, end: 0.81, text: "Perfect. Eleven it is.", lang: "en" },
  { lane: "ko", kind: "voice", start: 0.835, end: 0.9, text: "좋아요, 11시로 하죠.", lang: "ko" },
];

export const EVENTS: readonly ConversationEvent[] = [
  { at: 0.245, label: "END OF TURN", word: "Timing" },
  { at: 0.505, label: "INTERRUPTION · VOICE YIELDS", word: "Interruption" },
  { at: 0.55, label: "CODE-SWITCH · KO → EN", word: "Context" },
  { at: 0.625, label: "INTENT · MOVE TO 11:00", word: "Intent" },
  { at: 0.835, label: "SAME VOICE, OTHER LANGUAGE", word: "Voice" },
];

export const RAIL_WORDS: readonly RailWord[] = ["Timing", "Context", "Interruption", "Intent", "Voice"];

/** Chapter progress at which `word` lights up. */
export const wordAt = (word: RailWord) => EVENTS.find((e) => e.word === word)!.at;
