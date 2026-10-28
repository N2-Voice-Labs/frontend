import { C } from "@/components/scenes/engine/system/shared";
import type { Lang } from "../beats";
import type { Cam, Geo } from "./geometry";

/** Chapter 06 reuses chapter 05's vocabulary (colours, labels, dots, tween helper); this adds its own contract. */
export { C, Dot, GLOW, Label, dotsD, makeTw, op, s, setA, speech, type Tw } from "@/components/scenes/engine/system/shared";

/**
 * Per-frame drawing of a part: chapter progress, seconds, the camera at p, and whether this is the still
 * figure (plain document / reduced motion), where transient things hold a readable pose instead of moving.
 */
export type Painter = (p: number, t: number, cam: Cam, still: boolean) => void;
export type Bind = (svg: SVGSVGElement, G: Geo) => Painter;

/** Living elements are marked data-ws-live (chapter 05 uses data-es-live). */
export const one = (svg: SVGSVGElement, k: string) => svg.querySelector<SVGElement>(`[data-ws-live="${k}"]`);
export const all = (svg: SVGSVGElement, k: string) => Array.from(svg.querySelectorAll<SVGElement>(`[data-ws-live="${k}"]`));

/** Restrained palette: KO cyan, EN magenta, the rest warm white; never a rainbow. */
export const langColour = (l: Lang) => (l === "ko" ? C.ko : l === "en" ? C.en : C.ink);

export const frac = (v: number) => v - Math.floor(v);
