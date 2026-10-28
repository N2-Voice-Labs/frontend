import type { ReactNode, SVGProps } from "react";
import { BRIDGE, DIM, EN, INK, KO, PALETTE } from "@/lib/cinematic/visual";
import { n2, type Cam, type Geo, type P2 } from "./geometry";
import s from "./engine-system.module.css";

/** Shared vocabulary of the engine's parts: colours, painter contract, tween helper, counter-scaled labels. */

export const C = { ink: PALETTE[INK], ko: PALETTE[KO], en: PALETTE[EN], gold: PALETTE[BRIDGE], dim: PALETTE[DIM] };
export const GLOW = "url(#es-glow)";
export const TAU = Math.PI * 2;
export { n2 };

/** Per-frame drawing of a part: chapter progress, seconds, the camera at p. Writes through the DOM only. */
export type Painter = (p: number, t: number, cam: Cam) => void;
/** Collects a part's live elements for the current geometry and returns its painter. */
export type Bind = (svg: SVGSVGElement, G: Geo) => Painter;

export const one = (svg: SVGSVGElement, k: string) => svg.querySelector<SVGElement>(`[data-es-live="${k}"]`);
export const all = (svg: SVGSVGElement, k: string) => Array.from(svg.querySelectorAll<SVGElement>(`[data-es-live="${k}"]`));
export const setA = (el: Element | null | undefined, k: string, v: string) => { if (el) el.setAttribute(k, v); };
export const op = (el: Element | null | undefined, v: number) => { if (el) el.setAttribute("opacity", v <= 0.002 ? "0" : v.toFixed(3)); };
export const move = (el: Element | null | undefined, x: number, y: number) => { if (el) el.setAttribute("transform", `translate(${n2(x)} ${n2(y)})`); };

/** Scroll tweens on selectors inside the chapter layer; missing targets are skipped. */
export type Tw = {
  fromTo(sel: string, from: gsap.TweenVars, to: gsap.TweenVars, at: number): void;
  to(sel: string, vars: gsap.TweenVars, at: number): void;
};
export function makeTw(tl: gsap.core.Timeline, q: (selector: string) => Element[]): Tw {
  return {
    fromTo(sel, from, to, at) { const t = q(sel); if (t.length) tl.fromTo(t, from, to, at); },
    to(sel, vars, at) { const t = q(sel); if (t.length) tl.to(t, vars, at); },
  };
}

/** Speech-like oscillation, 0 at both ends of s ∈ [0, 1]. */
export function speech(x: number, t: number, periods: number, phase: number) {
  return Math.sin(Math.PI * x) * (0.55 + 0.45 * Math.sin(t * 2.3 + x * 4 + phase)) * Math.sin(TAU * periods * x - t * 7 + phase);
}

/** Many dots in ONE path: zero-length round-capped segments (stroke-width = dot diameter in screen px). */
export function dotsD(xs: ArrayLike<number>, ys: ArrayLike<number>, n: number, keep?: (i: number) => boolean) {
  let d = "";
  for (let i = 0; i < n; i++) if (!keep || keep(i)) d += `M${n2(xs[i])} ${n2(ys[i])}h0.01`;
  return d || "M-9999 -9999h0.01";
}

/** Quadratic bezier point. */
export function quad(a: P2, c: P2, b: P2, t: number, o: { x: number; y: number }) {
  const m = 1 - t;
  o.x = m * m * a.x + 2 * m * t * c.x + t * t * b.x;
  o.y = m * m * a.y + 2 * m * t * c.y + t * t * b.y;
  return o;
}

/** Estimated advance of mono text with Hangul at `size` px (used with textLength so fragments align with the sentence). */
export function textWidth(text: string, size: number) {
  let w = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    w += (c >= 0xac00 && c <= 0xd7a3) || (c >= 0x3130 && c <= 0x318f) ? 0.95 : 0.6;
  }
  return w * size;
}

/** Where small texts go relative to their anchor: away from the path (desktop up, portrait right). */
export const side = (G: Geo) => (G.portrait ? { x: 1, y: 0 } : { x: 0, y: -1 });

type LabelProps = {
  at: P2;
  dx?: number;
  dy?: number;
  anchor?: "start" | "middle" | "end";
  cls?: "label" | "tiny" | "token" | "word";
  g?: SVGProps<SVGGElement> & Record<`data-${string}`, string | number | undefined>;
  text?: SVGProps<SVGTextElement> & Record<`data-${string}`, string | number | undefined>;
  children: ReactNode;
};

/**
 * A label pinned to a world point but drawn at screen size: the outer group sits in world space (the time
 * loop may move it), the inner group undoes the camera's zoom and rotation, so dx/dy and the font are in px.
 */
export function Label({ at, dx = 0, dy = 0, anchor = "middle", cls = "label", g, text, children }: LabelProps) {
  return (
    <g transform={`translate(${n2(at.x)} ${n2(at.y)})`} {...g}>
      <g className={s.cs}>
        <text className={s[cls]} x={dx} y={dy} textAnchor={anchor} dominantBaseline="middle" {...text}>{children}</text>
      </g>
    </g>
  );
}

/** A small luminous point at screen size, pinned to a world point (packets, nodes). */
export function Dot({ at, r = 2.6, fill = C.gold, glow = true, g, c }: {
  at: P2;
  r?: number;
  fill?: string;
  glow?: boolean;
  g?: SVGProps<SVGGElement> & Record<`data-${string}`, string | number | undefined>;
  c?: SVGProps<SVGCircleElement> & Record<`data-${string}`, string | number | undefined>;
}) {
  return (
    <g transform={`translate(${n2(at.x)} ${n2(at.y)})`} {...g}>
      <g className={s.cs}>
        <circle r={r} fill={fill} filter={glow ? GLOW : undefined} {...c} />
      </g>
    </g>
  );
}

export { s };
