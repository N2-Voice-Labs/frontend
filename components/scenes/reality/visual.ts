import { futureVisual } from "@/components/scenes/future/visual";
import { worldVisual } from "@/components/scenes/world/visual";
import { director } from "@/lib/cinematic/director";
import { BRIDGE, DIM, EN, INK, KO, lerp, range, rnd, type Frame, type Point, type SceneVisual } from "@/lib/cinematic/visual";
import { BEATS, clockAt } from "./beats";
import { stateAt, type State } from "./conversation-engine";
import { LANE, realityLayout, type Layout, type SP } from "./system/layout";

/*
 * 07 — the SVG draws the people and their voices; the canvas is the air between them.
 * p = 0: chapter 06's last frame exactly (the selected conversation's line); it eases onto the stage.
 * talk: particles along each lane brighten and spread with that person's voice; others carry meaning
 *   from one mouth to the other (bright while it travels, gone in silence); graphite dust drifts around the
 *   portraits and stirs while they speak. Everything follows the same engine state as the SVG.
 * exit: everything gathers into one point of light between them, then opens into chapter 08's globe
 *   (exact at p = 1).
 */

const LANES = 0, FLOW = 1, DUST = 2, AIR = 3;
const [E0] = BEATS.exit;

let ROLE = new Uint8Array(0), SIDE = new Uint8Array(0), SE = new Float64Array(0), PH = new Float64Array(0), U = new Float64Array(0);
function statics(n: number) {
  ROLE = new Uint8Array(n); SIDE = new Uint8Array(n); SE = new Float64Array(n); PH = new Float64Array(n); U = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = rnd(i, 301);
    ROLE[i] = r < 0.42 ? LANES : r < 0.6 ? FLOW : r < 0.82 ? DUST : AIR;
    SIDE[i] = rnd(i, 302) < 0.5 ? 0 : 1;
    SE[i] = rnd(i, 303);
    PH[i] = rnd(i, 304) * Math.PI * 2;
    U[i] = rnd(i, 305);
  }
}

let cn = -1, cw = NaN, ch = NaN, cp = NaN, ct = NaN;
let L: Layout | null = null;
let S: State = stateAt(-1);
const W1: Frame = { w: 0, h: 0, t: 0, p: 1, n: 0, portrait: false, u: 1 };
const F0: Frame = { w: 0, h: 0, t: 0, p: 0, n: 0, portrait: false, u: 1 };
const T: Point = { x: 0, y: 0, a: 0, c: 0, s: 1 };
const Q: SP = { x: 0, y: 0, nx: 0, ny: 0 };
let enter = 0, gather = 0, open = 0, quiet = 0;

function update(f: Frame) {
  if (f.n !== cn) { statics(f.n); cn = f.n; }
  if (f.w !== cw || f.h !== ch) { L = realityLayout(f.w, f.h); cw = f.w; ch = f.h; }
  for (const F of [W1, F0]) { F.w = f.w; F.h = f.h; F.t = f.t; F.n = f.n; F.portrait = f.portrait; F.u = f.u; }
  if (f.p === cp && f.t === ct) return;
  cp = f.p; ct = f.t;
  S = stateAt(clockAt(f.p));
  if (director.level.you > 0 || director.level.agent > 0) {
    S = { ...S, minji: { ...S.minji, speak: director.level.you }, daniel: { ...S.daniel, speak: director.level.agent } };
  }
  enter = range(f.p, 0, 0.06);
  quiet = range(f.p, BEATS.silence[0], BEATS.silence[1]) * (1 - range(f.p, BEATS.brand[0], BEATS.brand[0] + 0.03));
  gather = range(f.p, E0, E0 + 0.04);
  open = Math.max(0, Math.min(1, (f.p - (E0 + 0.03)) / (1 - (E0 + 0.03))));
}

function placeStage(i: number, f: Frame, o: Point) {
  const g = L!, role = ROLE[i], who = SIDE[i] ? "daniel" : "minji", st = S[who];
  const voice = Math.max(st.speak, st.hear * 0.7);
  if (role === LANES) {
    const [a, b] = SIDE[i] ? LANE.daniel : LANE.minji;
    const s = a + (b - a) * ((U[i] + f.t * 0.006 * (SIDE[i] ? -1 : 1)) % 1 + 1) % 1;
    g.at(s, Q);
    const v = (SE[i] - 0.5) * (3 + g.H * 0.16 * voice) + Math.sin(f.t * 1.3 + PH[i]) * 1.2;
    o.x = Q.x + Q.nx * v; o.y = Q.y + Q.ny * v;
    o.a = (0.05 + 0.4 * voice) * (1 - 0.7 * quiet);
    o.c = SIDE[i] ? EN : KO;
    o.s = 1;
    return;
  }
  if (role === FLOW) {
    // Meaning in transit: from whoever is speaking toward the other, bright only while it moves.
    const fl = S.flows[0];
    const u = (SE[i] + f.t * 0.16) % 1;
    const s = fl && fl.from === "daniel" ? 1 - u : u;
    g.at(s, Q);
    const j = (rnd(i, 306) - 0.5) * 6;
    o.x = Q.x + Q.nx * j; o.y = Q.y + Q.ny * j;
    o.a = fl ? 0.08 + 0.45 * fl.strength * (0.4 + 0.6 * S.presence) : 0.02;
    o.c = s > LANE.mid[0] && s < LANE.mid[1] ? BRIDGE : s < 0.5 ? KO : EN;
    o.s = 1;
    return;
  }
  if (role === DUST) {
    // Graphite dust around the portraits, stirring while that person speaks.
    const h = g[who], a = PH[i] + f.t * (0.03 + 0.25 * st.speak), r = g.H * (0.45 + 0.4 * SE[i]);
    o.x = h.c.x + Math.cos(a) * r * 0.8 + Math.sin(f.t * 0.2 + PH[i]) * 4;
    o.y = h.c.y + 0.1 * g.H + Math.sin(a) * r;
    o.a = (0.03 + 0.06 * rnd(i, 307) + 0.12 * st.speak) * (1 - 0.5 * quiet);
    o.c = rnd(i, 308) < 0.5 ? INK : DIM;
    o.s = 0.8;
    return;
  }
  o.x = rnd(i, 309) * f.w + Math.sin(f.t * 0.05 + PH[i]) * 8;
  o.y = rnd(i, 310) * f.h + Math.cos(f.t * 0.04 + PH[i]) * 6;
  o.a = rnd(i, 311) < 0.4 ? 0.04 : 0;
  o.c = DIM;
  o.s = 0.8;
}

/** 07 — the air between two people talking. */
export const realityVisual: SceneVisual = {
  morph: 0, // chapter 06 (world/visual.ts) ends where this chapter begins; it eases out of it here.
  place(i, f, o) {
    update(f);
    placeStage(i, f, o);
    // In: from chapter 06's selected-conversation line, each particle at its own moment.
    const e = range(enter * 1.4 - SE[i] * 0.4, 0, 1);
    if (e < 1) {
      worldVisual.place(i, W1, T);
      o.x = lerp(T.x, o.x, e); o.y = lerp(T.y, o.y, e); o.a = lerp(T.a, o.a, e); o.s = lerp(T.s, o.s, e);
      if (e < 0.5) o.c = T.c;
    }
    // Out: one point of light between them…
    if (gather > 0) {
      const gm = range(gather * 1.3 - SE[i] * 0.3, 0, 1);
      const c = L!.C, r = 2 + 6 * SE[i];
      o.x = lerp(o.x, c.x + Math.cos(PH[i] + f.t) * r, gm); o.y = lerp(o.y, c.y + Math.sin(PH[i] + f.t) * r, gm);
      o.a = lerp(o.a, 0.5, gm);
      if (gm > 0.5) o.c = SE[i] < 0.5 ? BRIDGE : INK;
    }
    // …that opens into chapter 08's network of voices (exact at p = 1).
    if (open > 0) {
      const m = range(open * 1.5 - SE[i] * 0.5, 0, 1);
      if (m > 0) {
        futureVisual.place(i, F0, T);
        o.x = lerp(o.x, T.x, m); o.y = lerp(o.y, T.y, m); o.a = lerp(o.a, T.a, m); o.s = lerp(o.s, T.s, m);
        if (m >= 0.5) o.c = T.c;
      }
    }
  },
};
