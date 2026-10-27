import { frac } from "@/lib/landing/math";
import { BRIDGE, DIM, EN, INK, KO, PALETTE, label, lerp, range, rnd, type Frame, type SceneVisual } from "@/lib/cinematic/visual";

/** Destinations of the shared engine. `pair` stays within the languages the pilot supports today. */
export const WORLDS = [
  { name: "CUSTOMER SUPPORT", line: "Where is my order?", pair: "KO ↔ EN" },
  { name: "SALES", line: "Can you walk me through pricing?", pair: "RU ↔ EN" },
  { name: "BOOKING", line: "A table for four, at eight.", pair: "EN ↔ KO" },
  { name: "TRANSPORTATION", line: "Which platform for the airport?", pair: "KO ↔ RU" },
  { name: "RESTAURANTS", line: "Is this dish spicy?", pair: "EN ↔ KO" },
  { name: "HEALTHCARE", line: "When did the pain start?", pair: "RU ↔ EN" },
  { name: "CALL CENTERS", line: "Thousands of calls, one runtime.", pair: "ANY ↔ ANY" },
] as const;

const W = WORLDS.length;

function worldLayout(f: Frame) {
  const { w, h, portrait, u } = f;
  const pull = range(f.p, 0, 0.35);
  const zoom = lerp(2.4, 1, pull);
  const c = { x: w / 2, y: h * 0.5 };
  const rx = w * (portrait ? 0.32 : 0.34), ry = h * (portrait ? 0.28 : 0.25);
  const spin = f.p * 0.25;
  const dest = (d: number) => {
    const ang = -Math.PI / 2 + (d / W) * Math.PI * 2 + spin;
    return { x: c.x + Math.cos(ang) * rx * zoom, y: c.y + Math.sin(ang) * ry * zoom, ang };
  };
  return { c, dest, zoom, core: u * 0.055 * lerp(1.8, 1, pull) };
}

const revealWorld = (p: number, d: number) => range(p, 0.28 + d * 0.055, 0.34 + d * 0.055);

/** 06 — the engine pulls back into a core, and the core turns out to feed many worlds. */
export const worldVisual: SceneVisual = {
  place(i, f, o) {
    const L = worldLayout(f);
    const r1 = rnd(i, 1), r2 = rnd(i, 2), r3 = rnd(i, 3);
    const d = Math.floor(r2 * W);
    o.s = 1;
    if (r1 < 0.22) {
      const ang = r3 * Math.PI * 2 + f.t * (0.3 + r2 * 0.4);
      const rad = L.core * Math.sqrt(rnd(i, 4));
      o.x = L.c.x + Math.cos(ang) * rad;
      o.y = L.c.y + Math.sin(ang) * rad;
      o.c = BRIDGE;
      o.a = 0.9;
      return;
    }
    const p = L.dest(d);
    if (r1 < 0.6) {
      const ang = r3 * Math.PI * 2 + f.t * 0.2;
      const rad = f.u * 0.03 * Math.sqrt(rnd(i, 4));
      o.x = p.x + Math.cos(ang) * rad;
      o.y = p.y + Math.sin(ang) * rad;
      o.c = d % 2 ? EN : KO;
      o.a = 0.8 * revealWorld(f.p, d);
      return;
    }
    // Conversations travel the spokes: out to a world and back to the core.
    const s = frac(f.t * (0.12 + r3 * 0.06) + r3);
    const q = s < 0.5 ? s * 2 : 2 - s * 2;
    const bend = Math.sin(Math.PI * q) * f.u * 0.03 * (s < 0.5 ? 1 : -1);
    const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
    o.x = lerp(L.c.x, p.x, q) + nx * bend;
    o.y = lerp(L.c.y, p.y, q) + ny * bend;
    o.c = s < 0.5 ? BRIDGE : d % 2 ? EN : KO;
    o.a = 0.75 * revealWorld(f.p, d);
  },
  draw(ctx, f, alpha) {
    const L = worldLayout(f);
    WORLDS.forEach((wd, d) => {
      const a = alpha * revealWorld(f.p, d);
      if (a <= 0.01) return;
      const p = L.dest(d);
      ctx.globalAlpha = a * 0.12;
      ctx.strokeStyle = PALETTE[INK];
      ctx.beginPath(); ctx.moveTo(L.c.x, L.c.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      const below = Math.sin(p.ang) > -0.2;
      const y = p.y + (below ? f.u * 0.06 + 6 : -f.u * 0.06 - 26);
      const small = f.portrait;
      label(ctx, wd.name, p.x, y, a * 0.95, PALETTE[INK], "center", small ? 9 : 11);
      if (!small) label(ctx, `“${wd.line}”`, p.x, y + 16, a * 0.5 * range(f.p, 0.62, 0.72), PALETTE[DIM], "center", 11);
      label(ctx, wd.pair, p.x, y + (small ? 13 : 31), a * 0.6 * range(f.p, 0.62, 0.72), PALETTE[d % 2 ? EN : KO], "center", small ? 9 : 10);
    });
    label(ctx, "ONE RUNTIME", L.c.x, L.c.y + L.core + 20, alpha * range(f.p, 0.2, 0.3) * 0.6, PALETTE[BRIDGE], "center", 10);
    ctx.globalAlpha = 1;
  },
};
