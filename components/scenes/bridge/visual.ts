import { frac } from "@/lib/landing/math";
import { BRIDGE, DIM, EN, INK, KO, PALETTE, label, lerp, range, rnd, type Frame, type SceneVisual } from "@/lib/cinematic/visual";

/** The four stations along the bridge: where each sits (0–1 along it) and what the signal looks like there. */
export const STATIONS = [
  { at: 0.17, name: "SPEECH" },
  { at: 0.37, name: "UNDERSTAND" },
  { at: 0.57, name: "REASON" },
  { at: 0.77, name: "RESPOND" },
] as const;

function bridgeGeometry(f: Frame) {
  const { w, h, portrait } = f;
  const x0 = w * (portrait ? 0.08 : 0.12), x1 = w * (portrait ? 0.92 : 0.88);
  const base = h * (portrait ? 0.6 : 0.64);
  const lift = h * 0.09;
  const at = (u: number) => ({ x: lerp(x0, x1, u), y: base - Math.sin(Math.PI * u) * lift });
  return { x0, x1, base, at };
}

/** Offset from the bridge line for a signal at `u`: wave → tokens → a thinking cloud → wave again. */
function signalShape(u: number, t: number, r: number, f: Frame) {
  const wave = Math.sin(u * 90 + t * 8 + r * 2) * f.u * 0.022 * (0.4 + 0.6 * Math.sin(t * 2.3 + u * 9) ** 2);
  const token = ((r * 7) % 1 - 0.5) * 3;
  const think = (r - 0.5) * f.u * 0.12 * Math.sin(Math.PI * range(u, 0.47, 0.67));
  const inUnderstand = range(u, 0.27, 0.31) * (1 - range(u, 0.45, 0.5));
  const inReason = range(u, 0.47, 0.5) * (1 - range(u, 0.64, 0.69));
  const inWave = 1 - Math.max(inUnderstand, inReason);
  return { dy: wave * inWave + token * inUnderstand + think * inReason, snap: inUnderstand };
}

/** 03 — the wall becomes a bridge; speech crosses it and changes form at each station. */
export const bridgeVisual: SceneVisual = {
  place(i, f, o) {
    const G = bridgeGeometry(f);
    const r1 = rnd(i, 1), r2 = rnd(i, 2), r3 = rnd(i, 3);
    const form = range(f.p, 0.04, 0.32);
    o.s = 1;
    if (r1 < 0.18) {
      // Cables: the wall's particles lay themselves along the bridge.
      const cable = Math.floor(r3 * 3) - 1;
      const pt = G.at(r2);
      o.x = pt.x;
      o.y = pt.y + cable * 5 + Math.sin(r2 * 40 + f.t) * 0.8;
      o.c = form > 0.6 ? BRIDGE : DIM;
      o.a = 0.18 + 0.32 * form;
      return;
    }
    if (r1 < 0.62) {
      // Signals crossing: KO → EN on top, the answer EN → KO slightly below once the bridge is open.
      const back = (i & 1) === 1;
      const u = frac(f.t * (0.05 + r3 * 0.02) + r2);
      const shape = signalShape(u, f.t, r3, f);
      const step = 0.011;
      const uu = lerp(u, Math.round(u / step) * step, shape.snap);
      const pt = G.at(back ? 1 - uu : uu);
      o.x = pt.x;
      o.y = pt.y - 14 + (back ? 22 : 0) + shape.dy;
      const from = back ? EN : KO, to = back ? KO : EN;
      o.c = u < 0.47 ? from : u < 0.67 ? BRIDGE : to;
      o.a = range(f.p, 0.25, 0.42) * (back ? range(f.p, 0.62, 0.8) * 0.6 : 0.9) * Math.sin(Math.PI * u) ** 0.4;
      o.s = shape.snap > 0.5 ? 1.4 : 1;
      return;
    }
    // The two worlds condense into the bridge's ends.
    const end = (i & 1) ? { x: G.x1, y: G.base } : { x: G.x0, y: G.base };
    const ang = r2 * Math.PI * 2 + f.t * 0.3;
    const rad = f.u * (0.035 + r3 * 0.03) * lerp(3, 1, form);
    o.x = end.x + Math.cos(ang) * rad;
    o.y = end.y + Math.sin(ang) * rad;
    o.c = (i & 1) ? EN : KO;
    o.a = 0.3 + 0.5 * (1 - r3);
  },
  draw(ctx, f, alpha) {
    const G = bridgeGeometry(f);
    STATIONS.forEach((s, k) => {
      const a = alpha * range(f.p, 0.45 + k * 0.08, 0.52 + k * 0.08);
      if (a <= 0.01) return;
      const pt = G.at(s.at);
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = PALETTE[INK];
      ctx.fillRect(pt.x, pt.y + 26, 1, 22);
      label(ctx, `0${k + 1}`, pt.x, pt.y + 64, a * 0.5, PALETTE[DIM]);
      label(ctx, s.name, pt.x, pt.y + 80, a * 0.85, PALETTE[INK], "center", f.portrait ? 9 : 11);
    });
    label(ctx, "KO", G.x0, G.base + 54, alpha * range(f.p, 0.3, 0.4) * 0.7, PALETTE[KO]);
    label(ctx, "EN", G.x1, G.base + 54, alpha * range(f.p, 0.3, 0.4) * 0.7, PALETTE[EN]);
    ctx.globalAlpha = 1;
  },
};
