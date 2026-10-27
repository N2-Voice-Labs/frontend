import { frac } from "@/lib/landing/math";
import { BRIDGE, EN, INK, KO, PALETTE, label, range, rnd, type Frame, type SceneVisual } from "@/lib/cinematic/visual";

/** Language tags that drift over the globe: only codes, no claims about which languages ship. */
const TAGS = ["ko", "en", "ru", "es", "ja", "ar", "hi", "fr", "kk", "tr", "zh", "pt"];
const ARCS = 16;

function globe(f: Frame) {
  const R = f.u * (f.portrait ? 0.36 : 0.3);
  const c = { x: f.w / 2, y: f.h * 0.5 };
  // Expands a little as it appears, then everything drifts outward and dissolves into the dark.
  const scale = 0.85 + 0.15 * range(f.p, 0, 0.3) + 0.6 * range(f.p, 0.48, 0.75);
  const fade = 1 - range(f.p, 0.48, 0.66);
  return { R: R * scale, c, fade, spin: f.t * 0.08 + f.p * 1.2 };
}

/** Point i of a Fibonacci sphere, rotated by `spin`; z > 0 faces the viewer. */
function spherePoint(i: number, n: number, spin: number) {
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(1 - y * y);
  const th = i * 2.399963 + spin;
  return { x: Math.cos(th) * r, y, z: Math.sin(th) * r };
}

/** 08 — a planet of voices, connected; then silence. */
export const futureVisual: SceneVisual = {
  place(i, f, o) {
    const G = globe(f);
    const s = spherePoint(i, f.n, G.spin);
    const tilt = 0.35;
    const y = s.y * Math.cos(tilt) - s.z * Math.sin(tilt);
    const z = s.y * Math.sin(tilt) + s.z * Math.cos(tilt);
    o.x = G.c.x + s.x * G.R;
    o.y = G.c.y + y * G.R;
    const front = (z + 1) / 2;
    o.c = rnd(i, 7) < 0.06 ? BRIDGE : rnd(i, 8) < 0.5 ? KO : EN;
    o.a = (0.08 + 0.75 * front ** 2) * G.fade;
    o.s = 0.8 + front * 0.6;
  },
  draw(ctx, f, alpha) {
    const G = globe(f);
    const a = alpha * range(f.p, 0.12, 0.25) * G.fade;
    if (a <= 0.01) return;
    // Arcs between pairs of front-facing points, each with a voice travelling along it.
    for (let k = 0; k < ARCS; k++) {
      const n = 97;
      const pa = spherePoint(Math.floor(rnd(k, 11) * n), n, G.spin), pb = spherePoint(Math.floor(rnd(k, 12) * n), n, G.spin);
      if (pa.z < -0.1 || pb.z < -0.1) continue;
      const ax = G.c.x + pa.x * G.R, ay = G.c.y + pa.y * G.R, bx = G.c.x + pb.x * G.R, by = G.c.y + pb.y * G.R;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const lift = 1.35;
      const cx = G.c.x + (mx - G.c.x) * lift, cy = G.c.y + (my - G.c.y) * lift;
      const appear = range(f.p, 0.12 + k * 0.012, 0.2 + k * 0.012);
      ctx.globalAlpha = a * appear * 0.35;
      ctx.strokeStyle = PALETTE[k % 3 === 0 ? BRIDGE : k % 2 ? EN : KO];
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, bx, by); ctx.stroke();
      const t = frac(f.t * 0.25 + rnd(k, 13));
      const px = (1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t * t * bx, py = (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t * t * by;
      ctx.globalAlpha = a * appear;
      ctx.fillStyle = PALETTE[INK];
      ctx.fillRect(px - 1, py - 1, 2.5, 2.5);
      if (k < TAGS.length) label(ctx, TAGS[k], ax + 6, ay - 4, a * appear * 0.45, PALETTE[INK], "left", 10);
    }
    ctx.globalAlpha = 1;
  },
};
