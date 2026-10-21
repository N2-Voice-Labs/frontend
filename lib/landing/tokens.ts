import { THEME_ATTRIBUTE } from "@/lib/theme";

export type CanvasTokens = { ink: string; muted: string; teal: string; plum: string; lime: string; coral: string; mono: string };

let cached: CanvasTokens | null = null;
let observing = false;

/**
 * Theme colours for canvas drawing. Read once per theme instead of calling getComputedStyle every frame;
 * the cache is dropped whenever <html data-vl-theme> changes.
 */
export function canvasTokens(): CanvasTokens {
  if (!observing && typeof MutationObserver !== "undefined") {
    observing = true;
    new MutationObserver(() => { cached = null; }).observe(document.documentElement, { attributes: true, attributeFilter: [THEME_ATTRIBUTE] });
  }
  if (!cached) {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string) => cs.getPropertyValue(name).trim();
    cached = { ink: v("--ink"), muted: v("--muted"), teal: v("--teal"), plum: v("--plum"), lime: v("--lime"), coral: v("--coral"), mono: v("--font-code") };
  }
  return cached;
}

/**
 * Sizes the backing store to the canvas's CSS size `w`×`h` (tracked by a ResizeObserver, so drawing
 * never reads layout) at DPR ≤ 2, and clears it. Returns false when there is nothing to draw.
 */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (!w || !h) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return true;
}
