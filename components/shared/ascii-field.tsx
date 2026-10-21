"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/landing/scroll";
import { canvasTokens, fitCanvas } from "@/lib/landing/tokens";
import { useElementSize } from "@/lib/landing/use-size";

const CHARS = " .:-=+*#";
const CW = 10, CH = 16;
const FRAME_MS = 60; // ~16 fps

/**
 * Animated ASCII "noise" field behind the footer wordmark. Draws only while on screen, at ~16 fps;
 * with reduced motion it draws one static frame (and again on resize or theme change).
 */
export function AsciiField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const needsDraw = useRef(true);
  const size = useElementSize(ref, () => { needsDraw.current = true; });

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx) return;
    let visible = false, last = -Infinity, frame = 0;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);
    const mo = new MutationObserver(() => { needsDraw.current = true; });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-vl-theme"] });

    const draw = (now: number) => {
      const { w, h } = size.current;
      if (!fitCanvas(canvas, ctx, w, h)) return;
      const { muted, lime, mono } = canvasTokens();
      ctx.font = `12px ${mono}`;
      ctx.textBaseline = "top";
      const t = reduce ? 0 : now / 1000;
      const cols = Math.ceil(w / CW), rows = Math.ceil(h / CH);
      for (let r = 0; r < rows; r++) {
        const band = Math.sin((Math.PI * (r + 0.5)) / rows); // denser through the middle
        for (let c = 0; c < cols; c++) {
          let v = Math.sin(c * 0.16 + t * 0.9) + Math.sin(r * 0.45 - t * 0.6) + Math.sin((c + r) * 0.08 + t * 0.35)
            + Math.sin(Math.hypot(c - cols / 2, (r - rows) * 2.2) * 0.22 - t * 1.1);
          v = (v + 4) / 8;
          const idx = Math.min(CHARS.length - 1, Math.floor(v * v * CHARS.length * band * 1.35));
          if (idx <= 0) continue;
          ctx.fillStyle = v > 0.9 ? lime : muted;
          ctx.globalAlpha = 0.18 + 0.5 * v * band;
          ctx.fillText(CHARS[idx], c * CW, r * CH);
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible) return;
      if (reduce ? !needsDraw.current : now - last < FRAME_MS && !needsDraw.current) return;
      last = now;
      needsDraw.current = false;
      draw(now);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); io.disconnect(); mo.disconnect(); };
  }, [reduce, size]);

  return <canvas ref={ref} className="ascii" aria-hidden="true" />;
}
