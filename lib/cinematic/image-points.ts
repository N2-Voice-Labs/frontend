import { hash, layoutOrigin } from "./text-points";
import { BRIDGE, EN, INK, KO } from "./visual";

/**
 * Particle targets over an image's opaque pixels (the finale's dragon). The decoded image is redrawn into a
 * small offscreen canvas at its layout box, and every opaque pixel on a grid becomes a point in viewport CSS
 * px, coloured with the nearest film colour, so canvas particles can gather into the picture's silhouette.
 */
export type ImagePoints = {
  /** x0, y0, x1, y1, … in viewport CSS px (layout position, ignoring CSS transforms). */
  xy: Float32Array;
  /** PALETTE index of each point, from the pixel's colour. */
  col: Uint8Array;
  /** Layout box of the image in viewport px. */
  box: { x: number; y: number; w: number; h: number };
  count: number;
};

export const EMPTY_IMAGE_POINTS: ImagePoints = { xy: new Float32Array(0), col: new Uint8Array(0), box: { x: 0, y: 0, w: 0, h: 0 }, count: 0 };

/**
 * A pixel's film colour: blue → Sky Blue (KO), cream → Gold (BRIDGE), neutral grey → Silver (EN), the rest
 * (dark lines, pink cheeks and mouth) → ink.
 */
export function paletteFor(r: number, g: number, b: number): number {
  if (r + g + b < 210) return INK;
  if (b > r + 30 && b >= g) return KO;
  if (r > b + 12) return g >= r - 22 ? BRIDGE : INK;
  return EN;
}

/** Samples about `target` points over the opaque pixels of a loaded `img`. EMPTY_IMAGE_POINTS without canvas 2D (jsdom, SSR), before load, or when hidden. */
export function sampleImagePoints(img: HTMLImageElement, target: number): ImagePoints {
  if (typeof window === "undefined" || typeof document === "undefined" || !(target > 0)) return EMPTY_IMAGE_POINTS;
  if (!img.complete || !img.naturalWidth || !img.offsetWidth || !img.offsetHeight) return EMPTY_IMAGE_POINTS;
  try {
    const { x: bx, y: by } = layoutOrigin(img);
    const bw = img.offsetWidth, bh = img.offsetHeight;
    // ~1 point per few CSS px is plenty: draw at most ~600 px on the long side.
    const s = Math.min(1, 600 / Math.max(bw, bh, 1));
    const cw = Math.max(1, Math.ceil(bw * s)), ch = Math.max(1, Math.ceil(bh * s));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return EMPTY_IMAGE_POINTS;
    ctx.drawImage(img, 0, 0, cw, ch);
    const data = ctx.getImageData(0, 0, cw, ch).data;

    let hits = 0;
    for (let k = 3; k < data.length; k += 4) if (data[k] > 128) hits++;
    if (!hits) return EMPTY_IMAGE_POINTS;

    const step = Math.max(1, Math.floor(Math.sqrt(hits / target)));
    const o = step >> 1;
    const xs: number[] = [], ys: number[] = [], cs: number[] = [];
    for (let y = o; y < ch; y += step) {
      for (let x = o; x < cw; x += step) {
        const k = (y * cw + x) * 4;
        if (data[k + 3] <= 128) continue;
        const n = xs.length;
        // Jitter across a whole grid cell, so the silhouette reads as stipple rather than a grid.
        xs.push(bx + (x + 0.5 + (hash(n, 3) - 0.5) * step) / s);
        ys.push(by + (y + 0.5 + (hash(n, 4) - 0.5) * step) / s);
        cs.push(paletteFor(data[k], data[k + 1], data[k + 2]));
      }
    }

    // Seeded Fisher–Yates, so any prefix of the points spreads over the whole silhouette.
    const total = xs.length;
    const order = new Uint32Array(total);
    for (let i = 0; i < total; i++) order[i] = i;
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(hash(i, 11) * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }

    const count = Math.min(total, Math.round(target));
    const xy = new Float32Array(count * 2);
    const col = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const q = order[i];
      xy[i * 2] = xs[q];
      xy[i * 2 + 1] = ys[q];
      col[i] = cs[q];
    }
    return { xy, col, box: { x: bx, y: by, w: bw, h: bh }, count };
  } catch {
    return EMPTY_IMAGE_POINTS;
  }
}
