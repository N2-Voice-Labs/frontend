import { frac } from "@/lib/landing/math";
import { LATENCY_STAGES } from "@/lib/landing/config";
import { BRIDGE, DIM, EN, INK, KO, PALETTE, label, lerp, range, rnd, type Frame, type SceneVisual } from "@/lib/cinematic/visual";

/** The runtime, in signal order. `stage` links a node to its NS-01 latency stage; `swap` marks provider slots. */
export const ENGINE_NODES = [
  { name: "VOICE IN", stage: 0, swap: false },
  { name: "VAD · TURN", stage: 1, swap: false },
  { name: "STT", stage: 2, swap: true },
  { name: "VOICE AGENT · LLM", stage: 3, swap: true },
  { name: "TTS", stage: 4, swap: true },
  { name: "VOICE OUT", stage: 5, swap: false },
] as const;

const AGENT = 3;
const N = ENGINE_NODES.length;

/** Node positions in world space plus the tools satellite, and the camera for progress p. */
function engineLayout(f: Frame) {
  const { w, h, portrait, u } = f;
  const node = (k: number) => portrait
    ? { x: w * 0.42, y: lerp(h * 0.2, h * 0.72, k / (N - 1)) }
    : { x: lerp(w * 0.1, w * 0.9, k / (N - 1)), y: h * 0.42 };
  const agent = node(AGENT);
  const tools = portrait ? { x: w * 0.82, y: agent.y } : { x: agent.x, y: h * 0.62 };
  // The camera starts close on the incoming voice and pulls back to the whole engine.
  const pull = range(f.p, 0.02, 0.42);
  const zoom = lerp(2.4, 1, pull);
  const focus = { x: lerp(node(0).x, w / 2, pull), y: lerp(node(0).y, h / 2, pull) };
  const cam = (p: { x: number; y: number }) => ({ x: w / 2 + (p.x - focus.x) * zoom, y: h / 2 + (p.y - focus.y) * zoom });
  const radius = (k: number) => u * (k === AGENT ? 0.06 : 0.032) * zoom;
  return { node, tools, cam, radius, zoom };
}

/** Node k fades in as the camera passes it. */
const reveal = (p: number, k: number) => range(p, 0.02 + k * 0.06, 0.08 + k * 0.06);

function pointOnChain(L: ReturnType<typeof engineLayout>, u: number) {
  const s = u * (N - 1), k = Math.min(Math.floor(s), N - 2), t = s - k;
  const a = L.node(k), b = L.node(k + 1);
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), seg: k };
}

/** 05 — the runtime under the conversation: signals flow through every stage, the agent calls out to tools. */
export const engineVisual: SceneVisual = {
  place(i, f, o) {
    const L = engineLayout(f);
    const r1 = rnd(i, 1), r2 = rnd(i, 2), r3 = rnd(i, 3);
    o.s = 1;
    if (r1 < 0.34) {
      // Rings: one per node, the agent gets more particles; the tools node is the last slot.
      const slot = Math.min(Math.floor(r2 * (N + 2)), N + 1);
      const k = slot >= N ? (slot === N ? AGENT : -1) : slot;
      const centre = k === -1 ? L.tools : L.node(k);
      const R = k === -1 ? L.radius(0) : L.radius(k);
      const ang = r3 * Math.PI * 2 + f.t * (k === AGENT ? 0.5 : 0.25) * ((i & 1) ? 1 : -1);
      const c = L.cam(centre);
      const breathe = 1 + 0.06 * Math.sin(f.t * 2 + (k + 1) * 1.3);
      o.x = c.x + Math.cos(ang) * R * breathe;
      o.y = c.y + Math.sin(ang) * R * breathe;
      o.c = k === AGENT || k === -1 ? BRIDGE : k < AGENT ? KO : EN;
      o.a = (k === -1 ? range(f.p, 0.42, 0.52) : reveal(f.p, k)) * 0.85;
      return;
    }
    if (r1 < 0.46) {
      // Tool calls: the agent sends a request down to the tools and gets an answer back.
      const s = frac(f.t * 0.22 + r2);
      const a = L.node(AGENT), b = L.tools;
      const q = s < 0.5 ? s * 2 : 2 - s * 2;
      const c = L.cam({ x: lerp(a.x, b.x, q) + (r3 - 0.5) * 6, y: lerp(a.y, b.y, q) + (r3 - 0.5) * 6 });
      o.x = c.x; o.y = c.y;
      o.c = BRIDGE;
      o.a = range(f.p, 0.45, 0.55) * 0.8;
      return;
    }
    // Packets streaming through the chain: a wave until STT, tokens through the agent, a wave again after TTS.
    const u = frac(f.t * (0.045 + r3 * 0.02) + r2);
    const pt = pointOnChain(L, u);
    const wave = Math.sin(u * 160 + f.t * 6) * f.u * 0.018;
    const isToken = pt.seg >= 2 && pt.seg < 4;
    const off = isToken ? (r3 - 0.5) * 4 : wave * (0.5 + r3 * 0.5);
    const c = L.cam(f.portrait ? { x: pt.x + off, y: pt.y } : { x: pt.x, y: pt.y + off });
    o.x = c.x; o.y = c.y;
    o.c = pt.seg < 2 ? KO : pt.seg < 4 ? BRIDGE : EN;
    o.a = reveal(f.p, pt.seg + 1) * (isToken ? 0.95 : 0.75);
    o.s = isToken ? 1.5 : 1;
  },
  draw(ctx, f, alpha) {
    const L = engineLayout(f);
    // Wires
    for (let k = 0; k < N - 1; k++) {
      const a = L.cam(L.node(k)), b = L.cam(L.node(k + 1));
      ctx.globalAlpha = alpha * reveal(f.p, k + 1) * 0.18;
      ctx.strokeStyle = PALETTE[INK];
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const tA = alpha * range(f.p, 0.42, 0.52);
    const ag = L.cam(L.node(AGENT)), tl = L.cam(L.tools);
    ctx.globalAlpha = tA * 0.25;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(ag.x, ag.y); ctx.lineTo(tl.x, tl.y); ctx.stroke();
    ctx.setLineDash([]);
    const below = (k: number) => L.radius(k) + 22;
    label(ctx, f.portrait ? "TOOLS" : "TOOLS · KNOWLEDGE · INTEGRATIONS", tl.x, tl.y + L.radius(0) + 22, tA * 0.8, PALETTE[BRIDGE], "center", f.portrait ? 9 : 11);
    // Labels, latency stage, provider slots
    ENGINE_NODES.forEach((n, k) => {
      const a = alpha * reveal(f.p, k);
      if (a <= 0.01) return;
      const c = L.cam(L.node(k));
      // Labels sit under the nodes; the agent's go above it, since the tools wire runs down from it.
      const side = f.portrait
        ? { x: c.x - L.radius(k) - 14, y: c.y + 4, align: "right" as const }
        : { x: c.x, y: k === AGENT ? c.y - L.radius(k) - 52 : c.y + below(k), align: "center" as const };
      label(ctx, n.name, side.x, side.y, a * 0.9, PALETTE[INK], side.align, f.portrait ? 9 : 11);
      const st = LATENCY_STAGES[n.stage];
      const ms = st.p50Ms === null ? "p50 —" : `${st.p50Ms} ms`;
      label(ctx, `${st.id} · ${ms}`, side.x, side.y + 15, a * 0.5 * range(f.p, 0.5, 0.6), PALETTE[DIM], side.align, 10);
      if (n.swap) {
        const on = Math.floor(f.t / 1.8 + k) % 3;
        const sa = a * range(f.p, 0.6, 0.7);
        for (let s = 0; s < 3; s++) {
          ctx.globalAlpha = sa * (s === on ? 0.9 : 0.25);
          ctx.fillStyle = PALETTE[s === on ? BRIDGE : INK];
          const bx = f.portrait ? side.x - 26 + s * 9 : side.x - 13 + s * 9;
          ctx.fillRect(bx, side.y + 24, 6, 6);
        }
      }
    });
    ctx.globalAlpha = 1;
  },
};
