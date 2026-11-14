import { BRIDGE, DIM, EN, INK, KO, PALETTE, label, lerp, range, rnd, syllables, waveY, type Frame, type Point, type SceneVisual } from "@/lib/cinematic/visual";
import { BEATS, dragonPoints } from "./beats";
import { CONNECTIONS, NODES, frameAt, pulseAt, type GlobeFrame } from "./system/globe";

/*
 * 08 — the canvas is the world's atmosphere: depth, and the many distant voices. The SVG (system/) draws a
 * few foreground connections and the final waveform; both go through the same globe (system/globe.ts).
 * p = 0 (point): every particle in one small luminous knot at the centre, warm white and gold with a faint
 *   cyan/magenta pair (chapter 07 eases into exactly this).
 * many → form: particles stream out of the point to their nodes as each appears (nearest first); the flat
 *   network wraps into a globe; distant points settle over it (dense near regions, quiet oceans).
 * globe → breathe: faint arcs with travelling pulses (pulse → response); nodes brighten as a pulse arrives;
 *   tiny language tags fade during unlabel; the whole globe breathes.
 * far: small in a huge darkness; colours soften toward warm white.
 * focus: the camera goes in on Seoul; everything else streams outward and fades; Seoul's particles gather on
 *   one thin horizontal line at the centre (chapter 01's tiny signal), gone by silence[0] + 0.03.
 * silence → line: nothing at all.
 * dragon (end of line → cta): dust rises, gathers on the dragon's silhouette, the picture takes over, a cloud
 *   settles under its feet (placeDragon).
 */

const NODE = 0, TRAVEL = 1, DIST = 2;
const RAD = Math.PI / 180;
const [SIL] = BEATS.silence;
const END = SIL + 0.03;
const MAX_ARCS = 40, MAX_ARCS_PORTRAIT = 18;

// ---------------------------------------------------------------- statics

/** Node choice weighted by size; Seoul's cluster is denser (it becomes the last voice). */
const CUM = (() => {
  const c = new Float64Array(NODES.length);
  let s = 0;
  NODES.forEach((n, i) => { s += n.size * (n.region === 0 ? 3 : 1) * (n.tag ? 2 : 1); c[i] = s; });
  for (let i = 0; i < c.length; i++) c[i] /= s;
  return c;
})();
const pickNode = (r: number) => { let i = 0; while (i < CUM.length - 1 && CUM[i] < r) i++; return i; };

/** Region centres (first node of each region), for distant points' irregular density. */
const HUBS = NODES.filter((n, i) => i === 0 || NODES[i - 1].region !== n.region);

let ROLE = new Uint8Array(0), NI = new Uint16Array(0), COL = new Uint8Array(0), KC = new Uint8Array(0);
let LAT = new Float64Array(0), LON = new Float64Array(0), SE = new Float64Array(0), PH = new Float64Array(0), BASE = new Float64Array(0);

function statics(n: number) {
  ROLE = new Uint8Array(n); NI = new Uint16Array(n); COL = new Uint8Array(n); KC = new Uint8Array(n);
  LAT = new Float64Array(n); LON = new Float64Array(n); SE = new Float64Array(n); PH = new Float64Array(n); BASE = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = rnd(i, 801);
    ROLE[i] = r < 0.32 ? NODE : r < 0.44 ? TRAVEL : DIST;
    SE[i] = rnd(i, 802);
    PH[i] = rnd(i, 803) * Math.PI * 2;
    // In the knot: warm white and gold, a faint cyan/magenta pair.
    const kc = rnd(i, 804);
    KC[i] = kc < 0.62 ? INK : kc < 0.86 ? BRIDGE : kc < 0.93 ? KO : EN;
    const cr = rnd(i, 805);
    if (ROLE[i] === NODE) {
      const nd = NODES[pickNode(rnd(i, 806))];
      NI[i] = nd.i;
      const j = 0.35 + 1.2 * nd.size;
      LAT[i] = nd.lat + (rnd(i, 807) - 0.5) * j;
      LON[i] = nd.lon + (rnd(i, 808) - 0.5) * j * 1.3;
      COL[i] = nd.region === 0 ? (cr < 0.65 ? KO : INK) : nd.region === 1 ? (cr < 0.65 ? EN : INK)
        : cr < 0.42 ? INK : cr < 0.69 ? KO : cr < 0.96 ? EN : BRIDGE;
      BASE[i] = 0.2 + 0.3 * nd.size + (nd.tag ? 0.1 : 0);
    } else if (ROLE[i] === TRAVEL) {
      NI[i] = Math.floor(rnd(i, 809) * CONNECTIONS.length);
      COL[i] = cr < 0.12 ? INK : 0; // 0 = follow the pulse direction (cyan out, magenta back)
      BASE[i] = 0.5;
    } else {
      // Distant voices: mostly near the regions, a few scattered over quiet oceans.
      if (rnd(i, 810) < 0.68) {
        const hub = HUBS[Math.floor(rnd(i, 811) * HUBS.length)];
        const a = rnd(i, 812) * Math.PI * 2, d = 4 + 26 * rnd(i, 813) ** 1.6;
        LAT[i] = Math.max(-75, Math.min(78, hub.lat + Math.sin(a) * d * 0.7));
        LON[i] = hub.lon + Math.cos(a) * d / Math.max(0.35, Math.cos(hub.lat * RAD));
        BASE[i] = (0.3 + 0.35 * rnd(i, 814)) * (1 - d / 48);
      } else {
        LAT[i] = Math.asin(2 * rnd(i, 815) - 1) / RAD * 0.9;
        LON[i] = rnd(i, 816) * 360 - 180;
        BASE[i] = rnd(i, 814) < 0.7 ? 0.14 + 0.14 * rnd(i, 817) : 0;
      }
      COL[i] = cr < 0.5 ? INK : cr < 0.72 ? DIM : cr < 0.86 ? KO : EN;
    }
  }
}

// ---------------------------------------------------------------- per-frame cache

const NC = NODES.length, CC = CONNECTIONS.length;
let cn = -1, cw = NaN, ch = NaN, cp = NaN, ct = NaN;
let F: GlobeFrame = frameAt(0, 1, 1, 0);
/** Node: screen x, y, z, appearance, flash (a pulse arriving). */
const NX = new Float64Array(NC), NY = new Float64Array(NC), NZ = new Float64Array(NC), NA = new Float64Array(NC), FL = new Float64Array(NC);
/** Connection: arc A, K, B (screen), depth at each end, appearance, pulse progress (-1 between) and direction. */
const AX = new Float64Array(CC), AY = new Float64Array(CC), KX = new Float64Array(CC), KY = new Float64Array(CC);
const BX = new Float64Array(CC), BY = new Float64Array(CC), ZA = new Float64Array(CC), ZB = new Float64Array(CC);
const CA = new Float64Array(CC), PS = new Float64Array(CC), PD = new Int8Array(CC);
let breath = 1, farness = 0, fade = 1, lineFade = 0, amp = 0, half = 0;

const bump = (x: number) => (x > 0 && x < 0.12 ? Math.sin((Math.PI * x) / 0.12) : 0);

/** Same math as globe.ts place(), without allocating. */
const P = { x: 0, y: 0, z: 1 };
function project(lat: number, lon: number) {
  const la = lat * RAD, lo = (lon - F.lon0) * RAD + F.spin;
  const cl = Math.cos(la);
  const x = cl * Math.sin(lo), y0 = -Math.sin(la), z0 = cl * Math.cos(lo);
  const cT = Math.cos(F.tilt), sT = Math.sin(F.tilt);
  const y = y0 * cT - z0 * sT, z = y0 * sT + z0 * cT;
  const dl = ((lon - F.lon0) % 360 + 540) % 360 - 180;
  const fx = F.w / 2 + dl * F.k, fy = F.h / 2 - (lat - 15) * F.k;
  P.x = fx + (F.cx + x * F.R - fx) * F.form;
  P.y = fy + (F.cy + y * F.R - fy) * F.form;
  P.z = 1 + (z - 1) * F.form;
}

function update(f: Frame) {
  if (f.n !== cn) { statics(f.n); cn = f.n; cp = NaN; }
  if (f.p === cp && f.t === ct && f.w === cw && f.h === ch) return;
  cp = f.p; ct = f.t; cw = f.w; ch = f.h;
  F = frameAt(f.p, f.w, f.h, f.t);
  for (let k = 0; k < NC; k++) {
    const nd = NODES[k];
    project(nd.lat, nd.lon);
    NX[k] = P.x; NY[k] = P.y; NZ[k] = P.z;
    // nodeAppear(), inlined.
    NA[k] = range(f.p, 0.015 + nd.order * 0.17, 0.035 + nd.order * 0.17);
    FL[k] = 0;
  }
  for (let c = 0; c < CC; c++) {
    const C = CONNECTIONS[c];
    AX[c] = NX[C.a]; AY[c] = NY[C.a]; ZA[c] = NZ[C.a];
    BX[c] = NX[C.b]; BY[c] = NY[C.b]; ZB[c] = NZ[C.b];
    // Same control point as globe.ts arcPoints().
    const mx = (AX[c] + BX[c]) / 2, my = (AY[c] + BY[c]) / 2, lift = C.far ? 1.28 : 1.06;
    if (F.form > 0.01) { KX[c] = F.cx + (mx - F.cx) * lift; KY[c] = F.cy + (my - F.cy) * lift; }
    else { KX[c] = mx; KY[c] = my - Math.hypot(BX[c] - AX[c], BY[c] - AY[c]) * 0.18; }
    CA[c] = Math.min(NA[C.a], NA[C.b]);
    const q = pulseAt(C, f.t);
    if (q) { PS[c] = q.s; PD[c] = q.from === C.a ? 1 : -1; } else { PS[c] = -1; PD[c] = 0; }
    // The response: each node brightens briefly as a pulse arrives (pulseAt's rhythm: at B 0.32, at A 0.77).
    const ph = ((f.t / C.period + C.phase) % 1 + 1) % 1;
    FL[C.b] = Math.max(FL[C.b], bump(ph - 0.3) * CA[c]);
    FL[C.a] = Math.max(FL[C.a], bump(ph - 0.75) * CA[c]);
  }
  const bw = range(f.p, BEATS.breathe[0] - 0.02, BEATS.breathe[0] + 0.03) * (1 - range(f.p, BEATS.hear[1] - 0.02, BEATS.focus[0] + 0.02));
  breath = 1 + 0.05 * Math.sin(f.t * 0.45) + 0.16 * bw * Math.sin(f.t * 0.7 + 1);
  farness = range(f.p, BEATS.far[0], BEATS.far[1]) * (1 - F.focus);
  fade = 1 - range(F.focus, 0.15, 0.7);
  lineFade = 1 - range(f.p, SIL, END);
  amp = f.u * 0.016 * (0.25 + 0.75 * syllables(f.t, 1)) * (1 - 0.7 * range(f.p, BEATS.focus[1] - 0.02, SIL + 0.02));
  half = f.w * (f.portrait ? 0.14 : 0.05);
}

/** Point on the cached arc c at s (0 = A, 1 = B). */
function onArc(c: number, s: number, o: Point) {
  const m = 1 - s;
  o.x = m * m * AX[c] + 2 * m * s * KX[c] + s * s * BX[c];
  o.y = m * m * AY[c] + 2 * m * s * KY[c] + s * s * BY[c];
}

/** Front-facing 1, back-facing much dimmer. */
const depthA = (z: number) => 0.08 + 0.92 * ((z + 1) / 2) ** 2.2;
const depthS = (z: number) => 0.6 + 0.6 * ((z + 1) / 2);

// ---------------------------------------------------------------- formations

function placeWorld(i: number, f: Frame, o: Point) {
  const role = ROLE[i];
  let ap: number, a: number, z: number, c: number;
  if (role === TRAVEL) {
    // A pulse and its short trail along a connection; between pulses, nothing.
    const k = NI[i], s = PS[k] < 0 ? -1 : PD[k] > 0 ? PS[k] - SE[i] * 0.07 : 1 - PS[k] + SE[i] * 0.07;
    ap = CA[k];
    if (s < 0 || s > 1) {
      onArc(k, PD[k] < 0 ? 1 : 0, o);
      a = 0; z = ZA[k];
    } else {
      onArc(k, s, o);
      z = lerp(ZA[k], ZB[k], s) + 0.25 * Math.sin(Math.PI * s) * F.form;
      a = BASE[i] * Math.sin(Math.PI * s) ** 0.5 * (1 - 0.75 * SE[i]);
    }
    c = COL[i] === INK ? INK : PD[k] < 0 ? EN : KO;
  } else {
    project(LAT[i] + Math.sin(f.t * 0.11 + PH[i]) * 0.15, LON[i] + Math.cos(f.t * 0.09 + PH[i]) * 0.2);
    o.x = P.x; o.y = P.y; z = P.z;
    if (role === NODE) {
      const k = NI[i];
      ap = NA[k];
      a = BASE[i] * (1 + 1.2 * FL[k]) * (0.85 + 0.15 * Math.sin(f.t * 0.6 + PH[i]));
    } else {
      ap = range(f.p, BEATS.form[0] - 0.02 + 0.12 * SE[i], BEATS.form[0] + 0.06 + 0.12 * SE[i]);
      a = BASE[i] * (0.8 + 0.2 * Math.sin(f.t * 0.4 + PH[i] * 3));
    }
    c = COL[i];
  }
  a *= depthA(z) * breath;
  // Far: softer, warmer; most colour drifts toward white.
  if (farness > 0 && c !== DIM && rnd(i, 820) < 0.55 * farness) c = INK;
  o.a = a * fade;
  o.c = c;
  o.s = depthS(z) * (role === NODE ? 1.05 : role === DIST ? 0.85 : 1);
  return ap;
}

/** p = 0: one small knot of light at the centre, slowly turning. */
function placeKnot(i: number, f: Frame, o: Point) {
  const r = 1 + 4.5 * SE[i] ** 1.6, a = PH[i] + f.t * (0.5 + 0.4 * SE[i]);
  const pair = KC[i] === KO ? -1.6 : KC[i] === EN ? 1.6 : 0;
  o.x = f.w / 2 + Math.cos(a) * r + pair;
  o.y = f.h / 2 + Math.sin(a) * r * 0.85;
  o.a = (SE[i] < 0.35 ? 0.45 : 0.14) * (1 - range(f.p, 0.02, 0.1));
  o.c = KC[i];
  o.s = 1;
}

const K: Point = { x: 0, y: 0, a: 0, c: 0, s: 1 };

// ---------------------------------------------------------------- the dragon (Inha's Biryong, "a flying dragon on a cloud")

const [D0, D1] = BEATS.dragon;
const DL = D1 - D0;
/** Sub-beats of BEATS.dragon: dust rises, gathers into the silhouette, the picture arrives, a cloud settles. */
const GATHER = D0 + DL * 0.2, REVEAL = D0 + DL * 0.58, CLOUD = D0 + DL * 0.68;
/** Share of particles that stay as the cloud under the dragon's feet. */
const CLOUD_SHARE = 0.32;
/** The cloud's puffs: centre (−1…1 across the picture's width) and relative size. */
const PUFFS: readonly (readonly [number, number])[] = [[-0.62, 0.62], [-0.3, 0.9], [0, 1.15], [0.3, 0.9], [0.62, 0.62]];

/**
 * From the end of the final line: faint dust rises out of the dark, gathers on the dragon's silhouette (the
 * picture's own colours in the film palette), then the picture itself (future-scene.tsx) takes over and a
 * third of the particles slide under its feet as a slow, drifting cloud. Without points: nothing, as before.
 */
function placeDragon(i: number, f: Frame, o: Point) {
  const dp = dragonPoints.current;
  if (!dp || dp.count === 0 || f.p < D0) { o.x = f.w / 2; o.y = f.h / 2; o.a = 0; o.c = INK; o.s = 1; return; }
  const r1 = rnd(i, 901), r2 = rnd(i, 902), r3 = rnd(i, 903), ph = rnd(i, 904) * Math.PI * 2;
  const { box } = dp;

  // Dust: scattered low in the frame, rising a little as the chapter scrolls on.
  const rise = range(f.p, D0, REVEAL) * f.h * 0.12;
  const dx = f.w * (0.04 + 0.92 * r1) + Math.sin(f.t * 0.3 + ph) * 6;
  const dy = f.h * (0.3 + 0.8 * r2) - rise + Math.cos(f.t * 0.25 + ph) * 5;
  const dustA = range(f.p, D0 + DL * 0.04 * r3, GATHER) * (0.1 + 0.16 * r3);

  // Silhouette: each particle leaves at its own moment.
  const j = i % dp.count;
  const tx = dp.xy[j * 2], ty = dp.xy[j * 2 + 1];
  const g = range(f.p, GATHER + DL * 0.12 * r1, GATHER + DL * (0.24 + 0.12 * r1));
  o.x = lerp(dx, tx, g); o.y = lerp(dy, ty, g);
  o.a = lerp(dustA, 0.62 + 0.2 * r3, g);
  o.c = g > 0.5 ? dp.col[j] : r3 < 0.6 ? DIM : INK;
  o.s = lerp(0.9, 1.15, g);

  if (r2 < CLOUD_SHARE) {
    // The cloud: a few soft puffs under the feet (round on top, flat underneath), bigger in the middle,
    // each slowly drifting and breathing.
    const lobe = Math.floor(rnd(i, 905) * PUFFS.length);
    const [pu, pr] = PUFFS[lobe];
    const ang = rnd(i, 906) * Math.PI * 2, rad = Math.sqrt(rnd(i, 907));
    const breathe = 1 + 0.06 * Math.sin(f.t * 0.6 + lobe * 1.7);
    const cx = box.x + box.w * (0.5 + pu * 0.62) + Math.cos(ang) * rad * pr * box.w * 0.2 * breathe + Math.sin(f.t * 0.2 + lobe) * box.w * 0.03;
    const cy = box.y + box.h * 0.985 - Math.abs(Math.sin(ang)) * rad * pr * box.h * 0.085 * breathe * (Math.sin(ang) < 0 ? 1 : 0.3);
    const k = range(f.p, CLOUD + DL * 0.12 * r1, CLOUD + DL * (0.22 + 0.1 * r1));
    o.x = lerp(o.x, cx, k); o.y = lerp(o.y, cy, k);
    o.a = lerp(o.a, (0.14 + 0.28 * r3) * (1 - 0.5 * rad * rad) * (0.85 + 0.15 * Math.sin(f.t * 0.7 + ph)), k);
    if (k > 0.5) o.c = r3 < 0.62 ? EN : r3 < 0.88 ? INK : KO;
    o.s = lerp(o.s, 1, k);
  } else {
    // Into the picture as it arrives.
    o.a *= 1 - range(f.p, REVEAL + DL * 0.04 * r1, REVEAL + DL * (0.2 + 0.08 * r1));
  }
}

/** 08 — a world made of voices; then one voice; then nothing; then the dragon on its cloud. */
export const futureVisual: SceneVisual = {
  morph: 0, // chapter 07 (reality/visual.ts) ends exactly on this chapter's first frame.
  place(i, f, o) {
    if (f.p >= END) { placeDragon(i, f, o); return; }
    update(f);
    const ap = placeWorld(i, f, o);
    // Out of the point, each particle when its node appears.
    if (ap < 1) {
      placeKnot(i, f, K);
      o.x = lerp(K.x, o.x, ap); o.y = lerp(K.y, o.y, ap); o.a = lerp(K.a, o.a, ap); o.s = lerp(K.s, o.s, ap);
      if (ap < 0.5) o.c = K.c;
    }
    // Seoul's voices gather on one thin line at the centre: chapter 01's tiny signal.
    if (ROLE[i] === NODE && NODES[NI[i]].region === 0 && F.focus > 0) {
      const g = range(f.p, BEATS.focus[0] + 0.012 + 0.025 * SE[i], BEATS.focus[0] + 0.05 + 0.025 * SE[i]);
      if (g > 0) {
        const kk = rnd(i, 830);
        const x = f.w / 2 + (kk * 2 - 1) * half;
        const y = f.h / 2 + waveY(kk, f.t, amp, 0) + (rnd(i, 831) - 0.5) * 1.2;
        const la = 0.3 * (0.35 + 0.65 * Math.sin(Math.PI * kk));
        o.x = lerp(o.x, x, g); o.y = lerp(o.y, y, g);
        o.a = lerp(o.a, la, g) * lineFade; o.s = lerp(o.s, 1, g);
        if (g > 0.5) o.c = KO;
      }
    }
  },

  draw(ctx, f, alpha) {
    if (f.p >= END) return;
    update(f);
    const a0 = alpha * fade * breath;
    if (a0 <= 0.01) return;
    // Faint contours: the rim and three parallels, so the world is implied, never illustrated.
    if (F.form > 0.05) {
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = PALETTE[INK];
      ctx.globalAlpha = a0 * F.form * 0.06;
      ctx.beginPath(); ctx.arc(F.cx, F.cy, F.R, 0, Math.PI * 2); ctx.stroke();
      for (const lat of [-30, 15, 50]) {
        const la = lat * RAD, r = Math.cos(la) * F.R, y = -Math.sin(la) * Math.cos(F.tilt) * F.R;
        ctx.globalAlpha = a0 * F.form * 0.035;
        ctx.beginPath(); ctx.ellipse(F.cx, F.cy + y, r, r * Math.sin(F.tilt), 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.lineWidth = 0.75;
    const max = Math.min(CC, f.portrait ? MAX_ARCS_PORTRAIT : MAX_ARCS);
    for (let c = 0; c < max; c++) {
      if (CA[c] <= 0.01) continue;
      const front = Math.min(ZA[c], ZB[c]);
      if (front < -0.35) continue;
      const d = depthA(front);
      const live = PS[c] >= 0 ? Math.sin(Math.PI * PS[c]) : 0;
      ctx.globalAlpha = a0 * CA[c] * d * (0.05 + 0.05 * live) * (CONNECTIONS[c].far ? 1 : 0.7);
      ctx.strokeStyle = PALETTE[c % 5 === 0 ? INK : c & 1 ? EN : KO];
      ctx.beginPath(); ctx.moveTo(AX[c], AY[c]); ctx.quadraticCurveTo(KX[c], KY[c], BX[c], BY[c]); ctx.stroke();
      if (PS[c] >= 0) {
        const s = PD[c] > 0 ? PS[c] : 1 - PS[c];
        onArc(c, s, K);
        const z = lerp(ZA[c], ZB[c], s);
        ctx.globalAlpha = a0 * CA[c] * depthA(z) * 0.55 * live ** 0.5;
        ctx.fillStyle = PALETTE[PD[c] > 0 ? KO : EN];
        ctx.fillRect(K.x - 1, K.y - 1, 2, 2);
      }
    }
    // Tiny language tags beside their nodes, until unlabel.
    if (F.labels > 0.01) {
      let shown = 0;
      for (let k = 0; k < NC; k++) {
        const tag = NODES[k].tag;
        if (!tag) continue;
        if (f.portrait && ++shown > 5) break;
        const la = alpha * F.labels * NA[k] * depthA(NZ[k]) * 0.42;
        label(ctx, tag, NX[k] + 6, NY[k] - 5, la, PALETTE[tag === "KO" ? KO : tag === "EN" ? EN : INK], "left", 9);
      }
    }
    ctx.globalAlpha = 1;
  },
};
