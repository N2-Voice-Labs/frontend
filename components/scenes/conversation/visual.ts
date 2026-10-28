import { clamp } from "@/lib/landing/math";
import { engineVisual } from "@/components/scenes/engine/visual";
import { BRIDGE, DIM, EN, INK, KO, lerp, range, rnd, syllables, window01, type Frame, type Point, type SceneVisual } from "@/lib/cinematic/visual";
import { BEATS } from "./beats";
import { UTTERANCES, utteranceAt, type Speaker } from "./conversation-data";
import { HANDOFF_Y, conversationLayout } from "./layout";

/** Lane heights as fractions of the viewport (chapter 03's SVG hands its wave over at `ko`). */
export const LANE_Y: Record<"ko" | "en", number> = { ko: HANDOFF_Y, en: 0.64 };

/*
 * 04 — the canvas is the ambient world only; the SVG draws the signals and the DOM the words.
 * p = 0: chapter 03's VOICE OUT wave as a calm magenta haze line at HANDOFF_Y.
 * enter: the haze gathers into two dim halos (Minji cyan, Daniel magenta); sparse dust elsewhere.
 * exchanges: the audible side's halo breathes a little brighter; between a person's turn and the voice
 *   answering, a thin stream drifts speaker → centre → listener.
 * interruption: the stream toward Minji puffs back toward the centre.
 * headline: everything dims. handoff: every particle eases into chapter 05's first frame (exact at p = 1).
 */

const [, ENTER_END] = BEATS.enter;
const [HEADLINE_START] = BEATS.headline;
const [HANDOFF_START, HANDOFF_END] = BEATS.handoff;

// ---------------------------------------------------------------- streams (static)

/** A human turn ends → the voice answers on the other side. Interrupted answers stream until the cut. */
type Stream = { from: Speaker; a: number; b: number; cut: boolean };
const STREAMS: readonly Stream[] = UTTERANCES.flatMap((u, k) => {
  const next = UTTERANCES[k + 1];
  if (u.source !== "human" || !next || next.source !== "voice" || next.speaker === u.speaker) return [];
  return [{ from: u.speaker, a: u.end, b: next.interrupted ? next.end : next.start, cut: !!next.interrupted }];
});
const PUFF = 0.03;

// ---------------------------------------------------------------- per-particle statics

const HALO = 0, STREAM = 1, DUST = 2;
let ROLE = new Uint8Array(0);
/** Position along the p = 0 haze line; < 0.5 gathers into Minji's halo. */
let U = new Float64Array(0);
let JIT = new Float64Array(0), PH = new Float64Array(0), SE = new Float64Array(0), HS = new Float64Array(0);
let ANG = new Float64Array(0), RR = new Float64Array(0), GOLD = new Float64Array(0);
let DX = new Float64Array(0), DY = new Float64Array(0), DA = new Float64Array(0), DS = new Float64Array(0);
let DC = new Uint8Array(0);

function statics(n: number) {
  ROLE = new Uint8Array(n); DC = new Uint8Array(n);
  U = new Float64Array(n); JIT = new Float64Array(n); PH = new Float64Array(n); SE = new Float64Array(n); HS = new Float64Array(n);
  ANG = new Float64Array(n); RR = new Float64Array(n); GOLD = new Float64Array(n);
  DX = new Float64Array(n); DY = new Float64Array(n); DA = new Float64Array(n); DS = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r1 = rnd(i, 1);
    ROLE[i] = r1 < 0.3 ? HALO : r1 < 0.325 ? STREAM : DUST;
    U[i] = rnd(i, 80);
    JIT[i] = rnd(i, 81) + rnd(i, 82) - 1;
    PH[i] = rnd(i, 83) * Math.PI * 2;
    SE[i] = rnd(i, 84);
    HS[i] = rnd(i, 85);
    ANG[i] = rnd(i, 86) * Math.PI * 2;
    // Denser towards the centre of the halo.
    RR[i] = Math.pow(rnd(i, 87), 0.75);
    GOLD[i] = rnd(i, 88);
    // Dust sits where chapter 03's dust was (same seeds), so the seam barely moves it; most stays unlit.
    DX[i] = rnd(i, 62); DY[i] = rnd(i, 63);
    const lit = rnd(i, 89);
    DA[i] = lit < 0.45 ? 0.025 + 0.05 * (lit / 0.45) : 0;
    DS[i] = 0.7 + 0.4 * rnd(i, 90);
    DC[i] = rnd(i, 68) < 0.35 ? INK : DIM;
  }
}

// ---------------------------------------------------------------- per-frame cache

let cp = NaN, ct = NaN, cw = NaN, ch = NaN, cn = -1, cport = false;
/** Chapter 05's first frame (p = 0, same t). Reused, never reallocated. */
const E0: Frame = { w: 0, h: 0, t: 0, p: 0, n: 0, portrait: false, u: 1 };
const T: Point = { x: 0, y: 0, a: 0, c: 0, s: 1 };
let mx = 0, my = 0, dx = 0, dy = 0, cx = 0, cy = 0, rx = 0, ry = 0, lineY = 0;
/** Halo liveliness (0–1) and whether the voice (not the person) is what is audible, per side. */
let liveM = 0, liveD = 0, voiceM = false, voiceD = false;
let dim = 1, handoff = 0;
/** Active stream: index into STREAMS (−1 none), its progress, and the interruption puff (0–1, −1 none). */
let sIdx = -1, sProg = 0, puff = -1, puffFrom = 0;

function level(speaker: Speaker, p: number) {
  let l = 0;
  for (const u of UTTERANCES) if (u.speaker === speaker) l = Math.max(l, window01(p, u.start, u.end, 0.012) * (u.source === "voice" ? 0.8 : 1));
  return l;
}

function update(f: Frame) {
  if (f.p === cp && f.t === ct && f.w === cw && f.h === ch && f.n === cn && f.portrait === cport) return;
  if (f.n !== cn) statics(f.n);
  cp = f.p; ct = f.t; cw = f.w; ch = f.h; cn = f.n; cport = f.portrait;
  const p = f.p;
  const L = conversationLayout(f.w, f.h);
  mx = L.minji.x; my = L.minji.y; dx = L.daniel.x; dy = L.daniel.y; cx = L.centre.x; cy = L.centre.y;
  rx = L.wave; ry = f.u * (L.portrait ? 0.08 : 0.09);
  lineY = f.h * HANDOFF_Y;
  E0.w = f.w; E0.h = f.h; E0.t = f.t; E0.p = 0; E0.n = f.n; E0.portrait = f.portrait; E0.u = f.u;
  liveM = level("minji", p) * (0.55 + 0.45 * syllables(f.t, 1.3));
  liveD = level("daniel", p) * (0.55 + 0.45 * syllables(f.t, 4.1));
  voiceM = utteranceAt("minji", p)?.source === "voice";
  voiceD = utteranceAt("daniel", p)?.source === "voice";
  sIdx = -1; puff = -1;
  for (let k = 0; k < STREAMS.length; k++) {
    const s = STREAMS[k];
    if (p >= s.a && p <= s.b) { sIdx = k; sProg = (p - s.a) / (s.b - s.a); break; }
    if (s.cut && p > s.b && p < s.b + PUFF) { puff = (p - s.b) / PUFF; puffFrom = k; break; }
  }
  dim = 1 - 0.5 * range(p, HEADLINE_START - 0.005, HEADLINE_START + 0.015);
  handoff = clamp((p - HANDOFF_START) / (HANDOFF_END - HANDOFF_START));
}

// ---------------------------------------------------------------- formations

/** The p = 0 haze line: chapter 03's VOICE OUT wave, calm, magenta. */
function placeLine(i: number, f: Frame, o: Point) {
  const u = U[i];
  o.x = lerp(f.w * 0.02, f.w * 0.98, u);
  o.y = lineY + JIT[i] * f.u * 0.006 + Math.sin(f.t * 0.11 + PH[i]) * 1.2;
  o.a = 0.11 * Math.sin(Math.PI * u) ** 0.5;
  o.c = EN;
  o.s = 1;
}

function placeHalo(i: number, f: Frame, o: Point) {
  const minji = U[i] < 0.5;
  const live = minji ? liveM : liveD;
  // Silent: nearly still. Audible: a slow outward breath, each particle on its own phase.
  const rot = f.t * (0.012 + 0.03 * live) * ((i & 1) ? 1 : -1);
  const breath = 1 + live * (0.05 * Math.sin(f.t * 2.2) + 0.22 * (0.5 + 0.5 * Math.sin(f.t * 1.3 + PH[i])));
  const ang = ANG[i] + rot, r = RR[i] * breath;
  o.x = (minji ? mx : dx) + Math.cos(ang) * r * rx;
  o.y = (minji ? my : dy) + Math.sin(ang) * r * ry;
  o.a = Math.min(0.2, (0.025 + 0.07 * (1 - RR[i])) * (1 + 1.1 * live));
  const voice = minji ? voiceM : voiceD;
  // When it is Voice Labs speaking to this person, a few particles warm to gold.
  o.c = voice && GOLD[i] < 0.2 * live ? BRIDGE : minji ? KO : EN;
  o.s = 1;
}

/** A point on the stream path (speaker → centre → listener), a quadratic through the centre at q = 0.5. */
function streamAt(i: number, f: Frame, from: Speaker, q: number, o: Point) {
  const ax = from === "minji" ? mx : dx, ay = from === "minji" ? my : dy;
  const bx = from === "minji" ? dx : mx, by = from === "minji" ? dy : my;
  const kx = 2 * cx - (ax + bx) / 2, ky = 2 * cy - (ay + by) / 2;
  const q1 = 1 - q;
  let x = q1 * q1 * ax + 2 * q * q1 * kx + q * q * bx;
  let y = q1 * q1 * ay + 2 * q * q1 * ky + q * q * by;
  // A little sideways wander, perpendicular to the overall direction.
  const ex = bx - ax, ey = by - ay, len = Math.sqrt(ex * ex + ey * ey) || 1;
  const off = (JIT[i] * 0.012 + Math.sin(q * Math.PI * 3 + f.t * 1.5 + PH[i]) * 0.006) * f.u;
  x += (-ey / len) * off; y += (ex / len) * off;
  o.x = x; o.y = y;
  const fromC = from === "minji" ? KO : EN, toC = from === "minji" ? EN : KO;
  o.c = q < 0.42 ? fromC : q < 0.58 ? BRIDGE : toC;
  o.s = 1.1;
}

function placeStream(i: number, f: Frame, o: Point) {
  if (f.p < ENTER_END) {
    // Part of the haze line, fading out as the line gathers into the halos.
    placeLine(i, f, o);
    o.a *= 1 - range(f.p, 0.01, 0.05);
    return;
  }
  if (sIdx >= 0) {
    const s = STREAMS[sIdx];
    // Staggered departure; an interrupted answer never fully arrives.
    const q = s.cut ? clamp(sProg - SE[i] * 0.35) * 0.85 : clamp(sProg * 1.4 - SE[i] * 0.4);
    streamAt(i, f, s.from, q, o);
    o.a = 0.16 * Math.sin(Math.PI * q) ** 0.7;
    return;
  }
  if (puff >= 0) {
    // Interruption: the stream toward Minji scatters back toward the centre in a quick puff.
    const s = STREAMS[puffFrom];
    const q = clamp(1 - SE[i] * 0.35) * 0.85;
    streamAt(i, f, s.from, q, o);
    const a0 = 0.16 * Math.sin(Math.PI * q) ** 0.7;
    const k = 1 - (1 - puff) ** 3;
    const ang = PH[i], rad = f.u * (0.03 + 0.07 * HS[i]);
    o.x = lerp(o.x, cx + Math.cos(ang) * rad, k);
    o.y = lerp(o.y, cy + Math.sin(ang) * rad * 0.6, k);
    o.a = a0 * (1 + 0.25 * Math.sin(Math.PI * Math.min(1, puff * 2))) * (1 - range(puff, 0.3, 1));
    o.c = BRIDGE;
    return;
  }
  o.x = cx; o.y = cy; o.a = 0; o.c = DIM; o.s = 1;
}

function placeDust(i: number, f: Frame, o: Point) {
  o.x = (DX[i] + Math.sin(f.t * 0.035 + PH[i]) * 0.012) * f.w;
  o.y = (DY[i] + Math.cos(f.t * 0.028 + PH[i] * 1.3) * 0.01) * f.h;
  o.a = DA[i] * (0.8 + 0.2 * Math.sin(f.t * 0.6 + PH[i] * 3));
  o.c = DC[i];
  o.s = DS[i];
}

/** 04 — the ambient world around the conversation. */
export const conversationVisual: SceneVisual = {
  morph: 0, // chapter 03 (bridge/visual.ts) ends exactly on this chapter's first frame.
  place(i, f, o) {
    update(f);
    const role = ROLE[i];
    if (role === DUST) placeDust(i, f, o);
    else if (role === STREAM) placeStream(i, f, o);
    else {
      // Enter: the haze line gathers into the halos, each particle at its own moment (magenta → cyan for Minji).
      const g = range(f.p, 0.005 + SE[i] * 0.04, 0.035 + SE[i] * 0.04);
      if (g <= 0) placeLine(i, f, o);
      else if (g >= 1) placeHalo(i, f, o);
      else {
        placeLine(i, f, T);
        placeHalo(i, f, o);
        o.x = lerp(T.x, o.x, g); o.y = lerp(T.y, o.y, g); o.a = lerp(T.a, o.a, g);
        if (g < 0.5) o.c = T.c;
      }
    }
    o.a *= dim;
    // Handoff: every particle eases (staggered) into chapter 05's opening; exact at p = 1.
    if (handoff <= 0) return;
    const m = range(handoff * 1.5 - HS[i] * 0.5, 0, 1);
    if (m <= 0) return;
    engineVisual.place(i, E0, T);
    if (m >= 1) { o.x = T.x; o.y = T.y; o.a = T.a; o.c = T.c; o.s = T.s; return; }
    o.x = lerp(o.x, T.x, m); o.y = lerp(o.y, T.y, m); o.a = lerp(o.a, T.a, m); o.s = lerp(o.s, T.s, m);
    if (m >= 0.5) o.c = T.c;
  },
};
