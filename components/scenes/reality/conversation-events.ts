import { PEOPLE, type Speaker } from "@/components/scenes/conversation/conversation-data";

/**
 * Chapter 07's conversation as an EVENT STREAM, in seconds. Everything on screen (waveforms, portraits,
 * typography, the timeline, the sound) is driven by these events through conversation-engine.ts, so a
 * live Voice Labs session (LiveKit / WebSocket: STT, TTS, turn and latency events) can later produce the
 * same events and replace the script without touching the visuals.
 *
 * The scripted V1 below is illustrative, not a recording.
 */

export { PEOPLE, type Speaker };
export type Lang = "ko" | "en";

export type EventType =
  | "speech_start" | "speech_end"
  | "interruption"
  | "transcript"
  | "translation"
  | "response_start" | "response_end"
  | "turn"
  | "code_switch"
  | "context"
  | "tool_call";

export type ConversationEvent = {
  id: string;
  type: EventType;
  /** The person whose side of the call the event belongs to. */
  speaker: Speaker;
  language?: Lang;
  text?: string;
  /** Seconds from the start of the conversation. */
  startTime: number;
  endTime?: number;
  /** Optional audio for this stretch (a recorded clip or a live track); waveforms follow it when present. */
  audio?: string;
  /** The utterance (or earlier event) this one refers to: the cut speech, the context it relies on. */
  ref?: string;
};

/**
 * One stretch of audio on one side of the call. `human`: the person speaks. `voice`: Voice Labs speaks
 * to that person, in their language, carrying what the other person meant.
 */
export type Utterance = {
  id: string;
  side: Speaker;
  source: "human" | "voice";
  lang: Lang;
  text: string;
  start: number;
  end: number;
  /** A code-switch: the parts and their languages, in order. */
  parts?: readonly { text: string; lang: Lang }[];
  /** Cut off at `end` by the other person barging in. */
  cut?: boolean;
  /** Earlier utterance whose meaning this one depends on (context carried forward). */
  context?: string;
};

/** The scripted V1 call: five exchanges that grow more fluid, then the goodbye. */
export const SCRIPT: readonly Utterance[] = [
  // 01 — a question, and the other side simply understands.
  { id: "m1", side: "minji", source: "human", lang: "ko", text: "내일 오전에 회의 가능할까요?", start: 1.0, end: 3.5 },
  { id: "v1", side: "daniel", source: "voice", lang: "en", text: "Could we meet tomorrow morning?", start: 4.3, end: 6.4 },
  // 02 — Daniel starts; Minji cuts in; the system follows her.
  { id: "d2", side: "daniel", source: "human", lang: "en", text: "Tomorrow morning works for—", start: 7.8, end: 9.5, cut: true },
  { id: "v2a", side: "minji", source: "voice", lang: "ko", text: "내일 오전은—", start: 9.0, end: 9.5, cut: true },
  { id: "m2", side: "minji", source: "human", lang: "ko", text: "아, 잠깐만요.", start: 9.5, end: 10.6 },
  { id: "v2", side: "daniel", source: "voice", lang: "en", text: "Oh, one moment.", start: 11.0, end: 12.1 },
  { id: "d2b", side: "daniel", source: "human", lang: "en", text: "Sure, go ahead.", start: 12.8, end: 13.9 },
  { id: "v2b", side: "minji", source: "voice", lang: "ko", text: "네, 말씀하세요.", start: 14.3, end: 15.4 },
  // 03 — Minji mixes languages; the signal never breaks.
  {
    id: "m3", side: "minji", source: "human", lang: "ko", text: "그럼 meeting room도 예약할까요?", start: 16.2, end: 18.6,
    parts: [{ text: "그럼 ", lang: "ko" }, { text: "meeting room", lang: "en" }, { text: "도 예약할까요?", lang: "ko" }],
  },
  { id: "v3", side: "daniel", source: "voice", lang: "en", text: "Should I book a meeting room too?", start: 19.1, end: 21.0 },
  // 04 — Daniel asks something that only makes sense with what came before.
  { id: "d4", side: "daniel", source: "human", lang: "en", text: "Yes, please. Does around ten work?", start: 21.9, end: 23.7 },
  { id: "v4", side: "minji", source: "voice", lang: "ko", text: "네. 10시 정도 괜찮아요?", start: 24.1, end: 25.6, context: "m1" },
  { id: "m4", side: "minji", source: "human", lang: "ko", text: "네, 그 시간 좋아요.", start: 26.2, end: 27.5 },
  { id: "v4b", side: "daniel", source: "voice", lang: "en", text: "Yes, that time works.", start: 27.8, end: 29.0 },
  // 05 — they agree; by now it is just two people talking.
  { id: "m5", side: "minji", source: "human", lang: "ko", text: "그럼 내일 10시에 만나요.", start: 30.6, end: 32.3 },
  { id: "v5", side: "daniel", source: "voice", lang: "en", text: "Then let's meet tomorrow at ten.", start: 32.6, end: 34.3 },
  { id: "d5", side: "daniel", source: "human", lang: "en", text: "Sounds good. See you tomorrow.", start: 35.0, end: 36.7 },
  { id: "v5b", side: "minji", source: "voice", lang: "ko", text: "좋아요. 내일 봬요.", start: 37.0, end: 38.6 },
];

/** Seconds of conversation, including the silence after the goodbye. */
export const DURATION = 41;

/** When the camera briefly pulls toward the centre and the machinery shows (between exchanges 04 and 05). */
export const SYSTEM_REVEAL = 29.6;

const other = (s: Speaker): Speaker => (s === "minji" ? "daniel" : "minji");

/** The script as events: what a live session would emit. */
export function scriptEvents(script: readonly Utterance[] = SCRIPT): ConversationEvent[] {
  const ev: ConversationEvent[] = [];
  for (const u of script) {
    const base = { speaker: u.side, language: u.lang, text: u.text, ref: u.id };
    if (u.source === "human") {
      ev.push({ ...base, id: `${u.id}:start`, type: "speech_start", startTime: u.start });
      ev.push({ ...base, id: `${u.id}:transcript`, type: "transcript", startTime: u.start, endTime: u.end });
      ev.push({ ...base, id: `${u.id}:end`, type: "speech_end", startTime: u.end });
      if (u.cut) {
        ev.push({ id: `${u.id}:interruption`, type: "interruption", speaker: other(u.side), startTime: u.end, ref: u.id });
      } else {
        ev.push({ id: `${u.id}:turn`, type: "turn", speaker: u.side, startTime: u.end + 0.25, ref: u.id });
      }
      if (u.parts) ev.push({ ...base, id: `${u.id}:switch`, type: "code_switch", startTime: u.start, endTime: u.end });
    } else {
      ev.push({ ...base, id: `${u.id}:translation`, type: "translation", startTime: u.start, endTime: u.end });
      ev.push({ ...base, id: `${u.id}:start`, type: "response_start", startTime: u.start });
      ev.push({ ...base, id: `${u.id}:end`, type: "response_end", startTime: u.end });
      if (u.context) ev.push({ id: `${u.id}:context`, type: "context", speaker: u.side, startTime: u.start, ref: u.context });
    }
  }
  return ev.sort((a, b) => a.startTime - b.startTime);
}

export const EVENTS = scriptEvents();
