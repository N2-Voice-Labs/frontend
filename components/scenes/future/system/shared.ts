import { CONNECTIONS, NODES, type Connection, type GlobeFrame } from "./globe";

/** Chapter 08 reuses chapter 05's vocabulary (colours, glow, labels, dots, tween helper); this adds its own contract. */
export { C, Dot, GLOW, Label, dotsD, makeTw, n2, s, speech, type Tw } from "@/components/scenes/engine/system/shared";

/**
 * Per-frame drawing of a part: chapter progress, seconds, the globe camera at p (globe.ts, the same frame
 * the canvas draws its distant points with), and whether this is the still figure (plain document /
 * reduced motion), where transient things hold a readable pose instead of moving.
 */
export type Painter = (p: number, t: number, F: GlobeFrame, still: boolean) => void;
export type Bind = (svg: SVGSVGElement, portrait: boolean) => Painter;

/** Living elements are marked data-fs-live (chapter 05 uses data-es-live, chapter 06 data-ws-live). */
export const one = (svg: SVGSVGElement, k: string) => svg.querySelector<SVGElement>(`[data-fs-live="${k}"]`);
export const all = (svg: SVGSVGElement, k: string) => Array.from(svg.querySelectorAll<SVGElement>(`[data-fs-live="${k}"]`));

/** Attribute writes skip unchanged values (the painters run every frame). */
export const setA = (el: Element | null | undefined, k: string, v: string) => { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };
export const op = (el: Element | null | undefined, v: number) => setA(el, "opacity", v <= 0.003 ? "0" : v.toFixed(3));

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
export const range = (v: number, a: number, b: number) => smooth((v - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Chapter 07's conversation: Seoul (node 0) and Toronto (the EN hub of the Toronto region). Looked up rather
 * than taken as NODES[1] / CONNECTIONS[0], because nodes are generated region by region (NODES[1] is a
 * second Seoul node); if the model's connection 0 already joins the two hubs it is used as is.
 */
export const SEOUL = NODES[0];
export const TORONTO = NODES.find((n) => n.region === 1 && n.tag === "EN") ?? NODES[1];
export const TALK: Connection =
  CONNECTIONS.find((c) => (c.a === SEOUL.i && c.b === TORONTO.i) || (c.a === TORONTO.i && c.b === SEOUL.i))
  ?? { ...CONNECTIONS[0], a: SEOUL.i, b: TORONTO.i, far: true };
