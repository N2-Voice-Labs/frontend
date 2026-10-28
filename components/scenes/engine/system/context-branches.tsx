import { range } from "@/lib/cinematic/visual";
import { BEATS } from "../beats";
import { U, type Geo, type P2 } from "./geometry";
import { C, Dot, Label, all, n2, one, op, quad, s, setA, type Bind, type Tw } from "./shared";

/**
 * ACT — the field's branches (CONTEXT · KNOWLEDGE · TOOLS · INTEGRATIONS · MEMORY; three in portrait) as
 * thin living curves. One packet leaves along TOOLS with a question, waits while the tool answers, and
 * comes back before the response; afterwards a branch activates now and then, so the runtime breathes.
 */

const [A0, A1] = BEATS.act;
const QUESTION = "is tomorrow morning free?";
const ANSWER = "10:00 · free";
const IDLE = 3.2;

type Br = Geo["branches"][number];

function ctrl(b: Br, t: number, i: number, o: P2) {
  const dx = b.end.x - b.from.x, dy = b.end.y - b.from.y, l = Math.hypot(dx, dy) || 1;
  const bend = l * (0.2 + 0.03 * Math.sin(t * 0.5 + i * 1.7)) * (i % 2 ? 1 : -1);
  o.x = (b.from.x + b.end.x) / 2 - (dy / l) * bend;
  o.y = (b.from.y + b.end.y) / 2 + (dx / l) * bend;
  return o;
}
const branchD = (b: Br, c: P2) => `M${n2(b.from.x)} ${n2(b.from.y)}Q${n2(c.x)} ${n2(c.y)} ${n2(b.end.x)} ${n2(b.end.y)}`;

const labelAt = (b: Br) => {
  const anchor = b.dir.x > 0.35 ? ("start" as const) : b.dir.x < -0.35 ? ("end" as const) : ("middle" as const);
  return { dx: b.dir.x * 11, dy: b.dir.y * 11 + (anchor === "middle" ? Math.sign(b.dir.y) * 3 : 0), anchor };
};

export function ContextBranches({ G }: { G: Geo }) {
  const tmp = { x: 0, y: 0 };
  const tools = G.tools;
  const tl = labelAt(tools);
  const qx = tl.anchor === "end" ? -14 : 14;
  const qAnchor = tl.anchor === "end" ? "end" : "start";
  const qy = G.portrait ? 18 : 0;
  const lowercase = { textTransform: "none", letterSpacing: ".06em" } as const;
  return (
    <g data-es-part="act">
      {G.branches.map((b, i) => (
        <path
          key={b.id}
          data-es-br="path"
          data-es-live="br-path"
          className={s.stroke}
          d={branchD(b, ctrl(b, 0, i, tmp))}
          stroke={b.id === "TOOLS" ? C.gold : C.ink}
          strokeOpacity={0.35}
          strokeWidth={1}
          pathLength={1}
          strokeDasharray="1 1"
        />
      ))}
      {G.branches.map((b) => <Dot key={b.id} at={b.end} r={2} glow={false} fill={b.id === "TOOLS" ? C.gold : C.ink} g={{ "data-es-br": "node" }} c={{ "data-es-live": "br-node" }} />)}
      {G.branches.map((b) => {
        const l = labelAt(b);
        return <Label key={b.id} at={b.end} dx={l.dx} dy={l.dy} anchor={l.anchor} cls="tiny" g={{ "data-es-br": "label" }}>{b.id}</Label>;
      })}
      <g className={s.filmOnly}>
        <g data-es-live="br-ring" transform={`translate(${n2(tools.end.x)} ${n2(tools.end.y)})`} opacity={0}>
          <g className={s.cs}><circle className={s.stroke} r={6} stroke={C.gold} strokeWidth={1} /></g>
        </g>
        <Label at={tools.end} dx={qx} dy={qy - 9} anchor={qAnchor} cls="tiny" g={{ "data-es-live": "br-q", opacity: 0 }} text={{ style: lowercase }}>{QUESTION}</Label>
        <Label at={tools.end} dx={qx} dy={qy + 7} anchor={qAnchor} cls="tiny" g={{ "data-es-live": "br-a", opacity: 0 }} text={{ style: lowercase, fill: C.gold }}>{ANSWER}</Label>
        <Dot at={G.c} r={2.8} g={{ "data-es-live": "br-pk", opacity: 0 }} />
      </g>
      <Label at={tools.end} dy={G.portrait ? 44 : 40} anchor="middle" g={{ "data-es-br": "loop" }}>UNDERSTAND → REASON → ACT → RESPOND</Label>
    </g>
  );
}

export const bindContextBranches: Bind = (svg, G) => {
  const paths = all(svg, "br-path"), nodes = all(svg, "br-node");
  const pk = one(svg, "br-pk"), ring = one(svg, "br-ring"), qEl = one(svg, "br-q"), aEl = one(svg, "br-a");
  const ti = G.branches.findIndex((b) => b.id === "TOOLS");
  const cs: P2[] = G.branches.map(() => ({ x: 0, y: 0 }));
  const tmp = { x: 0, y: 0 };
  const respond = G.pt(U.respond);
  const n = G.branches.length;

  return (p, t) => {
    if (p < A0 - 0.03 || (p > A1 + 0.02 && p < 0.68)) {
      if (p > A1) op(pk, 0);
      return;
    }
    G.branches.forEach((b, i) => {
      ctrl(b, t, i, cs[i]);
      setA(paths[i], "d", branchD(b, cs[i]));
    });

    let active = -1, glow = 0;
    if (p <= A1 + 0.02) {
      // the tool call: out with the question, wait for the answer, back, and on to the response.
      const q = (p - A0) / (A1 - A0);
      const b = G.branches[ti];
      const out = range(q, 0.05, 0.38), back = range(q, 0.6, 0.9), on = range(q, 0.9, 1);
      if (q < 0.6) quad(b.from, cs[ti], b.end, out, tmp);
      else if (q < 0.9) quad(b.from, cs[ti], b.end, 1 - back, tmp);
      else { tmp.x = b.from.x + (respond.x - b.from.x) * on; tmp.y = b.from.y + (respond.y - b.from.y) * on; }
      setA(pk, "transform", `translate(${n2(tmp.x)} ${n2(tmp.y)})`);
      op(pk, q > 0.03 && q < 1.02 ? 1 : 0);
      active = ti;
      glow = range(q, 0.03, 0.1) * (1 - range(q, 0.9, 1));
      const hold = q > 0.38 && q < 0.62;
      const f = (t * 1.2) % 1;
      setA(ring?.querySelector("circle"), "r", (5 + 11 * f).toFixed(1));
      op(ring, hold ? (1 - f) * 0.8 : 0);
      op(qEl, range(q, 0.28, 0.36) * (1 - range(q, 0.58, 0.64)));
      op(aEl, range(q, 0.52, 0.6) * (1 - range(q, 0.92, 1)));
    } else {
      // runtime: now and then a branch is consulted.
      const k = Math.floor(t / IDLE) % n, f = (t / IDLE) % 1;
      const b = G.branches[k];
      if (f < 0.6) {
        const g = f < 0.3 ? f / 0.3 : 1 - (f - 0.3) / 0.3;
        quad(b.from, cs[k], b.end, g, tmp);
        setA(pk, "transform", `translate(${n2(tmp.x)} ${n2(tmp.y)})`);
        op(pk, Math.sin((Math.PI * f) / 0.6));
        active = k;
        glow = Math.sin((Math.PI * f) / 0.6);
      } else op(pk, 0);
      op(ring, 0); op(qEl, 0); op(aEl, 0);
    }
    paths.forEach((el, i) => el.setAttribute("stroke-opacity", (0.32 + (i === active ? 0.6 * glow : 0)).toFixed(3)));
    nodes.forEach((el, i) => el.setAttribute("r", (2 * (1 + (i === active ? 0.6 * glow : 0))).toFixed(2)));
  };
};

export function contextBranchesTimeline(T: Tw) {
  T.fromTo('[data-es-part="act"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, A0 - 0.016);
  T.fromTo('[data-es-br="path"]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.025, stagger: 0.004 }, A0 - 0.014);
  T.fromTo('[data-es-br="node"]', { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: 0.004 }, A0 + 0.004);
  T.fromTo('[data-es-br="label"]', { opacity: 0 }, { opacity: 0.9, duration: 0.012, stagger: 0.004 }, A0 + 0.008);
  T.fromTo('[data-es-br="loop"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, A0 + 0.02);
  T.to('[data-es-br="loop"]', { opacity: 0, duration: 0.012 }, A1 - 0.006);
  T.to('[data-es-part="act"]', { opacity: 0.45, duration: 0.02 }, A1 + 0.002);
  // runtime: the branches stay, their names give way to the stage labels.
  T.to('[data-es-br="label"]', { opacity: 0, duration: 0.015 }, 0.71);
  T.to('[data-es-part="act"]', { opacity: 0.8, duration: 0.03 }, 0.72);
}
