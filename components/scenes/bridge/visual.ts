import { clamp, frac } from "@/lib/landing/math";
import { conversationVisual } from "@/components/scenes/conversation/visual";
import { BEATS } from "./beats";
import { bridgeGeometry } from "./geometry";
import { BRIDGE, DIM, EN, INK, KO, lerp, range, rnd, type Frame, type Point, type SceneVisual } from "@/lib/cinematic/visual";

/**
 * @deprecated The stations are drawn by the SVG system now; kept only for the scene's legacy list.
 */
export const STATIONS = [
  { at: 0.17, name: "SPEECH" },
  { at: 0.37, name: "UNDERSTAND" },
  { at: 0.57, name: "REASON" },
  { at: 0.77, name: "RESPOND" },
] as const;

/*
 * 03 — the canvas is the world AROUND the Voice Labs system (the SVG draws the system itself).
 * stabilize/align: chapter 02's bridge loosens; cables thin, a few strands stay as a faint haze line.
 * enter: the camera moves into the bridge; particles stream outward with depth, the centre clears.
 * signal → tagline: almost empty — sparse dim dust, a cyan → magenta haze along the signal line.
 * concept → statement: sparse dust; the haze gathers at the edges (incoming / outgoing).
 * handoff: every particle eases into chapter 04's opening formation.
 */

const [, ALIGN_END] = BEATS.align;
const [ENTER_START, ENTER_END] = BEATS.enter;
const [SIGNAL_START] = BEATS.signal;
const [CONCEPT_START, CONCEPT_END] = BEATS.concept;
const [HANDOFF_START, HANDOFF_END] = BEATS.handoff;

// ---------------------------------------------------------------- per-frame cache

let cp = NaN, ct = NaN, cw = NaN, ch = NaN, cn = -1, cport = false;
let gx0 = 0, gx1 = 0, gbase = 0, glift = 0;
/** Chapter 02's last frame / chapter 04's first frame (p = 0, same t). Reused, never reallocated. */
const F0: Frame = { w: 0, h: 0, t: 0, p: 0, n: 0, portrait: false, u: 1 };
const T: Point = { x: 0, y: 0, a: 0, c: 0, s: 1 };
// Beat weights for the current frame.
let loosen = 0, collapse = 0, hazeThin = 0, hazeDip = 0, flatten = 0, clear = 0, visT = 0, handoff = 0;
let zx = 0, zy = 0, lineY = 0;

// Per-particle statics (rebuilt when n changes).
let ROLE = new Uint8Array(0); // 0 cable, 1 signal, 2 end, 3 haze (a cable that stays as the signal-line haze)
let R2 = new Float64Array(0), CABLE = new Float64Array(0), SE = new Float64Array(0), Z = new Float64Array(0), K = new Float64Array(0);
let BX = new Float64Array(0), BY = new Float64Array(0), PH = new Float64Array(0), DA = new Float64Array(0), DS = new Float64Array(0), V = new Float64Array(0), HS = new Float64Array(0);
let EX = new Float64Array(0), EY = new Float64Array(0), JIT = new Float64Array(0);
let DC = new Uint8Array(0);

function statics(n: number) {
  ROLE = new Uint8Array(n); DC = new Uint8Array(n);
  R2 = new Float64Array(n); CABLE = new Float64Array(n); SE = new Float64Array(n); Z = new Float64Array(n); K = new Float64Array(n);
  BX = new Float64Array(n); BY = new Float64Array(n); PH = new Float64Array(n); DA = new Float64Array(n); DS = new Float64Array(n);
  V = new Float64Array(n); HS = new Float64Array(n); EX = new Float64Array(n); EY = new Float64Array(n); JIT = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r1 = rnd(i, 1), r3 = rnd(i, 3);
    ROLE[i] = r1 < 0.18 ? (rnd(i, 67) < 0.55 ? 3 : 0) : r1 < 0.62 ? 1 : 2;
    R2[i] = rnd(i, 2);
    CABLE[i] = Math.floor(r3 * 3) - 1;
    SE[i] = rnd(i, 61);
    // Depth: z < 0.4 is near the camera (accelerates off-screen, grows), the rest drift.
    const z = rnd(i, 60);
    Z[i] = z;
    K[i] = z < 0.4 ? 2.5 + 6 * (0.4 - z) / 0.4 : 0.15 + 0.6 * z;
    BX[i] = rnd(i, 62); BY[i] = rnd(i, 63); PH[i] = rnd(i, 64) * Math.PI * 2;
    DA[i] = 0.05 + 0.07 * rnd(i, 66);
    DS[i] = 0.6 + 0.45 * (1 - z);
    DC[i] = rnd(i, 68) < 0.35 ? INK : DIM;
    V[i] = rnd(i, 65);
    HS[i] = rnd(i, 51);
    EX[i] = rnd(i, 69);
    EY[i] = rnd(i, 70) + rnd(i, 71) - 1;
    JIT[i] = rnd(i, 72) + rnd(i, 73) - 1;
  }
}

function update(f: Frame) {
  if (f.p === cp && f.t === ct && f.w === cw && f.h === ch && f.n === cn && f.portrait === cport) return;
  if (f.n !== cn) statics(f.n);
  cp = f.p; ct = f.t; cw = f.w; ch = f.h; cn = f.n; cport = f.portrait;
  const G = bridgeGeometry(f.w, f.h, f.portrait);
  gx0 = G.x0; gx1 = G.x1; gbase = G.base; glift = G.lift;
  F0.w = f.w; F0.h = f.h; F0.t = f.t; F0.p = 0; F0.n = f.n; F0.portrait = f.portrait; F0.u = f.u;
  const p = f.p;
  loosen = range(p, 0, ALIGN_END);
  collapse = range(p, BEATS.align[0], ALIGN_END);
  hazeThin = range(p, 0.04, ALIGN_END);
  hazeDip = range(p, ENTER_START, 0.24) * (1 - range(p, 0.27, 0.34));
  flatten = range(p, 0.22, 0.36);
  clear = range(p, ENTER_START, ENTER_END) * (1 - 0.6 * range(p, CONCEPT_START, CONCEPT_END));
  visT = lerp(0.35, 0.62, range(p, CONCEPT_START, 0.68));
  handoff = clamp((p - HANDOFF_START) / (HANDOFF_END - HANDOFF_START));
  // The camera flies toward the bridge's apex.
  zx = f.w / 2; zy = G.base - G.lift;
  // The SVG system flattens the bridge onto the screen centre line; the haze follows it.
  lineY = f.h / 2;
}

// ---------------------------------------------------------------- chapter 02's last frame (verbatim)

let SNAP = 0, LAST_U = 0;

/** Offset from the bridge line for a signal at `u`: wave → tokens → a thinking cloud → wave again. */
function signalDy(u: number, t: number, r: number, fu: number) {
  const wave = Math.sin(u * 90 + t * 8 + r * 2) * fu * 0.022 * (0.4 + 0.6 * Math.sin(t * 2.3 + u * 9) ** 2);
  const token = ((r * 7) % 1 - 0.5) * 3;
  const think = (r - 0.5) * fu * 0.12 * Math.sin(Math.PI * range(u, 0.47, 0.67));
  const inUnderstand = range(u, 0.27, 0.31) * (1 - range(u, 0.45, 0.5));
  const inReason = range(u, 0.47, 0.5) * (1 - range(u, 0.64, 0.69));
  const inWave = 1 - Math.max(inUnderstand, inReason);
  SNAP = inUnderstand;
  return wave * inWave + token * inUnderstand + think * inReason;
}

/**
 * The bridge exactly as chapter 02 hands it over (distance/visual.ts eases into `place` at p = 0).
 * Do not change: any edit breaks the seam between chapters 02 and 03.
 */
function placeOpening(i: number, f: Frame, o: Point) {
  const r1 = rnd(i, 1), r2 = rnd(i, 2), r3 = rnd(i, 3);
  o.s = 1;
  if (r1 < 0.18) {
    const cable = Math.floor(r3 * 3) - 1;
    o.x = lerp(gx0, gx1, r2);
    o.y = gbase - Math.sin(Math.PI * r2) * glift + cable * 5 + Math.sin(r2 * 40 + f.t) * 0.8;
    o.c = BRIDGE;
    o.a = 0.5;
    return;
  }
  if (r1 < 0.62) {
    const back = (i & 1) === 1;
    const u = frac(f.t * (0.05 + r3 * 0.02) + r2);
    LAST_U = u;
    const dy = signalDy(u, f.t, r3, f.u);
    const snap = SNAP;
    const step = 0.011;
    const uu = lerp(u, Math.round(u / step) * step, snap);
    const v = back ? 1 - uu : uu;
    o.x = lerp(gx0, gx1, v);
    o.y = gbase - Math.sin(Math.PI * v) * glift - 14 + (back ? 22 : 0) + dy;
    const from = back ? EN : KO, to = back ? KO : EN;
    o.c = u < 0.47 ? from : u < 0.67 ? BRIDGE : to;
    o.a = range(f.p, 0.25, 0.42) * (back ? range(f.p, 0.62, 0.8) * 0.6 : 0.9) * Math.sin(Math.PI * u) ** 0.4;
    o.s = snap > 0.5 ? 1.4 : 1;
    return;
  }
  const ex = (i & 1) ? gx1 : gx0;
  const ang = r2 * Math.PI * 2 + f.t * 0.3;
  const rad = f.u * (0.035 + r3 * 0.03);
  o.x = ex + Math.cos(ang) * rad;
  o.y = gbase + Math.sin(ang) * rad;
  o.c = (i & 1) ? EN : KO;
  o.a = 0.3 + 0.5 * (1 - r3);
}

// ---------------------------------------------------------------- the world around the system

/** The haze: a few strands that stay along the bridge, flatten into the signal line, then gather at the edges. */
function placeHaze(i: number, f: Frame, o: Point) {
  const p = f.p, u = R2[i], left = u < 0.5;
  const drift = Math.sin(f.t * 0.07 + PH[i]) * 0.012 * flatten;
  const uu = u + drift;
  // On the arc (the same strand chapter 02 laid) → a horizontal line across the screen.
  const ax = lerp(gx0, gx1, uu);
  const ay = gbase - Math.sin(Math.PI * uu) * glift + CABLE[i] * 5 * (1 - collapse) + Math.sin(u * 40 + f.t) * 0.8;
  const lx = lerp(f.w * 0.02, f.w * 0.98, uu);
  const ly = lineY + JIT[i] * f.u * 0.014 + Math.sin(f.t * 0.11 + PH[i]) * 1.5;
  let x = lerp(ax, lx, flatten), y = lerp(ay, ly, flatten);
  const taper = 0.35 + 0.65 * Math.sin(Math.PI * clamp(uu)) ** 0.5;
  let a = lerp(0.5, 0.14, hazeThin) * (1 - 0.75 * hazeDip) * lerp(1, taper, flatten);
  // Gold while it is the bridge; cyan on the incoming half, magenta on the outgoing half once the camera is in.
  o.c = p < 0.25 + SE[i] * 0.02 ? BRIDGE : left ? KO : EN;
  // Concept onwards: the haze gathers at the edges, where speech comes in and the answer goes out.
  const me = range(p, CONCEPT_START - 0.01 + SE[i] * 0.05, CONCEPT_START + 0.08 + SE[i] * 0.05);
  if (me > 0) {
    let ex: number, ey: number;
    if (f.portrait) {
      ex = f.w * 0.5 + EY[i] * f.w * 0.36 + Math.sin(f.t * 0.09 + PH[i]) * 4;
      ey = left ? f.h * (0.03 + EX[i] * 0.1) : f.h * (0.97 - EX[i] * 0.1);
    } else {
      ex = left ? f.w * (0.015 + EX[i] * 0.1) : f.w * (0.985 - EX[i] * 0.1);
      ey = lineY + EY[i] * f.u * 0.14 + Math.sin(f.t * 0.09 + PH[i]) * 4;
    }
    const ea = (0.06 + 0.05 * EX[i]) * (0.75 + 0.25 * Math.sin(f.t * 0.8 + PH[i]));
    x = lerp(x, ex, me); y = lerp(y, ey, me); a = lerp(a, ea, me);
  }
  o.x = x; o.y = y; o.a = a; o.s = 1;
}

/** Dust: sparse, dim, drifting; pushed away from the centre while the system takes the stage. */
function placeDust(i: number, f: Frame, o: Point) {
  const z = Z[i];
  const bx = BX[i] + Math.sin(f.t * 0.035 + PH[i]) * 0.015 * (0.4 + z);
  const by = BY[i] + Math.cos(f.t * 0.028 + PH[i] * 1.3) * 0.012 * (0.4 + z);
  const cx = f.w * 0.5, cy = f.h * 0.5;
  const dx = bx * f.w - cx, dy = by * f.h - cy;
  const r = Math.sqrt(dx * dx + dy * dy) / f.u;
  const r2 = r + clear * 0.3 * Math.max(0, 1 - r / 0.9);
  const k = r > 1e-4 ? r2 / r : 1;
  o.x = cx + dx * k;
  o.y = cy + dy * k;
  const vis = range(visT - V[i], 0, 0.06);
  const centre = 1 - clear * 0.8 * Math.max(0, 1 - r2 / 0.45);
  const twinkle = 0.8 + 0.2 * Math.sin(f.t * 0.6 + PH[i] * 3);
  // Fades in only after this particle has streamed out (see the enter phase).
  const fadeIn = range(f.p, 0.28 + SE[i] * 0.04, SIGNAL_START + 0.06 + SE[i] * 0.04);
  o.a = DA[i] * vis * centre * twinkle * fadeIn;
  o.c = DC[i];
  o.s = DS[i];
}

/** Stabilize/align (loosening) and enter (streaming out past the camera). */
function placeOpeningLoosened(i: number, f: Frame, o: Point, e: number) {
  placeOpening(i, F0, o);
  const p = f.p, role = ROLE[i];
  if (role === 0) {
    // The SVG takes over the bridge line: the cables collapse into one strand and thin out.
    o.y -= CABLE[i] * 5 * collapse;
    o.a *= 1 - range(p, 0.03 + SE[i] * 0.1, 0.08 + SE[i] * 0.1);
  } else if (role === 1) {
    // Speech keeps flowing along the arc, a little, then lets go.
    o.a = 0.22 * range(p, 0.01, 0.1) * Math.sin(Math.PI * LAST_U) ** 0.4;
  } else {
    // The endpoint rings soften and widen.
    const ex = (i & 1) ? gx1 : gx0;
    o.x = ex + (o.x - ex) * (1 + 0.9 * loosen);
    o.y = gbase + (o.y - gbase) * (1 + 0.9 * loosen);
    o.a *= 1 - 0.65 * loosen;
  }
  if (e <= 0) return;
  // 2.5D: out from the apex; near particles accelerate off-screen and grow, far ones drift.
  const dx = o.x - zx, dy = o.y - zy;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const kk = K[i], e2 = e * e;
  const push = e2 * f.u * 0.15 * kk;
  o.x = zx + dx * (1 + e2 * kk) + (dx / d) * push;
  o.y = zy + dy * (1 + e2 * kk) + (dy / d) * push;
  o.s *= 1 + Math.min(1.6, e * kk * 0.25);
  o.a *= Z[i] < 0.4 ? (1 + 0.6 * e) * (1 - range(e, 0.5, 1)) : 1 - range(e, 0.35, 0.9);
}

export const bridgeVisual: SceneVisual = {
  // Chapter 02 ends exactly on this chapter's first frame.
  morph: 0,
  place(i, f, o) {
    update(f);
    const p = f.p;
    if (p <= 0) {
      placeOpening(i, F0, o);
      return;
    }
    if (ROLE[i] === 3) placeHaze(i, f, o);
    else {
      // Each particle streams out at its own moment inside `enter`, then reappears (invisibly) as dust.
      const e = range(p, ENTER_START + SE[i] * 0.04, ENTER_START + 0.08 + SE[i] * 0.04);
      if (e < 1) placeOpeningLoosened(i, f, o, e);
      else placeDust(i, f, o);
    }
    // Handoff: every particle eases (staggered) into chapter 04's opening; exact at p = 1.
    if (handoff <= 0) return;
    const m = range(handoff * 1.5 - HS[i] * 0.5, 0, 1);
    if (m <= 0) return;
    conversationVisual.place(i, F0, T);
    if (m >= 1) { o.x = T.x; o.y = T.y; o.a = T.a; o.c = T.c; o.s = T.s; return; }
    o.x = lerp(o.x, T.x, m); o.y = lerp(o.y, T.y, m); o.a = lerp(o.a, T.a, m); o.s = lerp(o.s, T.s, m);
    if (m >= 0.5) o.c = T.c;
  },
};
