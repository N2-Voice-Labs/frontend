import { clamp, frac } from "@/lib/landing/math";
import { bridgeVisual } from "@/components/scenes/bridge/visual";
import { silenceVisual } from "@/components/scenes/silence/visual";
import { BRIDGE, DIM, EN, INK, KO, PALETTE, lerp, range, rnd, window01, type Frame, type Point, type SceneVisual } from "@/lib/cinematic/visual";
import { BEATS, LANGUAGES } from "./beats";

/**
 * 02 — THE DISTANCE. Chapter 01's spread particles gather into two voices seen very close (KO, EN); the
 * camera pulls back through a world of voices with depth, gathered into language worlds whose words
 * surface one by one; signals reach between worlds and lose coherence on the way; everything slows;
 * most voices fall away; one signal reaches the other side and holds; more links follow, line up and
 * become the bridge chapter 03 opens on.
 *
 * Particles live in a world space (units of f.u, origin at the screen centre at zoom 1) and are projected
 * through a camera: screen = centre + world × u × zoom^(z^0.7), so near voices (large z) rush past when
 * the camera is close and far ones barely move. All motion runs on a film clock that slows with the beat.
 */

const B = BEATS;

/** Language worlds, aligned with LANGUAGES. Desktop composition in u units; portrait transposes it. */
type World = {
  x: number; y: number;
  /** Gaussian spread. */
  sx: number; sy: number;
  /** Depth: < 1 far, > 1 near. */
  z: number;
  /** Share of the particles. */
  wt: number;
  /** When it surfaces during the pull-back (0–1 of the reveal). */
  appear: number;
  /** Where it settles along the bridge band (0 = KO end, 1 = EN end), and its vertical offset there. */
  band: number; vo: number;
};

const WORLDS: readonly World[] = [
  /* ko */ { x: -0.12, y: 0.01, sx: 0.05, sy: 0.045, z: 1, wt: 0.13, appear: 0, band: 0, vo: 0 },
  /* en */ { x: 0.12, y: -0.01, sx: 0.05, sy: 0.045, z: 1, wt: 0.13, appear: 0, band: 1, vo: 0 },
  /* ja */ { x: -0.4, y: -0.19, sx: 0.07, sy: 0.05, z: 1.15, wt: 0.09, appear: 0.05, band: 0.2, vo: -0.8 },
  /* es */ { x: 0.38, y: 0.17, sx: 0.06, sy: 0.05, z: 1.25, wt: 0.08, appear: 0.1, band: 0.74, vo: 0.7 },
  /* ar */ { x: 0.5, y: -0.3, sx: 0.05, sy: 0.04, z: 0.8, wt: 0.07, appear: 0.35, band: 0.64, vo: -0.9 },
  /* hi */ { x: -0.48, y: 0.3, sx: 0.08, sy: 0.05, z: 0.9, wt: 0.07, appear: 0.3, band: 0.3, vo: 0.9 },
  /* fr */ { x: 0.92, y: -0.06, sx: 0.07, sy: 0.06, z: 1.4, wt: 0.05, appear: 0.55, band: 0.9, vo: -0.5 },
  /* zh */ { x: -0.9, y: 0.02, sx: 0.1, sy: 0.08, z: 0.7, wt: 0.09, appear: 0.5, band: 0.1, vo: 0.6 },
  /* ru */ { x: 0.12, y: 0.44, sx: 0.06, sy: 0.03, z: 0.6, wt: 0.04, appear: 0.6, band: 0.56, vo: 1 },
  /* kk */ { x: -0.12, y: -0.42, sx: 0.04, sy: 0.03, z: 0.5, wt: 0.03, appear: 0.65, band: 0.42, vo: -1 },
  /* tr */ { x: 0.8, y: 0.44, sx: 0.05, sy: 0.04, z: 1.5, wt: 0.05, appear: 0.7, band: 0.84, vo: 0.4 },
];
const NW = WORLDS.length;
/** Loose voices between the worlds (the remaining ~17%). */
const SCAT = NW;

/** Failed attempts: [from, to, break point (0–1 of the way), bend, speed]. */
const ATTEMPTS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 1, 0.9, 0.16, 0.13], [1, 2, 0.6, -0.14, 0.17], [3, 4, 0.88, 0.2, 0.12], [5, 6, 0.5, -0.12, 0.19],
  [7, 8, 0.7, 0.18, 0.15], [2, 3, 0.78, -0.2, 0.14], [4, 0, 0.66, 0.13, 0.16], [10, 9, 0.55, -0.17, 0.18],
  [6, 7, 0.47, 0.12, 0.2], [8, 5, 0.83, -0.15, 0.13], [1, 3, 0.72, 0.22, 0.15], [9, 4, 0.62, -0.18, 0.17],
];
const NA = ATTEMPTS.length;

/** Successful links: 0 is KO → EN; the rest join a left world to a right world. */
const NL = 40;
const LEFT = [0, 2, 5, 7, 9], RIGHT = [1, 3, 4, 6, 8, 10];
const LA = new Uint8Array(NL), LB = new Uint8Array(NL);
const LOFF = new Float32Array(NL * 5); // a dx, a dy, b dx, b dy (u units), bend
for (let j = 0; j < NL; j++) {
  LA[j] = j === 0 ? 0 : LEFT[Math.floor(rnd(j, 71) * LEFT.length)];
  LB[j] = j === 0 ? 1 : RIGHT[Math.floor(rnd(j, 72) * RIGHT.length)];
  const s = j === 0 ? 0 : 1;
  LOFF[j * 5] = (rnd(j, 73) - 0.5) * 0.08 * s;
  LOFF[j * 5 + 1] = (rnd(j, 74) - 0.5) * 0.06 * s;
  LOFF[j * 5 + 2] = (rnd(j, 75) - 0.5) * 0.08 * s;
  LOFF[j * 5 + 3] = (rnd(j, 76) - 0.5) * 0.06 * s;
  LOFF[j * 5 + 4] = j === 0 ? -0.1 : (rnd(j, 77) - 0.5) * 0.4;
}

/** The first link: silence for the first 40% of the beat, then the signal travels and arrives. */
const LEAD_GO = B.firstLink[0] + (B.firstLink[1] - B.firstLink[0]) * 0.4;
const LEAD_ARRIVE = B.firstLink[0] + (B.firstLink[1] - B.firstLink[0]) * 0.85;
const LEADS = 5;

// ---------------------------------------------------------------------------------------------------
// Per-particle static attributes (rebuilt when the particle count changes).

let PN = -1;
let PW = new Uint8Array(0); // world index (SCAT = loose)
let OX = new Float32Array(0), OY = OX; // offset from the world centre, desktop, u units
let Z = OX, ZE = OX; // depth and depth^0.7
let BA = OX; // base alpha
let AP = OX; // reveal threshold
let PH = OX; // phase
let SIG = new Int8Array(0); // attempt path (-1 none)
let LNK = new Int8Array(0); // link index (-1 none)
let LEAD = new Int8Array(0); // first-link signal (0 = head, 1.. = trail), -1 none

function gauss(a: number, b: number) {
  const g = Math.sqrt(-2 * Math.log(Math.max(a, 1e-3))) * Math.cos(Math.PI * 2 * b);
  return Math.max(-2.6, Math.min(2.6, g));
}

function prepare(n: number) {
  if (n === PN) return;
  PN = n;
  PW = new Uint8Array(n);
  OX = new Float32Array(n); OY = new Float32Array(n);
  Z = new Float32Array(n); ZE = new Float32Array(n);
  BA = new Float32Array(n); AP = new Float32Array(n); PH = new Float32Array(n);
  SIG = new Int8Array(n).fill(-1); LNK = new Int8Array(n).fill(-1); LEAD = new Int8Array(n).fill(-1);
  let leads = 0;
  for (let i = 0; i < n; i++) {
    // KO keeps the even particles and EN the odd ones, as in chapters 01 and 03.
    const r = rnd(i, 30);
    let k = SCAT;
    if (r < 0.26) k = i & 1;
    else {
      let acc = 0.26;
      for (let q = 2; q < NW; q++) { acc += WORLDS[q].wt; if (r < acc) { k = q; break; } }
    }
    PW[i] = k;
    PH[i] = rnd(i, 37);
    if (k === SCAT) {
      OX[i] = (rnd(i, 35) - 0.5) * 2.5;
      OY[i] = (rnd(i, 36) - 0.5) * 1.45;
      Z[i] = 0.35 + 1.25 * rnd(i, 38) ** 1.4;
      AP[i] = 0.12 + 0.8 * rnd(i, 39);
      BA[i] = 0.1 + 0.32 * ((Z[i] - 0.35) / 1.25);
    } else {
      const W = WORLDS[k];
      // Two or three irregular lobes per world, gaussian inside each: a constellation, not a disc.
      const lobe = Math.floor(rnd(i, 34) * 3);
      const lx = (rnd(k, 61 + lobe) - 0.5) * W.sx * 2.2, ly = (rnd(k, 64 + lobe) - 0.5) * W.sy * 2.2;
      OX[i] = lx + gauss(rnd(i, 35), rnd(i, 36)) * W.sx * 0.7;
      OY[i] = ly + gauss(rnd(i, 40), rnd(i, 41)) * W.sy * 0.7;
      Z[i] = W.z * (1 + (rnd(i, 38) - 0.5) * 0.2);
      AP[i] = W.appear + rnd(i, 39) * 0.1;
      BA[i] = k <= 1 ? 0.45 + 0.4 * rnd(i, 42) : (0.16 + 0.42 * clamp((Z[i] - 0.35) / 1.25)) * (0.7 + 0.3 * rnd(i, 42));
    }
    ZE[i] = Z[i] ** 0.7;
    if (k === 0 && leads < LEADS) { LEAD[i] = leads++; continue; }
    if (rnd(i, 31) < 0.11) SIG[i] = Math.floor(rnd(i, 32) * NA);
    if (rnd(i, 43) < 0.3) {
      const q = rnd(i, 44);
      LNK[i] = q < 0.12 ? 0 : 1 + Math.min(NL - 2, Math.floor(((q - 0.12) / 0.88) * (NL - 1)));
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// Per-frame state.

let clock = 0, lastT = NaN;

const F1: Frame = { w: 0, h: 0, t: 0, p: 1, n: 0, portrait: false, u: 1 };
const F0: Frame = { w: 0, h: 0, t: 0, p: 0, n: 0, portrait: false, u: 1 };
const T: Point = { x: 0, y: 0, a: 0, c: 0, s: 1 };

const D = {
  p: NaN, w: 0, h: 0, t: NaN, n: 0, portrait: false,
  cx: 0, cy: 0, lnZoom: 0, dx: 0, dy: 0,
  reveal: 0, sigOn: 0, dim: 1, fall: 0, revive: 0, pulse: 0,
  leadU: 0, leadOn: 0, link0: 0, countF: 0, band: 0, conv: 0, fade: 0, cam: 0, gone: 0, final: 0,
  // Bridge geometry (chapter 03's).
  x0: 0, x1: 0, base: 0, lift: 0, bcx: 0, bcy: 0,
  /** Orientation-adjusted world centres (u units). */
  wx: new Float32Array(NW + 1), wy: new Float32Array(NW + 1),
  /** Screen-space shift per world (px) and on-screen centre / scale. */
  shx: new Float32Array(NW + 1), shy: new Float32Array(NW + 1),
  sx: new Float32Array(NW + 1), sy: new Float32Array(NW + 1), ss: new Float32Array(NW + 1),
  /** Attempt paths and links: start, control, end (px). */
  ap: new Float32Array(NA * 6), lp: new Float32Array(NL * 6),
};

/** Speed of the film clock: 1 → ~0.06 over `slow`, low through the statements, waking for the links. */
const speed = (p: number) => lerp(lerp(1, 0.06, range(p, B.slow[0], B.slow[1])), 0.55, range(p, B.links[0] - 0.005, B.links[0] + 0.04));

/** 1 → 3 → 10 → 40 links over the `links` beat. */
function linkCount(p: number) {
  const q = clamp((p - B.links[0] - 0.005) / (B.links[1] - B.links[0] - 0.005));
  return q < 1 / 3 ? lerp(1, 3, q * 3) : q < 2 / 3 ? lerp(3, 10, (q - 1 / 3) * 3) : lerp(10, NL, (q - 2 / 3) * 3);
}

let BX = 0, BY = 0, NX = 0, NY = 0;
/** Point on the quadratic path at `off` in `arr`, plus the path's unit normal. */
function bez(arr: Float32Array, off: number, s: number) {
  const ax = arr[off], ay = arr[off + 1], cx = arr[off + 2], cy = arr[off + 3], bx = arr[off + 4], by = arr[off + 5];
  const m = 1 - s;
  BX = m * m * ax + 2 * m * s * cx + s * s * bx;
  BY = m * m * ay + 2 * m * s * cy + s * s * by;
  const tx = bx - ax, ty = by - ay, l = Math.hypot(tx, ty) || 1;
  NX = -ty / l; NY = tx / l;
}

function setPath(arr: Float32Array, off: number, ax: number, ay: number, bx: number, by: number, bend: number) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2, tx = bx - ax, ty = by - ay;
  arr[off] = ax; arr[off + 1] = ay;
  arr[off + 2] = mx - ty * bend; arr[off + 3] = my + tx * bend;
  arr[off + 4] = bx; arr[off + 5] = by;
}

function update(f: Frame) {
  const { w, h, p, t, n, portrait, u } = f;
  if (D.p === p && D.w === w && D.h === h && D.t === t && D.n === n) return;
  if (t !== D.t) {
    clock += Number.isNaN(lastT) ? 0 : Math.max(0, Math.min(0.1, t - lastT)) * speed(p);
    lastT = t;
  }
  D.p = p; D.w = w; D.h = h; D.t = t; D.n = n; D.portrait = portrait;
  prepare(n);
  F1.w = F0.w = w; F1.h = F0.h = h; F1.t = F0.t = t; F1.n = F0.n = n; F1.portrait = F0.portrait = portrait; F1.u = F0.u = u;

  D.cx = w / 2; D.cy = h / 2;
  // Camera: close on the pair (still readable as two voices), then a deliberate pull-back (eased, in log space).
  const near = Math.log(1.45), far = 0;
  D.lnZoom = lerp(lerp(Math.log(2.2), near, range(p, B.pullNear[0], B.pullNear[1])), far, range(p, B.pullWide[0], B.pullWide[1]));
  D.dx = Math.sin(clock * 0.11) * u * 0.012;
  D.dy = Math.cos(clock * 0.083 + 1) * u * 0.008;
  D.reveal = range(p, B.pullNear[0] - 0.01, B.pullWide[1]);
  D.sigOn = range(p, B.attempts[0], B.attempts[0] + 0.03) * (1 - range(p, B.attempts[1] - 0.02, B.attempts[1] + 0.01));
  D.dim = lerp(1, 0.55, range(p, B.statement1[0] - 0.01, B.statement1[0] + 0.02));
  D.fall = range(p, B.thesis[0], B.thesis[0] + 0.07);
  D.leadU = range(p, LEAD_GO, LEAD_ARRIVE);
  D.leadOn = range(p, LEAD_GO - 0.006, LEAD_GO);
  D.pulse = Math.sin(Math.PI * clamp((p - LEAD_ARRIVE) / 0.014));
  D.link0 = range(p, LEAD_ARRIVE, LEAD_ARRIVE + 0.012);
  D.countF = linkCount(p);
  D.revive = range(p, B.links[0], B.links[1]);
  D.band = range(p, B.links[0], B.bridge[0] + 0.03);
  D.conv = range(p, B.bridge[0], B.bridge[0] + 0.06);
  D.fade = range(p, B.bridge[0], B.bridge[0] + 0.05);
  D.cam = range(p, B.bridge[0], 1);
  D.gone = range(p, 0.95, 0.99);
  D.final = clamp((p - B.bridge[0]) / (1 - B.bridge[0]));

  // Chapter 03's bridge (same geometry as bridge/visual.ts).
  D.x0 = w * (portrait ? 0.08 : 0.12); D.x1 = w * (portrait ? 0.92 : 0.88);
  D.base = h * (portrait ? 0.6 : 0.64); D.lift = h * 0.09;
  D.bcx = w / 2; D.bcy = D.base - D.lift * 0.5;

  const zoomK = (z: number) => Math.exp(D.lnZoom * z ** 0.7);
  for (let k = 0; k <= NW; k++) {
    const W = k < NW ? WORLDS[k] : null;
    const x = W ? W.x : 0, y = W ? W.y : 0, z = W ? W.z : 1;
    D.wx[k] = portrait ? y * 1.1 : x;
    D.wy[k] = portrait ? x : y;
    const S = zoomK(z);
    const px = D.cx + D.wx[k] * u * S + D.dx * z, py = D.cy + D.wy[k] * u * S + D.dy * z;
    let sx = 0, sy = 0;
    if (W) {
      // Thesis: KO and EN hold faintly left/right (top/bottom); the rest drift outward.
      if (k <= 1) {
        const tx = portrait ? w / 2 : w * (k ? 0.68 : 0.32), ty = portrait ? h * (k ? 0.7 : 0.3) : h / 2;
        sx = (tx - px) * D.fall; sy = (ty - py) * D.fall;
      } else {
        sx = (px - D.cx) * 0.2 * D.fall; sy = (py - D.cy) * 0.2 * D.fall;
      }
      // Links: every world moves toward a horizontal band through the centre, ordered along the bridge.
      if (D.band > 0) {
        const bu = W.band;
        const tx = lerp(D.x0, D.x1, bu);
        const ty = D.base - Math.sin(Math.PI * bu) * D.lift + W.vo * h * 0.2 * (1 - D.conv);
        sx += (tx - (px + sx)) * D.band; sy += (ty - (py + sy)) * D.band;
      }
    }
    D.shx[k] = sx; D.shy[k] = sy;
    D.sx[k] = px + sx; D.sy[k] = py + sy; D.ss[k] = S;
  }

  for (let j = 0; j < NA; j++) {
    const A = ATTEMPTS[j];
    setPath(D.ap, j * 6, D.sx[A[0]], D.sy[A[0]], D.sx[A[1]], D.sy[A[1]], A[3]);
  }
  const G0y = D.base, apexY = D.base - 2 * D.lift;
  for (let j = 0; j < NL; j++) {
    const a = LA[j], b = LB[j], o = j * 5, cv = D.conv;
    const cable = ((j % 3) - 1) * 5;
    let ax = D.sx[a] + LOFF[o] * u, ay = D.sy[a] + LOFF[o + 1] * u;
    let bx = D.sx[b] + LOFF[o + 2] * u, by = D.sy[b] + LOFF[o + 3] * u;
    setPath(D.lp, j * 6, ax, ay, bx, by, LOFF[o + 4]);
    if (cv > 0) {
      // The links converge into one continuous bridge.
      const k = j * 6;
      ax = lerp(ax, D.x0, cv); ay = lerp(ay, G0y + cable, cv);
      bx = lerp(bx, D.x1, cv); by = lerp(by, G0y + cable, cv);
      D.lp[k] = ax; D.lp[k + 1] = ay; D.lp[k + 4] = bx; D.lp[k + 5] = by;
      D.lp[k + 2] = lerp(D.lp[k + 2], D.bcx, cv); D.lp[k + 3] = lerp(D.lp[k + 3], apexY + cable, cv);
    }
  }
}

// ---------------------------------------------------------------------------------------------------

function placeHome(i: number, f: Frame, o: Point) {
  const k = PW[i], u = f.u;
  let ox = OX[i], oy = OY[i];
  if (f.portrait) { const tmp = ox; ox = oy * 1.1; oy = tmp; }
  const ph = PH[i];
  let x: number, y: number;
  if (k === SCAT) {
    x = ox + Math.sin(clock * 0.05 + ph * 30) * 0.02;
    y = oy + Math.cos(clock * 0.04 + ph * 20) * 0.015;
  } else {
    // Slow breathing: each constellation turns a little and swells.
    const th = Math.sin(clock * 0.06 + ph * 6.28) * 0.2;
    const br = 1 + 0.06 * Math.sin(clock * 0.45 + k * 1.7) + 0.03 * Math.sin(clock * 1.1 + ph * 20);
    const c = Math.cos(th), s = Math.sin(th);
    x = D.wx[k] + (ox * c - oy * s) * br;
    y = D.wy[k] + (ox * s + oy * c) * br;
  }
  const S = Math.exp(D.lnZoom * ZE[i]);
  const z = Z[i];
  let px = D.cx + x * u * S + D.dx * z + D.shx[k];
  let py = D.cy + y * u * S + D.dy * z + D.shy[k];
  if (k === SCAT && D.fall > 0) { px += (px - D.cx) * 0.25 * D.fall; py += (py - D.cy) * 0.25 * D.fall; }
  // The camera moves toward the bridge: the surroundings slide outward.
  if (D.cam > 0) { const g = 1 + 0.3 * D.cam; px = D.bcx + (px - D.bcx) * g; py = D.bcy + (py - D.bcy) * g; }

  let a = BA[i] * (0.85 + 0.15 * Math.sin(clock * 1.3 + ph * 40)) * D.dim;
  let sz = (0.6 + 0.55 * z) * Math.min(1.8, 1 + 0.12 * (S - 1));
  if (k <= 1) {
    a *= lerp(1, 0.6, D.fall) * lerp(1, 1.4, D.revive) * (1 + 0.9 * D.pulse);
    sz *= 1 + 0.4 * D.pulse;
    o.c = k ? EN : KO;
  } else {
    a *= range(D.reveal, AP[i], AP[i] + 0.2) * lerp(1, 0.14, D.fall) * lerp(1, k === SCAT ? 1 : 2.4, D.revive) * (1 - 0.75 * D.fade);
    o.c = z < 0.75 ? DIM : INK;
  }
  o.x = px; o.y = py; o.a = a; o.s = sz;
}

/** A signal reaching for another world: coherent, then it loses itself at the path's break point. */
function placeAttempt(i: number, f: Frame, o: Point, j: number) {
  const A = ATTEMPTS[j], a = A[0], brk = A[2], spd = A[4];
  const packet = rnd(i, 45) < 0.5 ? 0 : 0.5;
  const s = frac(clock * spd + rnd(j, 80) + packet - rnd(i, 46) * 0.05);
  const q = clamp((s - brk) / 0.2);
  bez(D.ap, j * 6, s < brk ? s : brk + (s - brk) * 0.4);
  const u = f.u;
  const side = rnd(i, 47) < 0.5 ? -1 : 1;
  const coh = Math.sin(s * 30 + rnd(i, 48) * 6) * u * 0.004 + (rnd(i, 49) - 0.5) * u * 0.006;
  const spread = side * q ** 0.8 * u * 0.08 * (0.4 + rnd(i, 51));
  const along = (rnd(i, 52) - 0.5) * q * u * 0.04;
  o.x = BX + NX * (coh + spread) + (NY * along);
  o.y = BY + NY * (coh + spread) - (NX * along);
  const flick = q > 0 && Math.sin(clock * 37 + i * 7.1) < -0.1 ? 0.2 : 1;
  o.a = 0.8 * range(s, 0, 0.05) * (1 - q) * flick;
  o.c = a === 0 ? KO : a === 1 ? EN : INK;
  o.s = 1.1;
}

export const distanceVisual: SceneVisual = {
  // Starts on chapter 01's last frame and does its own hand-off.
  morph: 0,
  place(i, f, o) {
    update(f);
    const p = f.p;

    placeHome(i, f, o);

    // Failed attempts.
    const sj = SIG[i];
    if (sj >= 0 && D.sigOn > 0) {
      const hx = o.x, hy = o.y, ha = o.a, hc = o.c;
      placeAttempt(i, f, o, sj);
      const m = D.sigOn;
      o.x = lerp(hx, o.x, m); o.y = lerp(hy, o.y, m); o.a = lerp(ha, o.a * D.dim, m);
      if (m < 0.5) o.c = hc;
    }

    // The first link: one cyan signal and its short trail cross from KO to EN and arrive.
    const ld = LEAD[i];
    if (ld >= 0 && D.leadOn > 0) {
      const s = clamp(D.leadU - ld * 0.035);
      bez(D.lp, 0, s);
      const jit = Math.sin(clock * 3 + ld) * f.u * 0.002;
      const arrived = range(p, LEAD_ARRIVE + 0.01, LEAD_ARRIVE + 0.03);
      const ta = (ld === 0 ? 0.95 : 0.75 - ld * 0.12) * lerp(1, 0.5, arrived);
      o.x = lerp(o.x, BX + NX * jit, D.leadOn); o.y = lerp(o.y, BY + NY * jit, D.leadOn);
      o.a = lerp(o.a, ta, D.leadOn);
      o.s = ld === 0 ? 1.7 : 1.2;
      o.c = KO;
    }

    // Successful links: KO flows one way, EN the other, along persistent paths.
    const lj = LNK[i];
    if (lj >= 0) {
      const act = lj === 0 ? D.link0 : clamp(D.countF - lj);
      if (act > 0) {
        const even = (i & 1) === 0;
        const s0 = frac(clock * 0.09 * (0.8 + 0.4 * rnd(i, 53)) + rnd(i, 54));
        bez(D.lp, lj * 6, even ? s0 : 1 - s0);
        const off = (rnd(i, 55) - 0.5) * 4;
        o.x = lerp(o.x, BX + NX * off, act); o.y = lerp(o.y, BY + NY * off, act);
        o.a = lerp(o.a, 0.6 * Math.sin(Math.PI * s0) ** 0.5, act);
        o.s = lerp(o.s, 1.1, act);
        if (act > 0.5) o.c = even ? KO : EN;
      }
    }

    // Handoff: at p = 0 every particle is where chapter 01 left it.
    if (p < B.handoff[1]) {
      const hp = p / B.handoff[1];
      const m = range(hp * 1.4 - rnd(i, 9) * 0.4, 0, 1);
      if (m < 1) {
        silenceVisual.place(i, F1, T);
        if (m <= 0) { o.x = T.x; o.y = T.y; o.a = T.a; o.c = T.c; o.s = T.s; return; }
        o.x = lerp(T.x, o.x, m); o.y = lerp(T.y, o.y, m); o.a = lerp(T.a, o.a, m); o.s = lerp(T.s, o.s, m);
        if (m < 0.5) o.c = T.c;
      }
      return;
    }

    // Bridge: every particle eases (staggered) into chapter 03's opening formation.
    if (D.final > 0) {
      const m = range(D.final * 1.5 - rnd(i, 50) * 0.5, 0, 1);
      if (m <= 0) return;
      bridgeVisual.place(i, F0, T);
      if (m >= 1) { o.x = T.x; o.y = T.y; o.a = T.a; o.c = T.c; o.s = T.s; return; }
      o.x = lerp(o.x, T.x, m); o.y = lerp(o.y, T.y, m); o.a = lerp(o.a, T.a, m); o.s = lerp(o.s, T.s, m);
      if (m >= 0.5) o.c = T.c;
    }
  },

  draw(ctx, f, alpha) {
    update(f);
    const p = f.p;
    ctx.lineWidth = 1;

    // Faint partial paths of the attempts, stopping where each one breaks.
    const pa = alpha * D.sigOn * D.dim * 0.05;
    if (pa > 0.003) {
      ctx.globalAlpha = pa;
      ctx.strokeStyle = PALETTE[INK];
      for (let j = 0; j < NA; j++) partial(ctx, D.ap, j * 6, ATTEMPTS[j][2]);
    }

    // Links: the first draws itself behind the travelling signal; the rest appear one by one.
    const live = 1 - D.gone;
    ctx.strokeStyle = PALETTE[BRIDGE];
    const l0 = alpha * D.leadOn * 0.3 * live;
    if (l0 > 0.003) { ctx.globalAlpha = l0; partial(ctx, D.lp, 0, D.leadU); }
    for (let j = 1; j < NL; j++) {
      const la = alpha * clamp(D.countF - j) * 0.14 * live;
      if (la <= 0.003) continue;
      ctx.globalAlpha = la;
      partial(ctx, D.lp, j * 6, 1);
    }

    // Words surface from their worlds, one language after another.
    const span = B.languages[1] - B.languages[0], dur = 0.06, step = (span - dur) / (NW - 1);
    for (let k = 0; k < NW; k++) {
      const st = B.languages[0] + k * step;
      const wa = alpha * window01(p, st, st + dur, 0.015) * 0.7;
      if (wa <= 0.01) continue;
      const W = WORLDS[k], S = D.ss[k];
      const size = Math.max(16, Math.min(26, 12 + 8 * W.z + 1.5 * (S - 1)));
      const x = Math.max(60, Math.min(f.w - 60, D.sx[k]));
      const y = Math.max(40, Math.min(f.h - 30, D.sy[k] - (f.portrait ? W.sx * 1.1 : W.sy) * f.u * S * 1.9 - 8));
      ctx.globalAlpha = wa;
      ctx.fillStyle = k === 0 ? PALETTE[KO] : k === 1 ? PALETTE[EN] : PALETTE[INK];
      ctx.textAlign = "center";
      ctx.font = `italic ${Math.round(size)}px ${serifFont()}`;
      ctx.fillText(LANGUAGES[k].word, x, y);
    }
    ctx.globalAlpha = 1;
  },
};

/** The quadratic path at `off`, from its start to `s` (0–1). */
function partial(ctx: CanvasRenderingContext2D, arr: Float32Array, off: number, s: number) {
  if (s <= 0.001) return;
  const ax = arr[off], ay = arr[off + 1], cx = arr[off + 2], cy = arr[off + 3], bx = arr[off + 4], by = arr[off + 5];
  const m = 1 - s;
  const qx = ax + (cx - ax) * s, qy = ay + (cy - ay) * s;
  const ex = m * m * ax + 2 * m * s * cx + s * s * bx, ey = m * m * ay + 2 * m * s * cy + s * s * by;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(qx, qy, ex, ey);
  ctx.stroke();
}

let serif: string | null = null;
function serifFont() {
  if (serif === null) serif = getComputedStyle(document.documentElement).getPropertyValue("--font-serif").trim() || "Georgia, serif";
  return serif;
}
