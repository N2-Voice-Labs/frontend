import { isPortrait } from "@/components/scenes/bridge/geometry";
import { gsap } from "@/lib/cinematic/gsap";
import { BRANCHES, REASON_INPUTS, type StageId } from "../beats";

/**
 * The engine laid out in WORLD space: one continuous runtime path through the seven stage regions
 * (STAGES order), with the reasoning field and its branches. At camera zoom 1 centred on the screen the
 * whole runtime fits the viewport (that is the `runtime` beat); every other beat is a close-up of a
 * region of the same world. World units are viewport px at zoom 1, so everything follows resizes.
 *
 * Desktop: a long horizontal path with gentle curves. Portrait: a vertical path with one gentle bend.
 * The CAMERA table (centre as fractions of w/h, zoom, rotation) is built from the same layout at a
 * nominal size, so the scroll timeline stays size-independent.
 */

export { isPortrait };
export type P2 = { x: number; y: number };
/** A point on the spine with unit tangent (t) and normal (n). n = rotate(t, +90°): desktop "down", portrait "left". */
export type SP = P2 & { tx: number; ty: number; nx: number; ny: number };

/** Positions along the spine (0–1). */
export const U = {
  start: -0.06,
  end: 1.06,
  vinA: 0.008, vin: 0.055, vinB: 0.102,
  vadA: 0.13, vad: 0.18, vadB: 0.23,
  sttA: 0.25, stt: 0.295, sttB: 0.34,
  /** Where the assembled sentence drifts to and breaks into meaning. */
  sent: 0.362,
  und: 0.4,
  reason: 0.5,
  respond: 0.635,
  ttsA: 0.69, tts: 0.745, ttsB: 0.8,
  voutA: 0.82, vout: 0.885, voutB: 0.95,
} as const;

/** T0–T4: speech start, turn end, understanding, response, first audio. */
export const MARKER_U = [U.vinA, U.vadB - 0.004, U.und, U.respond, U.voutA] as const;
/** Where each stage's runtime label sits (agent/tools are placed by the field and the TOOLS branch). */
export const STAGE_U: Record<StageId, number> = { "voice-in": U.vin, vad: U.vad, stt: U.stt, agent: U.reason, tools: U.reason, tts: U.tts, "voice-out": U.vout };

/** Reason inputs and branches around the field: angle from the path tangent (deg, + towards n) and radius in R. */
const INPUT_THETA: Record<(typeof REASON_INPUTS)[number], number> = { HISTORY: -160, INTENT: -128, LANGUAGE: -96, CONTEXT: -64, TOOLS: -32, KNOWLEDGE: 160 };
const BRANCH_AT: Record<(typeof BRANCHES)[number], { th: number; k: number; portrait: boolean }> = {
  CONTEXT: { th: -112, k: 2.5, portrait: true },
  KNOWLEDGE: { th: -55, k: 2.35, portrait: false },
  TOOLS: { th: 80, k: 2.9, portrait: true },
  INTEGRATIONS: { th: 35, k: 2.5, portrait: false },
  MEMORY: { th: 132, k: 2.4, portrait: true },
};

function spineXY(u: number, w: number, h: number, portrait: boolean): P2 {
  // Phases chosen so the VOICE IN wave sits on an extremum (flat tangent) and, in portrait, the field near the centre.
  if (portrait) return { x: w * (0.5 + 0.14 * Math.sin(2 * Math.PI * (0.562 * u + 0.219))), y: h * (0.08 + 0.84 * u) };
  return { x: w * (0.05 + 0.9 * u), y: h * (0.45 + 0.03 * Math.sin(2 * Math.PI * (1.2 * u + 0.184))) };
}

export function engineGeometry(w: number, h: number) {
  const portrait = isPortrait(w, h);
  const S = Math.min(w, h);

  const at = (u: number): SP => {
    const a = spineXY(u - 0.0005, w, h, portrait), b = spineXY(u + 0.0005, w, h, portrait), o = spineXY(u, w, h, portrait);
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const tx = dx / l, ty = dy / l;
    return { x: o.x, y: o.y, tx, ty, nx: -ty, ny: tx };
  };
  const pt = (u: number, v = 0): P2 => {
    const s = at(u);
    return { x: s.x + s.nx * v, y: s.y + s.ny * v };
  };
  const dist = (a: P2, b: P2) => Math.hypot(b.x - a.x, b.y - a.y);
  const spanLen = (u0: number, u1: number) => dist(pt(u0), pt(u1));
  /** Zoom at which the span u0…u1 fills `fill` of the screen along the path's main direction. */
  const spanZ = (u0: number, u1: number, fill: number) => (fill * (portrait ? h : w)) / spanLen(u0, u1);

  // The reasoning field: on the path, radius R; inputs converge from inR·R, branches leave towards k·R.
  const R = S * 0.075;
  const c = pt(U.reason);
  const tc = at(U.reason);
  const polar = (th: number, k: number): P2 => {
    const a = (th * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    return { x: c.x + R * k * (ca * tc.tx + sa * tc.nx), y: c.y + R * k * (ca * tc.ty + sa * tc.ny) };
  };
  const inR = portrait ? 1.6 : 2.0;
  const inputs = REASON_INPUTS.map((id, i) => {
    const th = INPUT_THETA[id];
    const from = polar(th, inR), to = polar(th + 40, 0.32), ctrl = polar(th + 32, inR * 0.62);
    return { id, i, th, from, to, ctrl, dir: { x: (from.x - c.x) / (R * inR), y: (from.y - c.y) / (R * inR) } };
  });
  const branches = BRANCHES.filter((id) => !portrait || BRANCH_AT[id].portrait).map((id) => {
    const b = BRANCH_AT[id];
    const from = polar(b.th * 0.7, 0.92), end = polar(b.th, b.k * (portrait ? 0.9 : 1));
    return { id, from, end, dir: { x: (end.x - c.x) / dist(c, end), y: (end.y - c.y) / dist(c, end) } };
  });
  const tools = branches.find((b) => b.id === "TOOLS")!;

  /** Close-up zoom per beat (the camera table uses the same formulas at a nominal size). */
  const Z = {
    wave: w / spanLen(U.vinA, U.vinB),
    dive: (w / spanLen(U.vinA, U.vinB)) * 2.4,
    vad: spanZ(U.vadA - 0.012, U.vadB + 0.012, 0.62),
    stt: spanZ(U.sttA - 0.01, U.sent + 0.01, 0.62),
    und: spanZ(U.sent - 0.012, U.und + 0.05, 0.6),
    reason: (0.8 * S) / (2 * (inR + 0.3) * R),
    act: (0.74 * S) / (dist(c, tools.end) + 2.4 * R),
    respond: spanZ(U.reason + 0.06, U.respond + 0.04, 0.6),
    tts: spanZ(U.ttsA - 0.012, U.ttsB + 0.02, 0.62),
  };

  /** Builds a world path along the spine from u0 to u1 with normal offset v(s), s = 0…1. Two decimals: zoom reaches ~30×. */
  const along = (u0: number, u1: number, n: number, v: (s: number) => number) => {
    let d = "";
    for (let i = 0; i <= n; i++) {
      const s = i / n, q = at(u0 + (u1 - u0) * s), o = v(s);
      d += (i ? "L" : "M") + n2(q.x + q.nx * o) + " " + n2(q.y + q.ny * o);
    }
    return d;
  };

  return {
    w, h, S, portrait, R, c, tc, inR, inputs, branches, tools, Z,
    at, pt, dist, along,
    spine: along(U.start, U.end, 220, () => 0),
    vars: { "--W": `${w}px`, "--H": `${h}px` } as Record<string, string>,
  };
}

export type Geo = ReturnType<typeof engineGeometry>;

export const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

// ---------------------------------------------------------------- camera

export type Cam = { cx: number; cy: number; z: number; r: number };
type Target = { x: number; y: number; z: number; r: number };

/** Every framing of the film, in world px for a given layout. */
function targets(G: Geo): Record<string, Target> {
  const { pt, Z, c, R, tc, tools, w, h } = G;
  const vin = G.at(U.vin);
  const r = (-Math.atan2(vin.ty, vin.tx) * 180) / Math.PI;
  const P = (u: number, z: number, rr = 0): Target => ({ ...pt(u), z, r: rr });
  const off = (a: number, b: number) => ({ x: c.x + R * (a * tc.tx + b * tc.nx), y: c.y + R * (a * tc.ty + b * tc.ny) });
  return {
    wave: P(U.vin, Z.wave, r),
    dive: P(U.vin + 0.014, Z.dive, r),
    vad0: P(U.vad, Z.vad),
    vad1: P(U.vad + 0.012, Z.vad * 1.07),
    stt0: P(U.stt + 0.012, Z.stt),
    stt1: P(U.stt + 0.026, Z.stt * 1.06),
    und0: P(U.und - 0.01, Z.und),
    und1: P(U.und, Z.und * 1.07),
    rs0: { ...off(-0.35, -0.25), z: Z.reason * 0.9, r: 0 },
    rs1: { ...off(0.3, 0.2), z: Z.reason, r: 0 },
    rs2: { ...c, z: Z.reason * 1.14, r: 0 },
    act0: { x: (c.x + tools.end.x) / 2, y: (c.y + tools.end.y) / 2, z: Z.act, r: 0 },
    act1: P(U.respond - 0.025, Z.respond * 0.85),
    rp0: P(U.respond + 0.008, Z.respond),
    rp1: P(U.respond + 0.02, Z.respond * 1.06),
    tts0: P(U.tts, Z.tts),
    tts1: P(U.tts + 0.016, Z.tts * 1.05),
    // Landscape: a little further back and shifted right, so VOICE IN clears the chapter list on the left.
    rt0: h > w * 1.15 ? { x: w / 2, y: h / 2, z: 1, r: 0 } : { x: w * 0.47, y: h / 2, z: 0.82, r: 0 },
    rt1: h > w * 1.15 ? { x: w / 2, y: h / 2, z: 0.95, r: 0 } : { x: w * 0.47, y: h / 2, z: 0.78, r: 0 },
    exit: P(U.vout, 0.42),
    multiply: P(U.vout, 0.26),
  };
}

/** Camera moves in chapter progress; each tween starts where the previous ended (no overlaps). `u` = how far the spine is revealed. */
const MOVES = [
  { at: 0.035, dur: 0.085, to: "dive", ease: "power2.in", u: 0.12 },
  { at: 0.12, dur: 0.035, to: "vad0", ease: "power2.inOut", u: 0.245 },
  { at: 0.155, dur: 0.08, to: "vad1", ease: "sine.inOut", u: 0.245 },
  { at: 0.24, dur: 0.03, to: "stt0", ease: "power2.inOut", u: 0.37 },
  { at: 0.27, dur: 0.065, to: "stt1", ease: "sine.inOut", u: 0.37 },
  { at: 0.34, dur: 0.025, to: "und0", ease: "power2.inOut", u: 0.45 },
  { at: 0.365, dur: 0.05, to: "und1", ease: "sine.inOut", u: 0.45 },
  { at: 0.42, dur: 0.03, to: "rs0", ease: "power2.inOut", u: 0.56 },
  { at: 0.45, dur: 0.035, to: "rs1", ease: "sine.inOut", u: 0.56 },
  { at: 0.485, dur: 0.035, to: "rs2", ease: "sine.inOut", u: 0.56 },
  { at: 0.52, dur: 0.035, to: "act0", ease: "power2.inOut", u: 0.6 },
  { at: 0.555, dur: 0.045, to: "act1", ease: "power2.inOut", u: 0.66 },
  { at: 0.6, dur: 0.02, to: "rp0", ease: "power2.out", u: 0.68 },
  { at: 0.62, dur: 0.04, to: "rp1", ease: "sine.inOut", u: 0.68 },
  { at: 0.66, dur: 0.025, to: "tts0", ease: "power2.inOut", u: 0.82 },
  { at: 0.685, dur: 0.035, to: "tts1", ease: "sine.inOut", u: 0.82 },
  { at: 0.72, dur: 0.06, to: "rt0", ease: "power3.inOut", u: U.end },
  { at: 0.78, dur: 0.1, to: "rt1", ease: "sine.inOut", u: U.end },
  { at: 0.88, dur: 0.06, to: "exit", ease: "power2.in", u: U.end },
  { at: 0.94, dur: 0.06, to: "multiply", ease: "power1.out", u: U.end },
] as const;

const frac = (G: Geo, t: Target): Cam => ({ cx: t.x / G.w, cy: t.y / G.h, z: t.z, r: t.r });
function table(w: number, h: number) {
  const G = engineGeometry(w, h);
  const T = targets(G);
  return { start: frac(G, T.wave), moves: MOVES.map((m) => frac(G, T[m.to])) };
}

/** Landscape (L) and portrait (P) camera keys, from nominal layouts. */
export const CAMERA = {
  L: table(1440, 900),
  P: table(390, 844),
  moves: MOVES,
  /** Spine reveal (0–1 of its normalised length) per move, and at the start. */
  reveal: (u: number) => Math.min(1, (u - U.start) / (U.end - U.start)),
};

const EASES = new Map<string, (x: number) => number>();
const easeFn = (name: string) => {
  let e = EASES.get(name);
  if (!e) { e = gsap.parseEase(name) as (x: number) => number; EASES.set(name, e); }
  return e;
};
const out: Cam = { cx: 0.5, cy: 0.5, z: 1, r: 0 };

/** The camera at chapter progress p, exactly as the scroll tweens place it (for the time loop's own maths). */
export function cameraAt(p: number, portrait: boolean): Cam {
  const T = portrait ? CAMERA.P : CAMERA.L;
  let a = T.start;
  for (let i = 0; i < MOVES.length; i++) {
    const m = MOVES[i], b = T.moves[i];
    if (p >= m.at + m.dur) { a = b; continue; }
    if (p > m.at) {
      const k = easeFn(m.ease)((p - m.at) / m.dur);
      out.cx = a.cx + (b.cx - a.cx) * k;
      out.cy = a.cy + (b.cy - a.cy) * k;
      out.z = a.z + (b.z - a.z) * k;
      out.r = a.r + (b.r - a.r) * k;
      return out;
    }
    break;
  }
  out.cx = a.cx; out.cy = a.cy; out.z = a.z; out.r = a.r;
  return out;
}
