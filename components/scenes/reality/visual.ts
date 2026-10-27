import { director } from "@/lib/cinematic/director";
import { BRIDGE, EN, KO, lerp, range, rnd, waveY, type SceneVisual } from "@/lib/cinematic/visual";

/**
 * 07 — the world collapses into one quiet horizon line under the live conversation. Its two halves move
 * with the real levels of the demo session (you on the left, the agent on the right) when one is running,
 * and breathe gently otherwise.
 */
export const realityVisual: SceneVisual = {
  place(i, f, o) {
    const k = i / f.n;
    const y = f.h * (f.portrait ? 0.9 : 0.86);
    const left = k < 0.5;
    const live = left ? director.level.you : director.level.agent;
    const idle = 0.12 + 0.08 * Math.sin(f.t * 0.8 + (left ? 0 : 2));
    const amp = f.u * 0.05 * Math.max(live, idle);
    const kk = left ? k * 2 : (k - 0.5) * 2;
    o.x = lerp(left ? f.w * 0.04 : f.w * 0.5, left ? f.w * 0.5 : f.w * 0.96, kk);
    o.y = y + waveY(kk, f.t, amp, left ? 0 : 3) + (rnd(i, 3) - 0.5);
    const centre = 1 - Math.abs(k - 0.5) * 2;
    o.c = centre > 0.85 ? BRIDGE : left ? KO : EN;
    o.a = (0.25 + 0.55 * centre) * range(f.p, 0, 0.15);
    o.s = 1;
  },
};
