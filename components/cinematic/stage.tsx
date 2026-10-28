"use client";

import { useEffect, useRef } from "react";
import { bridgeVisual } from "@/components/scenes/bridge/visual";
import { conversationVisual } from "@/components/scenes/conversation/visual";
import { distanceVisual } from "@/components/scenes/distance/visual";
import { engineVisual } from "@/components/scenes/engine/visual";
import { futureVisual } from "@/components/scenes/future/visual";
import { realityVisual } from "@/components/scenes/reality/visual";
import { silenceVisual } from "@/components/scenes/silence/visual";
import { worldVisual } from "@/components/scenes/world/visual";
import { director } from "@/lib/cinematic/director";
import { gsap } from "@/lib/cinematic/gsap";
import { PALETTE, range, rnd, type Frame, type Point, type SceneVisual } from "@/lib/cinematic/visual";
import { fitCanvas } from "@/lib/landing/tokens";

/** Same order as CHAPTERS. */
const VISUALS: readonly SceneVisual[] = [silenceVisual, distanceVisual, bridgeVisual, conversationVisual, engineVisual, worldVisual, realityVisual, futureVisual];

/** The first part of every chapter morphs the particles out of the previous chapter's last formation. */
const MORPH = 0.16;

const particleCount = (w: number) => (w < 720 ? 700 : w < 1200 ? 1200 : 1600);

/**
 * The film's camera: one fixed full-screen canvas and one particle set for the whole page. Reads
 * director.position (written by the scenes' ScrollTriggers) and eases toward it, so the world keeps a
 * little inertia. Under reduced motion it draws still frames and only redraws when the position changes.
 */
export function Stage() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, n = 0;
    let xs = new Float32Array(0), ys = xs, as = xs, ss = xs, cs = new Uint8Array(0);
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      const next = particleCount(w);
      if (next !== n) {
        n = next;
        xs = new Float32Array(n); ys = new Float32Array(n); as = new Float32Array(n); ss = new Float32Array(n); cs = new Uint8Array(n);
      }
      dirty = true;
    };
    let dirty = true;
    resize();
    window.addEventListener("resize", resize);

    const A: Point = { x: 0, y: 0, a: 0, c: 0, s: 1 }, B: Point = { x: 0, y: 0, a: 0, c: 0, s: 1 };
    const frame = (p: number, t: number): Frame => ({ w, h, t, p, n, portrait: h > w * 1.15, u: Math.min(w, h) });
    let shown = director.position, drawn = -1, raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const target = director.position;
      shown = reduced || Math.abs(target - shown) < 1e-4 ? target : shown + (target - shown) * 0.09;
      if (reduced && shown === drawn && !dirty) return;
      drawn = shown; dirty = false;
      if (!fitCanvas(canvas, ctx, w, h)) return;
      // GSAP's clock: the same seconds the SVG systems' painters use, so canvas and SVG stay in step.
      const t = reduced ? 6 : gsap.ticker.time;
      const k = Math.min(Math.floor(shown), VISUALS.length - 1);
      const cur = VISUALS[k], prev = k > 0 ? VISUALS[k - 1] : null;
      const fc = frame(Math.min(1, shown - k), t), fp = frame(1, t);
      const morph = cur.morph ?? MORPH;
      const mix = prev && morph > 0 ? range(fc.p, 0, morph) : 1;

      for (let i = 0; i < n; i++) {
        cur.place(i, fc, A);
        if (prev && mix < 1) {
          prev.place(i, fp, B);
          // Each particle leaves at its own moment, so formations dissolve rather than slide.
          const m = range(mix * 1.6 - rnd(i, 9) * 0.6, 0, 1);
          xs[i] = B.x + (A.x - B.x) * m; ys[i] = B.y + (A.y - B.y) * m;
          as[i] = B.a + (A.a - B.a) * m; ss[i] = B.s + (A.s - B.s) * m;
          cs[i] = m < 0.5 ? B.c : A.c;
        } else {
          xs[i] = A.x; ys[i] = A.y; as[i] = A.a; ss[i] = A.s; cs[i] = A.c;
        }
      }

      ctx.globalCompositeOperation = "lighter";
      const base = w < 720 ? 1.6 : 1.4;
      for (let c = 0; c < PALETTE.length; c++) {
        ctx.fillStyle = PALETTE[c];
        for (let i = 0; i < n; i++) {
          if (cs[i] !== c || as[i] < 0.01) continue;
          const s = base * ss[i];
          ctx.globalAlpha = Math.min(1, as[i]);
          ctx.fillRect(xs[i] - s / 2, ys[i] - s / 2, s, s);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      if (prev && mix < 1) prev.draw?.(ctx, fp, 1 - mix);
      cur.draw?.(ctx, fc, mix);
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="cine-stage" aria-hidden="true" />;
}
