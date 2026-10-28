import { range, syllables } from "@/lib/cinematic/visual";
import { EVENTS, SCRIPT, type ConversationEvent, type Lang, type Speaker, type Utterance } from "./conversation-events";

/**
 * The conversation engine: event stream + time → what every layer shows at that moment. Pure and
 * deterministic, so the scripted V1 and a live session (same events, real clock and audio levels) drive
 * the same waveforms, portraits, typography, timeline and sound.
 */

export type SideState = {
  /** The person's own voice, 0–1. */
  speak: number;
  /** Voice Labs speaking to them, in their language, 0–1. */
  hear: number;
  /** Language indicator, e.g. "KO" or, mid code-switch, "KO → EN". */
  langs: string;
  /** 1 the instant they are cut off, decaying to 0 over ~1 s. */
  cut: number;
};

export type Line = { u: Utterance; alpha: number; /** Code-switch part being spoken, -1 when none. */ part: number };
export type MarkerKind = "INTERRUPTION" | "CODE-SWITCH" | "CONTEXT";
export type Marker = { kind: MarkerKind; alpha: number };
/** A meaning travelling between the two: into the system (in), through it, out to the listener. */
export type Flow = { from: Speaker; phase: "in" | "through" | "out"; k: number; strength: number };
export type Tick = { t: number; kind: "turn" | "first" | "end" };

export type State = {
  t: number;
  minji: SideState;
  daniel: SideState;
  lines: Line[];
  markers: Marker[];
  flows: Flow[];
  /** How present the system in the middle is: clear at first, almost gone once the talk is natural. */
  presence: number;
  /** Exchange 01's glimpse of VOICE → UNDERSTAND → RESPONSE (0–1), -1 outside it. */
  pipe: number;
  /** The context connection: from the earlier utterance to the one that relies on it (0–1 strength). */
  context: { from: string; to: string; alpha: number } | null;
};

const SIDES: readonly Speaker[] = ["minji", "daniel"];
const TAG: Record<Lang, string> = { ko: "KO", en: "EN" };
const seedOf = (id: string) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) * 0.37;

/** Level of one utterance at t: soft onset, syllables, a soft end, or a hard stop if cut. */
export function level(u: Utterance, t: number) {
  if (t < u.start || t > u.end) return 0;
  const edge = Math.min(1, (t - u.start) / 0.15, u.cut ? 1 : (u.end - t) / 0.22);
  return edge * (0.35 + 0.65 * syllables(t * 1.15, seedOf(u.id)));
}

/** Which part of a code-switch is being spoken (parts share the time by length). */
export function partAt(u: Utterance, t: number) {
  if (!u.parts) return -1;
  const total = u.parts.reduce((a, p) => a + p.text.length, 0);
  const f = (t - u.start) / (u.end - u.start);
  let acc = 0;
  for (let k = 0; k < u.parts.length; k++) {
    acc += u.parts[k].text.length / total;
    if (f < acc) return k;
  }
  return u.parts.length - 1;
}

/** The next utterance on the other side that carries this one's meaning (Voice Labs' voice). */
function carrier(u: Utterance, script: readonly Utterance[]) {
  return script.find((v) => v.source === "voice" && v.side !== u.side && v.start >= u.end - 0.01 && !v.cut);
}

export function stateAt(t: number, script: readonly Utterance[] = SCRIPT): State {
  const side = (s: Speaker): SideState => {
    let speak = 0, hear = 0, cut = 0, langs: string = TAG[s === "minji" ? "ko" : "en"];
    for (const u of script) {
      if (u.side !== s) continue;
      const l = level(u, t);
      if (u.source === "human") speak = Math.max(speak, l);
      else hear = Math.max(hear, l);
      if (u.cut && t >= u.end) cut = Math.max(cut, 1 - range(t, u.end, u.end + 1));
      if (u.parts && t >= u.start && t < u.end + 1.4) {
        const k = t < u.end ? partAt(u, t) : u.parts.length - 1;
        langs = u.parts.slice(0, k + 1).map((p) => TAG[p.lang]).filter((x, i, a) => i === 0 || x !== a[i - 1]).join(" → ");
      }
    }
    return { speak, hear, cut, langs };
  };

  // What was said stays readable until the next line on the same side; a cut line dims at once.
  const lines: Line[] = [];
  for (const u of script) {
    if (t < u.start) continue;
    const next = script.find((v) => v.side === u.side && v.start > u.start);
    // Gone just before the next line on its side arrives, so two lines never share the slot.
    const until = Math.min(next ? next.start - 0.14 : Infinity, u.end + 2.6);
    let a = range(t, u.start, u.start + 0.25) * (1 - range(t, until, until + (next && next.start - 0.14 <= u.end + 2.6 ? 0.12 : 0.4)));
    if (u.cut) a *= t < u.end ? 1 : 0.4;
    if (a > 0.005) lines.push({ u, alpha: a, part: t < u.end ? partAt(u, t) : -1 });
  }

  const markers: Marker[] = [];
  const mark = (kind: MarkerKind, a: number) => { if (a > 0.005) markers.push({ kind, alpha: a }); };
  let context: State["context"] = null;
  for (const u of script) {
    if (u.cut && u.source === "human") mark("INTERRUPTION", range(t, u.end, u.end + 0.12) * (1 - range(t, u.end + 1.3, u.end + 1.7)));
    if (u.parts) mark("CODE-SWITCH", range(t, u.start + 0.4, u.start + 0.6) * (1 - range(t, u.end + 0.4, u.end + 0.8)));
    if (u.context) {
      const a = range(t, u.start - 0.1, u.start + 0.2) * (1 - range(t, u.start + 1.5, u.start + 2));
      mark("CONTEXT", a);
      if (a > 0.005) context = { from: u.context, to: u.id, alpha: a };
    }
  }

  const flows: Flow[] = [];
  for (const u of script) {
    if (u.source !== "human" || u.cut) continue;
    const v = carrier(u, script);
    if (t >= u.start && t < u.end) flows.push({ from: u.side, phase: "in", k: (t - u.start) / (u.end - u.start), strength: level(u, t) });
    else if (v && t >= u.end && t < v.start) flows.push({ from: u.side, phase: "through", k: (t - u.end) / (v.start - u.end), strength: 0.6 });
    else if (v && t >= v.start && t < v.end) flows.push({ from: u.side, phase: "out", k: (t - v.start) / (v.end - v.start), strength: level(v, t) });
  }

  const first = script[0], firstVoice = carrier(first, script);
  const pipe = firstVoice && t >= first.end - 0.2 && t < firstVoice.start + 0.8 ? range(t, first.end - 0.2, firstVoice.start + 0.2) : -1;

  return {
    t,
    minji: side("minji"),
    daniel: side("daniel"),
    lines,
    markers,
    flows,
    presence: 1 - 0.9 * range(t, 7, 24),
    pipe,
    context,
  };
}

/** The timeline's marks: end of each turn, first audio of each reply, end of each reply. No numbers. */
export function ticks(events: readonly ConversationEvent[] = EVENTS): Tick[] {
  const out: Tick[] = [];
  for (const e of events) {
    if (e.type === "turn") out.push({ t: e.startTime, kind: "turn" });
    else if (e.type === "response_start") out.push({ t: e.startTime, kind: "first" });
    else if (e.type === "response_end") out.push({ t: e.startTime, kind: "end" });
  }
  return out;
}

export { SIDES };
