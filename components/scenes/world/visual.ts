import { RAYS } from "@/components/scenes/engine/system/exit-multiply";
import { BRIDGE, DIM, EN, INK, KO, lerp, range, rnd, type Frame, type Point, type SceneVisual } from "@/lib/cinematic/visual";
import { BEATS, WORLDS, type Lang } from "./beats";
import { activity, cameraAt, endSpan, toScreen, worldGeometry, type Cam, type Geo, type P2 } from "./system/geometry";

/*
 * 06 — the SVG (system/) draws the network; the canvas gives it life and depth, through the same camera.
 * p = 0: chapter 05's last frame: particles strung along its ~90 rays, a gold knot at the centre (chapter
 *   05's multiply eases into exactly this).
 * many → underneath: particles with a purpose: a knot circling the runtime, travellers on every world's
 *   path (brighter while that world speaks), small crowds gathered around each world, far dust.
 * global: travellers and crowds move out to the regions: settled on cities, or riding the long arcs home.
 * select: everything quiets; the camera goes in, so the network streams outward past the edges.
 * setup: what is left gathers on the selected conversation's line, cyan to the left, magenta to the right.
 */

const CORE = 0, PATH = 1, CROWD = 2, DUST = 3;
const LANG_C = (l: Lang) => (l === "ko" ? KO : l === "en" ? EN : INK);
const [G0, G1] = BEATS.global;
const [S0] = BEATS.select;

let ROLE = new Uint8Array(0), WD = new Uint8Array(0), REG = new Uint8Array(0), CITY = new Uint8Array(0);
let SE = new Float64Array(0), PH = new Float64Array(0);

function statics(n: number) {
  ROLE = new Uint8Array(n); WD = new Uint8Array(n); REG = new Uint8Array(n); CITY = new Uint8Array(n);
  SE = new Float64Array(n); PH = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = rnd(i, 201);
    ROLE[i] = r < 0.14 ? CORE : r < 0.54 ? PATH : r < 0.76 ? CROWD : DUST;
    WD[i] = Math.floor(rnd(i, 202) * WORLDS.length);
    REG[i] = Math.floor(rnd(i, 203) * 8);
    CITY[i] = Math.floor(rnd(i, 207) * 7);
    SE[i] = rnd(i, 208);
    PH[i] = rnd(i, 209) * Math.PI * 2;
  }
}

// ---------------------------------------------------------------- per-frame cache

let cn = -1, cw = NaN, ch = NaN, cp = NaN, ct = NaN;
let G: Geo | null = null;
let cam: Cam = { cx: 0.5, cy: 0.5, z: 1 };
const ACT = new Float64Array(WORLDS.length);
let open = 0, global = 0, quiet = 0;
const Q: P2 = { x: 0, y: 0 }, S: P2 = { x: 0, y: 0 };

function update(f: Frame) {
  if (f.n !== cn) { statics(f.n); cn = f.n; }
  if (f.w !== cw || f.h !== ch) { G = worldGeometry(f.w, f.h); cw = f.w; ch = f.h; cp = NaN; }
  if (f.p === cp && f.t === ct) return;
  cp = f.p; ct = f.t;
  const g = G!;
  cam = cameraAt(f.p, g.portrait, { x: g.sel.x / g.w, y: g.sel.y / g.h });
  for (let d = 0; d < WORLDS.length; d++) ACT[d] = activity(d, f.t);
  open = range(f.p, 0, 0.12);
  global = range(f.p, G0, G1);
  quiet = range(f.p, S0, S0 + 0.05);
}

// ---------------------------------------------------------------- formations

/** Chapter 05's last frame: on its rays (screen space), a gold knot at the centre. */
function placeRays(i: number, f: Frame, o: Point) {
  if (ROLE[i] === CORE) {
    const a = PH[i] + f.t * 0.4, r = 2 + 9 * SE[i];
    o.x = f.w / 2 + Math.cos(a) * r; o.y = f.h / 2 + Math.sin(a) * r;
    o.a = 0.7; o.c = BRIDGE; o.s = 1;
    return;
  }
  const ray = RAYS.many[Math.floor(rnd(i, 204) * RAYS.many.length)];
  const L = Math.hypot(f.w, f.h) * 0.62 * ray.l;
  const r = L * rnd(i, 205) ** 0.8;
  o.x = f.w / 2 + Math.cos(ray.a) * r; o.y = f.h / 2 + Math.sin(ray.a) * r;
  o.a = 0.24 * (1 - r / L) ** 0.5;
  o.c = ray.c === 0 ? KO : ray.c === 1 ? EN : BRIDGE;
  o.s = 1;
}

/** The network: everything in world space, through the camera. */
function placeNetwork(i: number, f: Frame, o: Point) {
  const g = G!, role = ROLE[i];
  if (role === DUST) {
    // Far away: barely moved by the camera, a slow drift.
    const k = 1 + 0.08 * (cam.z - 1);
    o.x = f.w / 2 + (rnd(i, 210) - 0.5) * f.w * 1.1 * k + Math.sin(f.t * 0.04 + PH[i]) * 6;
    o.y = f.h / 2 + (rnd(i, 211) - 0.5) * f.h * 1.1 * k + Math.cos(f.t * 0.03 + PH[i]) * 5;
    o.a = rnd(i, 212) < 0.5 ? 0.05 + 0.04 * Math.sin(f.t * 0.5 + PH[i]) : 0;
    o.c = rnd(i, 213) < 0.3 ? INK : DIM;
    o.s = 0.8;
    return;
  }
  if (role === CORE) {
    const a = PH[i] + f.t * (0.3 + 0.4 * SE[i]), r = g.ring * (0.4 + 1.4 * Math.sqrt(SE[i]));
    Q.x = g.c.x + Math.cos(a) * r * (g.portrait ? 1 : 1.4); Q.y = g.c.y + Math.sin(a) * r;
    toScreen(Q, cam, f.w, f.h, o);
    o.a = 0.55; o.c = SE[i] < 0.6 ? BRIDGE : INK; o.s = 1;
    return;
  }
  const d = WD[i], wd = g.worlds[d], act = ACT[d];
  if (role === PATH) {
    // Travellers: in towards the runtime or out to the world, each at its world's pace.
    const u = (SE[i] + f.t * wd.act.speed * 0.22 * (0.8 + 0.4 * rnd(i, 214))) % 1;
    const q = wd.path.at(rnd(i, 215) < 0.5 ? u : 1 - u);
    const j = (rnd(i, 216) - 0.5) * g.sz * 0.25;
    Q.x = q.x + j; Q.y = q.y + j * 0.6;
    o.a = 0.12 + 0.4 * act;
  } else {
    // A small crowd around the world, livelier while it speaks.
    const a = PH[i] + f.t * (0.08 + 0.12 * act), r = g.sz * (1.2 + 1.8 * SE[i]);
    Q.x = wd.p.x + Math.cos(a) * r * 1.4; Q.y = wd.p.y + Math.sin(a) * r * 0.75;
    o.a = 0.08 + 0.25 * act;
  }
  o.c = LANG_C(wd.lang);
  o.s = 1;
  if (global > 0) {
    // Out to the regions: settled on a city, or riding the long arc back to the runtime.
    const m = range(global * 1.4 - SE[i] * 0.4, 0, 1);
    if (m > 0) {
      const reg = g.regions[REG[i]];
      if (role === CROWD || rnd(i, 217) < 0.4) {
        const c = reg.cities[CITY[i]], a = PH[i] + f.t * 0.1, r = g.S * 0.012 * (0.5 + SE[i]);
        S.x = c.x + Math.cos(a) * r; S.y = c.y + Math.sin(a) * r;
      } else {
        const q = reg.arc.at((SE[i] + f.t * 0.05) % 1);
        S.x = q.x; S.y = q.y;
      }
      Q.x = lerp(Q.x, S.x, m); Q.y = lerp(Q.y, S.y, m);
      o.a = lerp(o.a, 0.3, m);
      if (m > 0.5) o.c = REG[i] % 2 ? EN : KO;
    }
  }
  toScreen(Q, cam, f.w, f.h, o);
}

/** The selected conversation's line (screen space). */
function placeLine(i: number, f: Frame, o: Point) {
  const { x0, x1 } = endSpan(f.w);
  const u = rnd(i, 206);
  o.x = lerp(x0, x1, u);
  o.y = f.h / 2 + (rnd(i, 218) - 0.5) * 3 + Math.sin(f.t * 0.6 + u * 30) * 1.2;
  o.c = u < 0.5 ? KO : EN;
  o.a = 0.16 * Math.sin(Math.PI * u) ** 0.4;
  o.s = 1;
}

const T: Point = { x: 0, y: 0, a: 0, c: 0, s: 1 };

/** 06 — life and depth around the network the SVG draws. */
export const worldVisual: SceneVisual = {
  morph: 0, // chapter 05 (engine/visual.ts) ends exactly on this chapter's first frame.
  place(i, f, o) {
    update(f);
    // Leaving chapter 05's rays, each particle at its own moment.
    const m = range(open * 1.5 - SE[i] * 0.5, 0, 1);
    if (m < 1) placeRays(i, f, T);
    if (m > 0) placeNetwork(i, f, o);
    if (m < 1) {
      if (m <= 0) { o.x = T.x; o.y = T.y; o.a = T.a; o.c = T.c; o.s = T.s; }
      else { o.x = lerp(T.x, o.x, m); o.y = lerp(T.y, o.y, m); o.a = lerp(T.a, o.a, m); o.s = lerp(T.s, o.s, m); if (m < 0.5) o.c = T.c; }
    }
    if (quiet > 0) o.a *= 1 - 0.75 * quiet;
    // The line: every non-dust particle gathers on it, staggered.
    const l = ROLE[i] === DUST ? 0 : range(f.p, 0.9 + SE[i] * 0.05, 0.96 + SE[i] * 0.04);
    if (l > 0) {
      placeLine(i, f, T);
      o.x = lerp(o.x, T.x, l); o.y = lerp(o.y, T.y, l); o.a = lerp(o.a, T.a, l);
      if (l > 0.5) o.c = T.c;
    }
  },
};
