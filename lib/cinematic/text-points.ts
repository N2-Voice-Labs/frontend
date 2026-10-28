/**
 * Particle targets over a film title's glyphs. The words of a `CinematicText` title are redrawn into a
 * small offscreen canvas at their layout positions, and the inked pixels become points in viewport CSS px,
 * so canvas particles can sit exactly where the letters are and then fly apart.
 */
export type TextPoints = {
  /** x0, y0, x1, y1, … in viewport CSS px (layout position, ignoring CSS transforms). */
  xy: Float32Array;
  /** Index of the word (`.ct-w`, in document order) each point belongs to. */
  word: Uint16Array;
  /** Centre of each word in viewport px: cx0, cy0, cx1, cy1, … */
  wordCentre: Float32Array;
  count: number;
};

export const EMPTY_POINTS: TextPoints = { xy: new Float32Array(0), word: new Uint16Array(0), wordCentre: new Float32Array(0), count: 0 };

type Word = { x: number; y: number; w: number; h: number; text: string; font: string; size: number; spacing: number; lineHeight: number };

/** Deterministic integer hash → [0, 1). */
const hash = (i: number, k: number) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(k + 0x27d4eb2f, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

const px = (v: string) => parseFloat(v) || 0;

/** Layout box of an element in viewport px: offsets summed up the offsetParent chain, so transforms are ignored. */
function layoutOrigin(el: HTMLElement) {
  let x = 0, y = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
    x += e.offsetLeft;
    y += e.offsetTop;
  }
  return { x, y };
}

function readWord(w: HTMLElement): Word | null {
  const inner = w.querySelector<HTMLElement>(".ct-i") ?? w;
  const raw = (inner.textContent ?? "").trim();
  if (!raw || !w.offsetWidth || !w.offsetHeight) return null;
  const ws = getComputedStyle(w);
  const cs = getComputedStyle(inner);
  const { x, y } = layoutOrigin(w);
  const pl = px(ws.paddingLeft), pt = px(ws.paddingTop);
  const size = px(cs.fontSize) || 16;
  // getComputedStyle resolves unitless line-height to px in current browsers; keep a fallback for bare numbers.
  const lh = cs.lineHeight === "normal" || !cs.lineHeight ? 1.2 * size : cs.lineHeight.endsWith("px") ? px(cs.lineHeight) : px(cs.lineHeight) * size;
  return {
    x: x + pl,
    y: y + pt,
    w: w.offsetWidth - pl - px(ws.paddingRight),
    h: w.offsetHeight - pt - px(ws.paddingBottom),
    text: cs.textTransform === "uppercase" ? raw.toUpperCase() : raw,
    font: `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`,
    size,
    spacing: cs.letterSpacing === "normal" ? 0 : px(cs.letterSpacing),
    lineHeight: lh,
  };
}

/** Samples about `target` points over the glyphs of every word in `root`. Returns EMPTY_POINTS where there is no canvas 2D (jsdom, SSR) or no words. */
export function sampleTextPoints(root: HTMLElement, target: number): TextPoints {
  if (typeof window === "undefined" || typeof document === "undefined" || !(target > 0)) return EMPTY_POINTS;
  try {
    const els = Array.from(root.querySelectorAll<HTMLElement>(".ct-w"));
    const words = els.map(readWord);
    if (!words.some(Boolean)) return EMPTY_POINTS;

    // Points only need ~1 per few CSS px, so draw at most ~900 px on the long side: readback and the pixel
    // scan stay well under a few ms, while glyph strokes (≥ ~6 px thick at the smallest title size) survive.
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(1, 900 / Math.max(vw, vh, 1));
    const cw = Math.max(1, Math.ceil(vw * s)), ch = Math.max(1, Math.ceil(vh * s));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return EMPTY_POINTS;

    // Draw in viewport px through the transform. Each word's index is encoded in its colour (R, G in steps
    // of 8, robust to antialias rounding), so every inked pixel knows which word it belongs to.
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const spaced = "letterSpacing" in ctx;
    const centre = new Float32Array(els.length * 2);
    words.forEach((wd, i) => {
      if (!wd) return;
      centre[i * 2] = wd.x + wd.w / 2;
      centre[i * 2 + 1] = wd.y + wd.h / 2;
      if (i >= 1024) return;
      ctx.font = wd.font;
      if (spaced) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${wd.spacing}px`;
      const m = ctx.measureText(wd.text);
      const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? wd.size * 0.8;
      const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? wd.size * 0.2;
      ctx.fillStyle = `rgb(${(i % 32) * 8 + 4},${(i >> 5) * 8 + 4},255)`;
      ctx.fillText(wd.text, wd.x, wd.y + (wd.lineHeight - (ascent + descent)) / 2 + ascent);
    });

    const data = ctx.getImageData(0, 0, cw, ch).data;
    let hits = 0;
    for (let k = 3; k < data.length; k += 4) if (data[k] > 128) hits++;
    if (!hits) return EMPTY_POINTS;

    // Integer grid step that leaves at least `target` hits; the excess is dropped after the shuffle below.
    const step = Math.max(1, Math.floor(Math.sqrt(hits / target)));
    const o = step >> 1;
    const xs: number[] = [], ys: number[] = [], ids: number[] = [];
    for (let y = o; y < ch; y += step) {
      for (let x = o; x < cw; x += step) {
        const k = (y * cw + x) * 4;
        if (data[k + 3] <= 128) continue;
        const id = (data[k] >> 3) + (data[k + 1] >> 3) * 32;
        const n = xs.length;
        xs.push((x + 0.5 + (hash(n, 1) - 0.5) * 0.8) / s);
        ys.push((y + 0.5 + (hash(n, 2) - 0.5) * 0.8) / s);
        ids.push(Math.min(id, els.length - 1));
      }
    }

    // Seeded Fisher–Yates, so any prefix of the points spreads across every letter.
    const total = xs.length;
    const order = new Uint32Array(total);
    for (let i = 0; i < total; i++) order[i] = i;
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(hash(i, 7) * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }

    const count = Math.min(total, Math.round(target));
    const xy = new Float32Array(count * 2);
    const word = new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      const q = order[i];
      xy[i * 2] = xs[q];
      xy[i * 2 + 1] = ys[q];
      word[i] = ids[q];
    }
    return { xy, word, wordCentre: centre, count };
  } catch {
    return EMPTY_POINTS;
  }
}
