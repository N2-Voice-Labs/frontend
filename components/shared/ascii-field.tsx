"use client";

import { useEffect, useRef } from "react";
import { clamp } from "@/lib/landing/math";
import { onBackgroundClick, pointer, pointerActive, rippleRadius, trackPointer } from "@/lib/landing/pointer";
import { useReducedMotion, useScrollEffect } from "@/lib/landing/scroll";
import { canvasTokens, fitCanvas } from "@/lib/landing/tokens";
import { useElementSize } from "@/lib/landing/use-size";

const CHARS = " .:-=+*#";
const CW = 10, CH = 16;
const FRAME_MS = 50; // ~20 fps
const RING_SPEED = 0.45; // px per ms
const R2 = 130 * 130; // cursor "loudness" radius, squared
const ALPHA_STEPS = 16;
const COLOURS = 3; // muted, lime, teal

/**
 * Animated ASCII "noise" field behind the footer wordmark. Draws only while on screen, at ~20 fps; with
 * reduced motion it draws one static frame (and again on resize or theme change).
 * The cursor is a voice: characters get denser and teal around it, and a background click sends a ring
 * through the field.
 */
export function AsciiField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const needsDraw = useRef(true);
  const size = useElementSize(ref, () => { needsDraw.current = true; });
  /** Canvas position in the viewport, refreshed in the shared scroll frame (never read per draw). */
  const rect = useRef({ left: 0, top: 0 });

  useScrollEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) rect.current = { left: r.left, top: r.top };
  });

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx) return;
    trackPointer();
    // `onScreen`: any part visible (draw a still frame). `focused`: at least half visible, the only time it
    // animates by itself, so it does not compete with the closing section's ripples above it.
    let onScreen = false, focused = false, last = -Infinity, frame = 0, heat = 0;
    const rings: { x: number; y: number; t0: number; r: number }[] = [];
    // Cells grouped by colour × quantised alpha: flat [x, y, charIndex, …] per group.
    const groups: number[][] = Array.from({ length: COLOURS * ALPHA_STEPS }, () => []);

    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      focused = e.intersectionRatio >= 0.5;
      rect.current = { left: e.boundingClientRect.left, top: e.boundingClientRect.top };
    }, { threshold: [0, 0.5] });
    io.observe(canvas);
    const mo = new MutationObserver(() => { needsDraw.current = true; });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-vl-theme"] });
    const offClick = onBackgroundClick((cx, cy) => {
      if (reduce) return;
      const { w, h } = size.current;
      const x = cx - rect.current.left, y = cy - rect.current.top;
      if (x < 0 || x > w || y < 0 || y > h) return;
      rings.push({ x, y, t0: performance.now(), r: 0 });
      if (rings.length > 5) rings.shift();
    });

    const draw = (now: number) => {
      const { w, h } = size.current;
      if (!fitCanvas(canvas, ctx, w, h)) return;
      const { muted, lime, teal, mono } = canvasTokens();
      ctx.font = `12px ${mono}`;
      ctx.textBaseline = "top";
      const t = reduce ? 0 : now / 1000;
      const px = pointer.x - rect.current.left, py = pointer.y - rect.current.top;
      const inside = !reduce && pointerActive() && px >= 0 && px <= w && py >= 0 && py <= h;
      heat += ((inside ? 1 : 0) - heat) * 0.12;
      for (let k = rings.length - 1; k >= 0; k--) {
        rings[k].r = rippleRadius(now, rings[k].t0, RING_SPEED);
        if (rings[k].r > Math.max(w, h)) rings.splice(k, 1);
      }

      for (const g of groups) g.length = 0;
      const cols = Math.ceil(w / CW), rows = Math.ceil(h / CH);
      for (let r = 0; r < rows; r++) {
        const band = Math.sin((Math.PI * (r + 0.5)) / rows); // denser through the middle
        const y = r * CH + CH / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * CW + CW / 2;
          let v = Math.sin(c * 0.16 + t * 0.9) + Math.sin(r * 0.45 - t * 0.6) + Math.sin((c + r) * 0.08 + t * 0.35)
            + Math.sin(Math.hypot(c - cols / 2, (r - rows) * 2.2) * 0.22 - t * 1.1);
          v = (v + 4) / 8;
          let loud = 0;
          if (heat > 0.01) {
            const dx = x - px, dy = (y - py) * 1.3, d2 = dx * dx + dy * dy;
            if (d2 < R2 * 2.5) loud = heat * Math.exp(-d2 / R2) * (0.75 + 0.25 * Math.sin(t * 9 - Math.sqrt(d2) * 0.08));
          }
          let ring = 0;
          for (const rg of rings) {
            const f = 1 - Math.abs(Math.hypot(x - rg.x, (y - rg.y) * 1.3) - rg.r) / 22;
            if (f > 0) ring = Math.max(ring, f * clamp(1 - rg.r / 700));
          }
          const boost = Math.max(loud, ring);
          const lvl = Math.min(1, v * v * band * 1.35 + boost * 0.95);
          const idx = Math.min(CHARS.length - 1, Math.floor(lvl * CHARS.length));
          if (idx <= 0) continue;
          const colour = boost > 0.25 ? 2 : v > 0.9 ? 1 : 0;
          const alpha = Math.min(1, 0.18 + 0.5 * v * band + boost * 0.6);
          const step = Math.round(alpha * (ALPHA_STEPS - 1));
          groups[colour * ALPHA_STEPS + step].push(c * CW, r * CH, idx);
        }
      }
      // One style change per group instead of per character.
      const fills = [muted, lime, teal];
      for (let k = 0; k < groups.length; k++) {
        const g = groups[k];
        if (!g.length) continue;
        ctx.fillStyle = fills[Math.floor(k / ALPHA_STEPS)];
        ctx.globalAlpha = (k % ALPHA_STEPS) / (ALPHA_STEPS - 1);
        for (let n = 0; n < g.length; n += 3) ctx.fillText(CHARS[g[n + 2]], g[n], g[n + 1]);
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!onScreen) return;
      // Animates when half visible, or while the cursor/rings are working the field (even if less is visible).
      const { w, h } = size.current;
      const px = pointer.x - rect.current.left, py = pointer.y - rect.current.top;
      const cursorOver = pointerActive() && px >= 0 && px <= w && py >= 0 && py <= h;
      const interacting = !reduce && (heat > 0.01 || rings.length > 0 || cursorOver);
      const animate = !reduce && (focused || interacting) && now - last >= FRAME_MS;
      if (!animate && !needsDraw.current) return;
      last = now;
      needsDraw.current = false;
      draw(now);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); io.disconnect(); mo.disconnect(); offClick(); };
  }, [reduce, size]);

  return <canvas ref={ref} className="ascii" aria-hidden="true" />;
}
