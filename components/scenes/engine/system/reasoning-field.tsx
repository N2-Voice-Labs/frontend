import { range } from "@/lib/cinematic/visual";
import { BEATS } from "../beats";
import type { Geo, P2 } from "./geometry";
import { C, Dot, Label, all, n2, one, op, quad, s, setA, type Bind, type Tw } from "./shared";

/**
 * VOICE AGENT · LLM / REASON — six streams (history, intent, language, context, tools, knowledge) curve
 * into a field that never settles: a handful of curved paths between drifting points, each strengthening
 * and weakening on its own clock. No brain, no glow ball: thin lines, a small core, a slow pulse.
 */

const [R0, R1] = BEATS.reason;
const NODES = 8;
const CURVES: [number, number][] = [[0, 3], [1, 5], [2, 6], [3, 7], [4, 1], [5, 2], [6, 0], [7, 4]];
const IN_COLOUR = [C.ink, C.gold, C.ko, C.ink, C.gold, C.ink];

const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const inputD = (a: P2, c: P2, b: P2) => `M${n2(a.x)} ${n2(a.y)}Q${n2(c.x)} ${n2(c.y)} ${n2(b.x)} ${n2(b.y)}`;

export function ReasoningField({ G }: { G: Geo }) {
  const { c, R, tc } = G;
  const below = { x: c.x + tc.nx * R * 1.28, y: c.y + tc.ny * R * 1.28 };
  return (
    <g data-es-part="reason">
      {G.inputs.map((inp) => (
        <path key={inp.id} data-es-rf="in" className={s.stroke} d={inputD(inp.from, inp.ctrl, inp.to)} stroke={IN_COLOUR[inp.i]} strokeOpacity={0.42} strokeWidth={1} pathLength={1} strokeDasharray="1 1" />
      ))}
      {G.inputs.map((inp) => {
        const dx = inp.dir.x * 10, dy = inp.dir.y * 10;
        const anchor = inp.dir.x > 0.3 ? "start" : inp.dir.x < -0.3 ? "end" : "middle";
        return <Label key={inp.id} at={inp.from} dx={dx} dy={dy + (anchor === "middle" ? Math.sign(inp.dir.y) * 4 : 0)} anchor={anchor} cls="tiny" g={{ "data-es-rf": "in-label" }}>{inp.id}</Label>;
      })}
      <path data-es-live="rf-pk" className={s.dots} d="M-9999 -9999h0.01" stroke={C.gold} strokeWidth={2.4} />
      <g data-es-live="rf-field">
        {CURVES.map((_, k) => <path key={k} data-es-live="rf-curve" className={s.stroke} d="M-9999 -9999h0.01" stroke={C.gold} strokeWidth={1} strokeOpacity={0.4} />)}
        <path data-es-live="rf-nodes" className={s.dots} d="M-9999 -9999h0.01" stroke={C.gold} strokeOpacity={0.8} strokeWidth={2} />
      </g>
      <Dot at={c} r={2.6} g={{ "data-es-rf": "core" }} c={{ "data-es-live": "rf-core" }} />
      <Label at={below} dy={10} g={{ "data-es-rf": "label" }}>VOICE AGENT · LLM</Label>
      <Label at={below} dy={26} cls="tiny" g={{ "data-es-rf": "label2" }}>REASON</Label>
    </g>
  );
}

export const bindReasoningField: Bind = (svg, G) => {
  const pk = one(svg, "rf-pk"), nodesEl = one(svg, "rf-nodes"), core = one(svg, "rf-core");
  const curves = all(svg, "rf-curve");
  const { c, R } = G;
  const nodes: P2[] = Array.from({ length: NODES }, () => ({ x: c.x, y: c.y }));
  const tmp = { x: 0, y: 0 };

  return (p, t) => {
    if (p < R0 - 0.06) return;
    const live = p >= R0 - 0.01;
    const pulse = 1 + 0.12 * Math.sin(t * 1.7);

    for (let k = 0; k < NODES; k++) {
      const rad = R * (0.22 + 0.62 * rnd(k, 1));
      const ang = rnd(k, 2) * Math.PI * 2 + t * (0.12 + 0.18 * rnd(k, 3)) * (k % 2 ? 1 : -1);
      nodes[k].x = c.x + Math.cos(ang) * rad;
      nodes[k].y = c.y + Math.sin(ang) * rad * 0.86;
    }
    let nd = "";
    for (const n of nodes) nd += `M${n2(n.x)} ${n2(n.y)}h0.01`;
    setA(nodesEl, "d", nd);

    // the field reorganises: each curve bends and strengthens/weakens on its own clock.
    curves.forEach((el, k) => {
      const [i, j] = CURVES[k], A = nodes[i], B = nodes[j];
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1;
      const bend = R * 0.38 * Math.sin(t * 0.6 + k * 1.3);
      setA(el, "d", `M${n2(A.x)} ${n2(A.y)}Q${n2(mx - (dy / l) * bend)} ${n2(my + (dx / l) * bend)} ${n2(B.x)} ${n2(B.y)}`);
      const w = 0.5 + 0.5 * Math.sin(t * (0.35 + 0.2 * rnd(k, 4)) + rnd(k, 5) * 6);
      el.setAttribute("stroke-opacity", ((0.1 + 0.75 * w * w * w) * pulse).toFixed(3));
    });
    setA(core, "r", (2.4 * (1 + 0.22 * Math.sin(t * 1.7))).toFixed(2));

    // streams carry packets inward (dense during the beat, sparse afterwards).
    if (pk) {
      let d = "";
      if (live) {
        const dense = p < R1 + 0.02;
        G.inputs.forEach((inp, i) => {
          for (let j = 0; j < (dense ? 2 : 1); j++) {
            if (!dense && (i + Math.floor(t / 2.5)) % 3 !== 0) continue;
            const sp = dense ? 0.24 + 0.05 * i : 0.12 + 0.02 * i;
            const f = (t * sp + j * 0.5 + rnd(i, 7)) % 1;
            quad(inp.from, inp.ctrl, inp.to, f, tmp);
            d += `M${n2(tmp.x)} ${n2(tmp.y)}h0.01`;
          }
        });
      }
      setA(pk, "d", d || "M-9999 -9999h0.01");
      op(pk, range(p, R0, R0 + 0.02));
    }
  };
};

export function reasoningFieldTimeline(T: Tw) {
  T.fromTo('[data-es-part="reason"]', { opacity: 0 }, { opacity: 1, duration: 0.02 }, R0 - 0.01);
  T.fromTo('[data-es-rf="in"]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.03, stagger: 0.006 }, R0 + 0.002);
  T.fromTo('[data-es-rf="in-label"]', { opacity: 0 }, { opacity: 1, duration: 0.012, stagger: 0.006 }, R0 + 0.01);
  T.fromTo('[data-es-rf="label"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, R0 + 0.02);
  T.fromTo('[data-es-rf="label2"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, R0 + 0.035);
  // act: the inputs step back; respond: the field quiets; runtime: alive but without close-up labels.
  T.to('[data-es-rf="in-label"]', { opacity: 0.25, duration: 0.015 }, R1);
  T.to('[data-es-rf="label"], [data-es-rf="label2"]', { opacity: 0, duration: 0.015 }, R1 + 0.005);
  T.to('[data-es-part="reason"]', { opacity: 0.55, duration: 0.02 }, 0.6);
  T.to('[data-es-rf="in-label"]', { opacity: 0, duration: 0.015 }, 0.6);
  T.to('[data-es-part="reason"]', { opacity: 0.85, duration: 0.03 }, 0.72);
}
