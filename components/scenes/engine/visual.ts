import { clamp } from "@/lib/landing/math";
import { worldVisual } from "@/components/scenes/world/visual";
import { BRIDGE, DIM, EN, INK, KO, lerp, range, rnd, type Frame, type Point, type SceneVisual } from "@/lib/cinematic/visual";
import { BEATS } from "./beats";

/** The runtime, in signal order. `stage` links a node to its NS-01 latency stage; `swap` marks provider slots. */
export const ENGINE_NODES = [
  { name: "VOICE IN", stage: 0, swap: false },
  { name: "VAD · TURN", stage: 1, swap: false },
  { name: "STT", stage: 2, swap: true },
  { name: "VOICE AGENT · LLM", stage: 3, swap: true },
  { name: "TTS", stage: 4, swap: true },
  { name: "VOICE OUT", stage: 5, swap: false },
] as const;

/*
 * 05 — the SVG (system/) draws the runtime through a travelling camera; the canvas is only atmosphere
 * and depth around it.
 * p = 0: chapter 04's wave as a thin, calm haze line at h/2 (cyan, a few magenta/gold) plus dim dust
 *   (same seeds and drift as chapters 03/04, so the seam barely moves it).
 * enter/dive: the line streams past the camera and spreads into depth: near particles accelerate
 *   off-screen and grow, far ones settle into a sparse dust field.
 * vad → tts: very sparse dust with parallax; the camera drifts left (vad), up (stt), back (understand),
 *   orbits (reason), zooms out and back (act), drifts again (respond/tts).
 * runtime → capabilities: pull back; the field compresses toward the centre band, a faint field with depth.
 * exit: dust streams outward from the centre. multiply: every particle eases (staggered) into
 *   chapter 06's first frame (exact at p = 1).
 */

const [, DIVE_END] = BEATS.dive;
const [VAD_START, VAD_END] = BEATS.vad;
const [STT_START, STT_END] = BEATS.stt;
const [UND_START, UND_END] = BEATS.understand;
const [REASON_START, REASON_END] = BEATS.reason;
const [ACT_START, ACT_END] = BEATS.act;
const [RESPOND_START] = BEATS.respond;
const [, TTS_END] = BEATS.tts;
const [RUNTIME_START] = BEATS.runtime;
const [EXIT_START] = BEATS.exit;
const [MULTIPLY_START, MULTIPLY_END] = BEATS.multiply;

// ---------------------------------------------------------------- per-particle statics

let LINE = new Uint8Array(0), COL = new Uint8Array(0);
/** Field position (fractions of the viewport around its centre), depth (0 far – 1 near), lit (0–1). */
let FX = new Float64Array(0), FY = new Float64Array(0), Z = new Float64Array(0), LIT = new Float64Array(0);
/** Line position, line jitter, phase, stagger, conversation dust alpha and size. */
let U = new Float64Array(0), JIT = new Float64Array(0), PH = new Float64Array(0), SE = new Float64Array(0);
let DA = new Float64Array(0), DS = new Float64Array(0);

function statics(n: number) {
  LINE = new Uint8Array(n); COL = new Uint8Array(n);
  FX = new Float64Array(n); FY = new Float64Array(n); Z = new Float64Array(n); LIT = new Float64Array(n);
  U = new Float64Array(n); JIT = new Float64Array(n); PH = new Float64Array(n); SE = new Float64Array(n);
  DA = new Float64Array(n); DS = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const line = rnd(i, 101) < 0.42;
    LINE[i] = line ? 1 : 0;
    Z[i] = rnd(i, 104);
    LIT[i] = rnd(i, 105);
    SE[i] = rnd(i, 84);
    // Same phase seed as chapter 04's dust, so its drift carries straight on.
    PH[i] = rnd(i, 83) * Math.PI * 2;
    if (line) {
      U[i] = rnd(i, 80);
      JIT[i] = rnd(i, 81) + rnd(i, 82) - 1;
      // Wider than the viewport, so camera drift never shows an empty edge.
      FX[i] = rnd(i, 102) * 1.3 - 0.65;
      FY[i] = rnd(i, 103) * 1.3 - 0.65;
      const c = rnd(i, 106);
      COL[i] = c < 0.8 ? KO : c < 0.92 ? EN : BRIDGE;
      DA[i] = 0; DS[i] = 1;
    } else {
      // Dust sits where chapters 03/04 left it (same seeds).
      FX[i] = rnd(i, 62) - 0.5;
      FY[i] = rnd(i, 63) - 0.5;
      const lit = rnd(i, 89);
      DA[i] = lit < 0.45 ? 0.025 + 0.05 * (lit / 0.45) : 0;
      DS[i] = 0.7 + 0.4 * rnd(i, 90);
      COL[i] = rnd(i, 68) < 0.35 ? INK : DIM;
    }
  }
}

// ---------------------------------------------------------------- per-frame cache

let cp = NaN, ct = NaN, cw = NaN, ch = NaN, cn = -1, cport = false;
/** Chapter 06's first frame (p = 0, same t). Reused, never reallocated. */
const W0: Frame = { w: 0, h: 0, t: 0, p: 0, n: 0, portrait: false, u: 1 };
const T: Point = { x: 0, y: 0, a: 0, c: 0, s: 1 };
/** Camera offset (fractions of the viewport), dive zoom, act zoom, pull-back, exit, close-up, multiply. */
let camX = 0, camY = 0, diveZ = 0, actZ = 0, pull = 0, exit = 0, close = 0, multiply = 0, twinkleT = 0;

function update(f: Frame) {
  if (f.p === cp && f.t === ct && f.w === cw && f.h === ch && f.n === cn && f.portrait === cport) return;
  if (f.n !== cn) statics(f.n);
  cp = f.p; ct = f.t; cw = f.w; ch = f.h; cn = f.n; cport = f.portrait;
  const p = f.p;
  W0.w = f.w; W0.h = f.h; W0.t = f.t; W0.p = 0; W0.n = f.n; W0.portrait = f.portrait; W0.u = f.u;
  // The camera's travel, driven by scroll; each beat adds its own direction.
  const orbit = range(p, REASON_START, REASON_END) * Math.PI * 2;
  const wander = range(p, 0.02, DIVE_END);
  camX = -0.06 * range(p, VAD_START, VAD_END)
    + 0.035 * range(p, UND_START, UND_END)
    + 0.04 * Math.sin(orbit)
    + 0.03 * range(p, RESPOND_START, TTS_END)
    + wander * 0.006 * Math.sin(f.t * 0.07);
  camY = -0.05 * range(p, STT_START, STT_END)
    + 0.03 * (1 - Math.cos(orbit))
    + 0.02 * range(p, RESPOND_START, TTS_END)
    + wander * 0.005 * Math.sin(f.t * 0.05 + 1);
  diveZ = range(p, 0.02, DIVE_END);
  actZ = Math.sin(Math.PI * range(p, ACT_START, ACT_END));
  close = range(p, 0.03, 0.14);
  pull = range(p, RUNTIME_START, RUNTIME_START + 0.08);
  exit = range(p, EXIT_START - 0.01, MULTIPLY_END - 0.02);
  multiply = clamp((p - MULTIPLY_START) / (MULTIPLY_END - MULTIPLY_START));
  twinkleT = f.t * 0.6;
}

// ---------------------------------------------------------------- formations

/** The p = 0 haze line: chapter 04's wave, calm, cyan-dominant. */
function placeLine(i: number, f: Frame, o: Point) {
  const u = U[i];
  o.x = lerp(f.w * 0.02, f.w * 0.98, u);
  o.y = f.h / 2 + JIT[i] * f.u * 0.006 + Math.sin(f.t * 0.11 + PH[i]) * 1.2;
  o.a = 0.12 * Math.sin(Math.PI * u) ** 0.5;
  o.c = COL[i];
  o.s = 1;
}

/** The dust field seen through the camera at this frame. */
function placeField(i: number, f: Frame, o: Point) {
  const z = Z[i], par = 0.25 + 0.75 * z;
  const bx = FX[i] + Math.sin(f.t * 0.035 + PH[i]) * 0.012 - camX * par;
  const by = FY[i] + Math.cos(f.t * 0.028 + PH[i] * 1.3) * 0.01 - camY * par;
  // Inside the voice the near dust is a little closer; act zooms out and back; the pull-back compresses
  // the field toward the centre band (far dust most); exit streams it outward, near dust fastest.
  let k = (1 + 0.25 * z * diveZ) * (1 - 0.14 * actZ * par);
  const ex = exit * exit * (0.4 + 2.6 * z * z);
  k *= 1 + ex;
  const kx = k * lerp(1, 0.78 + 0.12 * z, pull), ky = k * lerp(1, 0.42 + 0.2 * z, pull);
  o.x = f.w / 2 + bx * f.w * kx;
  o.y = f.h / 2 + by * f.h * ky;
  const tw = 0.8 + 0.2 * Math.sin(twinkleT + PH[i] * 3);
  const near = LIT[i] < 0.28 ? (0.02 + 0.07 * z) * tw : 0;
  const far = LIT[i] < 0.55 ? (0.03 + 0.08 * z) * tw : 0;
  let a = lerp(LINE[i] ? near : lerp(DA[i] * tw, near, close), far, pull);
  a *= 1 - 0.45 * exit;
  o.a = a;
  o.c = COL[i];
  const s = 0.7 + 0.6 * z;
  o.s = (LINE[i] ? s : lerp(DS[i], s, close)) * (1 + 0.5 * exit * z);
}

/** Enter/dive: the line streams past the camera and spreads into depth, then settles into the field. */
function placeDive(i: number, f: Frame, o: Point) {
  const e = range(f.p, 0.004 + SE[i] * 0.03, DIVE_END - 0.03 + SE[i] * 0.03);
  if (e <= 0) { placeLine(i, f, o); return; }
  placeField(i, f, o);
  if (e >= 1) return;
  const fx = o.x, fy = o.y, fa = o.a, fs = o.s;
  placeLine(i, f, o);
  const z = Z[i];
  const k = 1 + e * e * (0.2 + 3.5 * z * z);
  const dx = f.w / 2 + (o.x - f.w / 2) * k;
  const dy = f.h / 2 + (o.y - f.h / 2 + e * FY[i] * f.h * 0.35) * k;
  // Near particles fly off and fade before they rejoin the field.
  const da = o.a * (1 - range(e, 0.25, 0.7) * range(z, 0.4, 0.8));
  const g = range(e, 0.55, 1);
  o.x = lerp(dx, fx, g); o.y = lerp(dy, fy, g);
  o.a = lerp(da, fa * g * g, g);
  o.s = lerp(1 + 0.8 * z * e, fs, g);
}

/** 05 — atmosphere and depth around the runtime the SVG draws. */
export const engineVisual: SceneVisual = {
  morph: 0, // chapter 04 (conversation/visual.ts) ends exactly on this chapter's first frame.
  place(i, f, o) {
    update(f);
    if (LINE[i]) placeDive(i, f, o);
    else placeField(i, f, o);
    // Multiply: every particle eases (staggered) into chapter 06's opening; exact at p = 1.
    if (multiply <= 0) return;
    const m = range(multiply * 1.5 - SE[i] * 0.5, 0, 1);
    if (m <= 0) return;
    worldVisual.place(i, W0, T);
    if (m >= 1) { o.x = T.x; o.y = T.y; o.a = T.a; o.c = T.c; o.s = T.s; return; }
    o.x = lerp(o.x, T.x, m); o.y = lerp(o.y, T.y, m); o.a = lerp(o.a, T.a, m); o.s = lerp(o.s, T.s, m);
    if (m >= 0.5) o.c = T.c;
  },
};
