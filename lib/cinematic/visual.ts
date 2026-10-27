import { clamp, frac } from "@/lib/landing/math";

/**
 * Canvas visuals. One fixed canvas draws the whole film with a single particle set; every chapter is a
 * `SceneVisual` that says where each particle sits ("formation") and may draw extra lines and labels.
 * Between chapters the stage morphs particles from the previous formation into the next one, so each
 * scene grows out of the last.
 */
export type Frame = {
  w: number;
  h: number;
  /** Seconds since start (frozen under reduced motion). */
  t: number;
  /** 0–1 progress through this chapter. */
  p: number;
  /** Number of particles. */
  n: number;
  portrait: boolean;
  /** min(w, h) */
  u: number;
};

/** Particle colours: indexes into PALETTE. */
export const INK = 0, KO = 1, EN = 2, BRIDGE = 3, DIM = 4;

export const PALETTE = ["#ECE7DC", "#7CCFC2", "#E3A2C2", "#EED596", "#6E6A63"] as const;

export type Point = { x: number; y: number; a: number; c: number; s: number };

export type SceneVisual = {
  place(i: number, f: Frame, o: Point): void;
  /** Lines and labels on top of the particles; `alpha` is how present the chapter is (0–1). */
  draw?(ctx: CanvasRenderingContext2D, f: Frame, alpha: number): void;
};

/** Deterministic per-particle random in [0, 1). */
export const rnd = (i: number, k: number) => frac(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0 before `a`, 1 after `b`, smooth in between. */
export const range = (v: number, a: number, b: number) => {
  const c = clamp((v - a) / (b - a));
  return c * c * (3 - 2 * c);
};

/** 1 inside [a, b], easing in and out over `edge`. */
export const window01 = (v: number, a: number, b: number, edge = 0.04) => range(v, a - edge, a) * (1 - range(v, b, b + edge));

/** Speech-like amplitude at time `t`: syllables with pauses, 0–1. */
export function syllables(t: number, seed: number) {
  const s = Math.sin(t * 7.3 + seed) * 0.5 + 0.5;
  const word = Math.sin(t * 1.9 + seed * 2.1) * 0.5 + 0.5;
  return clamp(s * 0.6 + 0.4) * range(word, 0.18, 0.5);
}

/** Vertical offset of a waveform particle at `x` (0–1 along the wave). */
export function waveY(x: number, t: number, amp: number, seed: number) {
  const env = Math.sin(Math.PI * clamp(x));
  return amp * env * (Math.sin(x * 38 + t * 9 + seed) * 0.6 + Math.sin(x * 91 - t * 13 + seed * 3) * 0.4);
}

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha: number, color: string = PALETTE[INK], align: CanvasTextAlign = "center", size = 11) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = `${size}px ${monoFont()}`;
  ctx.fillText(text, x, y);
}

let mono: string | null = null;
function monoFont() {
  if (mono === null) mono = getComputedStyle(document.documentElement).getPropertyValue("--font-code").trim() || "monospace";
  return mono;
}
