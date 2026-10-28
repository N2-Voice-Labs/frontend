import { isPortrait } from "@/components/scenes/bridge/geometry";
import type { Speaker } from "../conversation-events";

/**
 * Chapter 07's stage in screen px, shared by the SVG, the canvas and the typography. Two portraits face
 * each other (desktop: left and right; phones: stacked, Minji above, Daniel below) and one signal runs from
 * mouth to mouth: Minji's lane, the middle (Voice Labs, almost invisible), Daniel's lane.
 */

export type P2 = { x: number; y: number };
export type SP = P2 & { nx: number; ny: number };

/** Lanes along the signal (0 = Minji's mouth, 1 = Daniel's). */
export const LANE = { minji: [0, 0.36], mid: [0.36, 0.64], daniel: [0.64, 1] } as const;

const N = 240;

export function realityLayout(w: number, h: number) {
  const portrait = isPortrait(w, h);
  const H = portrait ? Math.min(h * 0.2, w * 0.42) : Math.min(h * 0.36, w * 0.2);
  const head = (s: Speaker) => {
    const left = s === "minji";
    const c = portrait ? { x: w * (left ? 0.3 : 0.7), y: h * (left ? 0.21 : 0.72) } : { x: w * (left ? 0.21 : 0.79), y: h * 0.46 };
    const dir = left ? 1 : -1;
    // The mouth of the profile (portrait.ts: (0.3, 0.21) in head units, facing +x).
    const mouth = { x: c.x + dir * 0.31 * H, y: c.y + 0.2 * H };
    return { c, dir, mouth };
  };
  const minji = head("minji"), daniel = head("daniel");
  const A = { x: minji.mouth.x + 0.14 * H, y: minji.mouth.y };
  const B = { x: daniel.mouth.x - 0.14 * H, y: daniel.mouth.y };
  const c1 = portrait ? { x: A.x + w * 0.36, y: A.y + h * 0.14 } : { x: A.x + (B.x - A.x) / 3, y: A.y + h * 0.015 };
  const c2 = portrait ? { x: B.x - w * 0.36, y: B.y - h * 0.14 } : { x: B.x - (B.x - A.x) / 3, y: B.y + h * 0.015 };
  const bez = (t: number): P2 => {
    const m = 1 - t;
    return {
      x: m * m * m * A.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * B.x,
      y: m * m * m * A.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * B.y,
    };
  };
  // Arc-length table, so s ∈ [0, 1] is uniform along the signal.
  const ts = new Float64Array(N + 1), ls = new Float64Array(N + 1);
  let prev = bez(0);
  for (let i = 1; i <= N; i++) {
    const q = bez(i / N);
    ls[i] = ls[i - 1] + Math.hypot(q.x - prev.x, q.y - prev.y);
    ts[i] = i / N;
    prev = q;
  }
  const len = ls[N];
  const tOf = (s: number) => {
    const L = Math.max(0, Math.min(1, s)) * len;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ls[m] < L) lo = m; else hi = m; }
    const f = (L - ls[lo]) / (ls[hi] - ls[lo] || 1);
    return ts[lo] + (ts[hi] - ts[lo]) * f;
  };
  /** Point at s with unit normal (pointing "up" on desktop). */
  const at = (s: number, o?: SP): SP => {
    const t = tOf(s), q = bez(t), a = bez(Math.max(0, t - 0.002)), b = bez(Math.min(1, t + 0.002));
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const r = o ?? { x: 0, y: 0, nx: 0, ny: 0 };
    r.x = q.x; r.y = q.y; r.nx = dy / l; r.ny = -dx / l;
    return r;
  };

  const C = at(0.5);
  const strip = portrait ? { x0: 24, x1: w - 24, y: h * 0.905 } : { x0: A.x, x1: B.x, y: h * 0.83 };

  /** DOM positions (px), written as CSS vars by the scene. */
  const vars: Record<string, string> = portrait
    ? {
      "--rl-m-x": `${minji.c.x + 0.5 * H}px`, "--rl-m-y": `${minji.c.y - 0.42 * H}px`, "--rl-m-a": "0%",
      "--rl-d-x": `${daniel.c.x - 0.5 * H}px`, "--rl-d-y": `${daniel.c.y + 0.45 * H}px`, "--rl-d-a": "-100%",
      "--rl-ml-x": "20px", "--rl-ml-y": `${minji.c.y + 0.72 * H}px`, "--rl-ml-t": "0%",
      "--rl-dl-x": "20px", "--rl-dl-y": `${daniel.c.y - 0.72 * H}px`, "--rl-dl-t": "-100%",
      "--rl-lw": `${w - 40}px`,
      "--rl-c-x": `${C.x}px`, "--rl-c-y": `${C.y}px`,
    }
    : {
      "--rl-m-x": `${minji.c.x}px`, "--rl-m-y": `${minji.c.y + 0.98 * H}px`, "--rl-m-a": "-50%",
      "--rl-d-x": `${daniel.c.x}px`, "--rl-d-y": `${daniel.c.y + 0.98 * H}px`, "--rl-d-a": "-50%",
      "--rl-ml-x": `${A.x}px`, "--rl-ml-y": `${A.y - 0.3 * H}px`, "--rl-ml-t": "-100%",
      "--rl-dl-x": `${w - B.x}px`, "--rl-dl-y": `${B.y - 0.3 * H}px`, "--rl-dl-t": "-100%",
      "--rl-lw": `${(B.x - A.x) * 0.5}px`,
      "--rl-c-x": `${C.x}px`, "--rl-c-y": `${C.y}px`,
    };

  return { w, h, portrait, H, minji, daniel, A, B, C, at, len, strip, vars };
}

export type Layout = ReturnType<typeof realityLayout>;

export const n2 = (v: number) => (Math.round(v * 100) / 100).toString();
