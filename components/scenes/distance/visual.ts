import { frac } from "@/lib/landing/math";
import { DIM, EN, KO, PALETTE, label, lerp, range, rnd, type Frame, type SceneVisual } from "@/lib/cinematic/visual";

/** Centres of the two language worlds and the wall between them. */
export function distanceLayout(f: Frame) {
  const { w, h, portrait, u } = f;
  return portrait
    ? { ko: { x: w / 2, y: h * 0.24 }, en: { x: w / 2, y: h * 0.76 }, wall: { x: w / 2, y: h / 2 }, r: u * 0.24 }
    : { ko: { x: w * 0.22, y: h / 2 }, en: { x: w * 0.78, y: h / 2 }, wall: { x: w / 2, y: h / 2 }, r: u * 0.22 };
}

/**
 * 02 — two worlds, a wall between them. Most particles orbit their own language; ~18% build the wall;
 * ~14% are messages that fly at the wall and scatter off it.
 */
export const distanceVisual: SceneVisual = {
  place(i, f, o) {
    const L = distanceLayout(f);
    const side = i & 1;
    const home = side ? L.en : L.ko;
    const dir = side ? -1 : 1;
    const r1 = rnd(i, 1), r2 = rnd(i, 2), r3 = rnd(i, 3);
    o.s = 1;
    if (r1 < 0.18) {
      // The wall rises from the bottom (or grows from the centre on portrait screens).
      const rise = range(f.p, 0.05, 0.45);
      const along = (r2 - 0.5) * (f.portrait ? f.w : f.h) * 1.1;
      const shake = (rnd(i, 5) - 0.5) * 6 + Math.sin(f.t * 3 + i) * 1.5;
      if (f.portrait) { o.x = L.wall.x + along; o.y = L.wall.y + shake; }
      else { o.x = L.wall.x + shake; o.y = lerp(f.h * 1.05, L.wall.y + along, rise); }
      o.c = DIM;
      o.a = 0.25 + 0.55 * rise;
      return;
    }
    if (r1 < 0.32) {
      // A message travels toward the wall, then bounces off and scatters.
      const s = frac(f.t * 0.18 + r2);
      const edge = f.portrait ? home.y + dir * L.r * 0.8 : home.x + dir * L.r * 0.8;
      const stop = (f.portrait ? L.wall.y : L.wall.x) - dir * 8;
      let a: number, b: number, alpha: number;
      if (s < 0.7) {
        a = lerp(edge, stop, s / 0.7);
        b = Math.sin(s * 20 + r3 * 6) * 6 + (r3 - 0.5) * 16;
        alpha = 0.9;
      } else {
        const q = (s - 0.7) / 0.3;
        a = stop - dir * q * L.r * 0.7;
        b = (r3 - 0.5) * q * L.r * 2.2;
        alpha = 0.9 * (1 - q);
      }
      if (f.portrait) { o.x = home.x + b; o.y = a; } else { o.x = a; o.y = home.y + b; }
      o.c = side ? EN : KO;
      o.a = alpha * range(f.p, 0.15, 0.3);
      return;
    }
    // Everyone else: a slowly turning cloud around the language's centre.
    const ang = r2 * Math.PI * 2 + f.t * (0.05 + r3 * 0.08) * (side ? -1 : 1);
    const rad = L.r * Math.sqrt(r3) * (0.9 + 0.1 * Math.sin(f.t + i));
    o.x = home.x + Math.cos(ang) * rad;
    o.y = home.y + Math.sin(ang) * rad * 0.8;
    o.c = side ? EN : KO;
    o.a = 0.35 + 0.5 * (1 - Math.sqrt(r3));
  },
  draw(ctx, f, alpha) {
    const L = distanceLayout(f);
    const a = alpha * range(f.p, 0.1, 0.25) * 0.6;
    const dy = f.portrait ? -L.r - 18 : L.r + 30;
    label(ctx, "한국어", L.ko.x, L.ko.y + dy, a, PALETTE[KO]);
    label(ctx, "ENGLISH", L.en.x, L.en.y + (f.portrait ? -dy : dy), a, PALETTE[EN]);
    ctx.globalAlpha = 1;
  },
};
