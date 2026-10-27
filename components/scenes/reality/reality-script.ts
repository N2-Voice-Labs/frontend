/**
 * The simulated call that plays in chapter 07 when no live session runs: a hotel check-in between a
 * Korean guest and an English-speaking desk. Illustrative, not a recording.
 */
export type Beat = {
  who: "ko" | "en";
  said: string;
  saidLang: string;
  heard: string;
  heardLang: string;
  tag?: "CODE-SWITCH" | "INTERRUPTION" | "CONTEXT";
  /** Voice Labs' line is cut off: the next speaker barges in (their beat carries the INTERRUPTION tag). */
  cut?: boolean;
};

export const BEATS: readonly Beat[] = [
  { who: "ko", said: "안녕하세요, 체크인하려고 하는데요.", saidLang: "ko", heard: "Hi, I'd like to check in.", heardLang: "en" },
  { who: "en", said: "Of course. May I see your passport?", saidLang: "en", heard: "물론이죠. 여권 좀 보여주시겠어요?", heardLang: "ko" },
  { who: "ko", said: "네, 여기요 — and is late checkout possible?", saidLang: "ko", heard: "Here you go — and is late checkout possible?", heardLang: "en", tag: "CODE-SWITCH" },
  { who: "en", said: "We can do noon, or for a small fee we could—", saidLang: "en", heard: "정오까지 가능하고, 추가 요금을 내시면—", heardLang: "ko", cut: true },
  { who: "ko", said: "정오면 충분해요!", saidLang: "ko", heard: "Noon is perfect!", heardLang: "en", tag: "INTERRUPTION" },
  { who: "en", said: "Great — checkout at noon, room 1204.", saidLang: "en", heard: "좋습니다. 정오 체크아웃, 1204호입니다.", heardLang: "ko", tag: "CONTEXT" },
];

/** Seconds per beat and how it splits: the speaker talks, the turn ends, then the voice answers. */
export const BEAT_SECONDS = 4.2;
export const SPEAK_END = 0.48;
export const TURN_END = 0.56;

export type Phase = "speaking" | "turn" | "voice";

export function phaseAt(f: number): Phase {
  if (f < SPEAK_END) return "speaking";
  return f < TURN_END ? "turn" : "voice";
}

export const PEOPLE = {
  ko: { name: "Minji", place: "Guest · Seoul", lang: "KO" },
  en: { name: "Front desk", place: "Toronto", lang: "EN" },
} as const;
