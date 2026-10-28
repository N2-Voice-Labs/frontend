import { range } from "@/lib/cinematic/visual";
import { MARKERS, STAGES, type StageId } from "../beats";
import { CAMERA, MARKER_U, STAGE_U, U, type Geo, type P2 } from "./geometry";
import { C, Dot, Label, all, n2, one, op, s, setA, speech, type Bind, type Tw } from "./shared";

/**
 * The runtime seen whole: the same path the camera travelled, each region named (STAGES), T0–T4 as
 * instrumentation ticks (names only, no numbers), packets travelling and pausing at each stage, nodes
 * pulsing as they pass, and one multilingual pass: KO at the input, 한국어 at the language layer, nothing
 * at reasoning, EN at the output. The spine and VOICE OUT live here too.
 */

const PK = 4;
const PERIOD = 10;
const STOPS = [U.vinA, U.vad, U.stt, U.und, U.reason, U.respond, U.tts, U.vout, 0.97];
const SEG_T = (() => {
  const d = STOPS.slice(1).map((b, j) => 0.05 + (b - STOPS[j]));
  const total = d.reduce((a, b) => a + b, 0);
  const out = [0];
  d.forEach((x) => out.push(out[out.length - 1] + x / total));
  return out;
})();
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** Position along the spine at loop phase phi: travel between stops, then creep (a pause) at each. */
function travelAt(phi: number) {
  let j = 0;
  while (j < STOPS.length - 2 && phi >= SEG_T[j + 1]) j++;
  const x = (phi - SEG_T[j]) / (SEG_T[j + 1] - SEG_T[j]);
  const a = STOPS[j], b = STOPS[j + 1];
  return x < 0.7 ? a + (b - a) * 0.95 * easeInOut(x / 0.7) : a + (b - a) * (0.95 + 0.05 * (x - 0.7) / 0.3);
}

/** Node per stage (u on the spine, or a point for agent/tools). */
const NODE_U: Record<StageId, number> = { "voice-in": U.vinA, vad: U.vadA, stt: U.sttA, agent: U.reason, tools: U.reason, tts: U.ttsA, "voice-out": U.voutA };
const nodeAt = (G: Geo, id: StageId): P2 => (id === "tools" ? G.tools.end : id === "agent" ? G.c : G.pt(NODE_U[id]));
const TAGS = [
  { t: "KO", u: U.vin, c: "ko", lang: undefined },
  { t: "한국어", u: U.stt, c: "ko", lang: "ko" },
  { t: "EN", u: U.vout, c: "en", lang: undefined },
] as const;

type Place = { at: P2; dx: number; dy: number; anchor: "start" | "middle" | "end" };

/** Portrait: put text on the roomier side of the bending path; desktop: below (labels) / above (markers, tags). */
function place(G: Geo, at: P2, below: boolean, gap = 22): Place {
  if (!G.portrait) return { at, dx: 0, dy: below ? gap : -gap + 6, anchor: "middle" };
  const right = at.x < G.w / 2 ? below : !below;
  return { at, dx: right ? 14 : -14, dy: 0, anchor: right ? "start" : "end" };
}

function stageLabel(G: Geo, id: StageId): Place {
  if (id === "agent") {
    const a = { x: G.c.x - G.tc.nx * G.R * 1.05, y: G.c.y - G.tc.ny * G.R * 1.05 };
    // Portrait: above the field, clear of the TOOLS branch that leaves it sideways.
    return G.portrait ? { at: { x: G.c.x, y: G.c.y - G.R * 1.25 }, dx: 0, dy: -8, anchor: "middle" } : { at: a, dx: 0, dy: -10, anchor: "middle" };
  }
  // Under the branch's end on both layouts; beside it on portrait it would land on the agent's label.
  if (id === "tools") return { at: G.tools.end, dx: 0, dy: G.portrait ? 18 : 16, anchor: "middle" };
  return place(G, G.pt(STAGE_U[id]), true, 24);
}

/** Under everything: the spine and the VOICE OUT wave. */
export function RuntimeBase({ G }: { G: Geo }) {
  return (
    <g data-es-part="spine">
      <path data-es-rt="spine" className={s.stroke} d={G.spine} stroke={C.ink} strokeOpacity={0.24} strokeWidth={1} pathLength={1} strokeDasharray="1 1" />
      <path data-es-rt="vout" data-es-live="rt-vout" className={s.stroke} d={G.along(U.voutA, U.voutB, 90, (x) => 7 * speech(x, 0, 7, 2.1))} stroke={C.en} strokeWidth={1.3} />
    </g>
  );
}

/** Over everything: nodes, stage labels, markers, packets, language tags. */
export function RuntimeTop({ G }: { G: Geo }) {
  const tick = 6;
  const markerD = MARKER_U.map((u) => {
    const a = G.pt(u, -tick), b = G.pt(u, tick);
    return `M${n2(a.x)} ${n2(a.y)}L${n2(b.x)} ${n2(b.y)}`;
  }).join("");
  return (
    <g data-es-part="runtime">
      {STAGES.map((st) => (
        <g key={st.id} data-es-rt="node" transform={`translate(${n2(nodeAt(G, st.id).x)} ${n2(nodeAt(G, st.id).y)})`}>
          <g className={s.cs}>
            <circle data-es-live="rt-node" className={`${s.stroke} ${s.node}`} r={3.2} stroke={st.id === "voice-in" ? C.ko : st.id === "voice-out" ? C.en : st.id === "agent" || st.id === "tools" ? C.gold : C.ink} strokeWidth={1.2} />
          </g>
        </g>
      ))}
      {STAGES.map((st) => {
        const l = stageLabel(G, st.id);
        return <Label key={st.id} at={l.at} dx={l.dx} dy={l.dy} anchor={l.anchor} g={{ "data-es-rt": "label" }}>{st.label}</Label>;
      })}
      <g data-es-rt="marker">
        <path className={s.stroke} d={markerD} stroke={C.ink} strokeOpacity={0.5} strokeWidth={1} />
        {MARKERS.map((m, i) => {
          const l = place(G, G.pt(MARKER_U[i]), false, 16);
          return <Label key={m} at={l.at} dx={l.dx} dy={l.dy} anchor={l.anchor} cls="tiny">{m}</Label>;
        })}
      </g>
      <g data-es-rt="tags">
        {TAGS.map((tg) => {
          const l = place(G, G.pt(tg.u), false, 34);
          return (
            <Label key={tg.t} at={l.at} dx={l.dx} dy={G.portrait ? 14 : l.dy} anchor={l.anchor} cls="tiny" g={{ "data-es-live": "rt-tag" }} text={{ fill: C[tg.c], lang: tg.lang, style: { fillOpacity: 1 } }}>
              {tg.t}
            </Label>
          );
        })}
      </g>
      <g data-es-rt="flow">
        {Array.from({ length: PK }, (_, i) => (
          <Dot key={i} at={{ x: -9999, y: -9999 }} r={2.6} fill={C.ko} g={{ "data-es-live": "rt-pk", opacity: 0 }} c={{ "data-es-live": "rt-pk-core" }} />
        ))}
      </g>
    </g>
  );
}

export const bindRuntime: Bind = (svg, G) => {
  const vout = one(svg, "rt-vout");
  const pks = all(svg, "rt-pk"), cores = all(svg, "rt-pk-core"), nodes = all(svg, "rt-node"), tags = all(svg, "rt-tag");
  const colour = new Array<string>(PK).fill("");
  const hit = new Float64Array(STAGES.length).fill(-99);
  const nodeU = STAGES.map((st) => NODE_U[st.id]);
  let lastU = 0;

  return (p, t) => {
    if (p < 0.66) return;
    let d = "";
    const amp = 7 * (1 + 0.5 * range(p, 0.86, 0.94));
    for (let i = 0; i <= 90; i++) {
      const x = i / 90, q = G.at(U.voutA + (U.voutB - U.voutA) * x), v = amp * speech(x, t, 7, 2.1);
      d += (i ? "L" : "M") + n2(q.x + q.nx * v) + " " + n2(q.y + q.ny * v);
    }
    setA(vout, "d", d);
    if (p < 0.72) return;

    let lead = 0;
    for (let i = 0; i < PK; i++) {
      const u = travelAt(((t / PERIOD + i / PK) % 1 + 1) % 1);
      if (i === 0) lead = u;
      const q = G.pt(u);
      setA(pks[i], "transform", `translate(${n2(q.x)} ${n2(q.y)})`);
      op(pks[i], range(u, U.vinA, U.vinA + 0.02) * (1 - range(u, 0.94, 0.97)));
      const c = u < U.stt + 0.03 ? C.ko : u < U.respond ? C.gold : C.en;
      if (c !== colour[i]) { setA(cores[i], "fill", c); colour[i] = c; }
    }
    // node heartbeat when the lead packet crosses it (agent and tools pulse together).
    nodeU.forEach((nu, k) => { if (lastU < nu && lead >= nu) hit[k] = t; });
    lastU = lead;
    nodes.forEach((el, k) => setA(el, "r", (3.2 * (1 + 0.7 * Math.exp(-(t - hit[k]) * 4))).toFixed(2)));
    // the multilingual pass: each tag brightens as the lead packet passes it.
    tags.forEach((el, k) => op(el, 0.45 + 0.55 * Math.exp(-(((lead - TAGS[k].u) / 0.03) ** 2))));
  };
};

export function runtimeTimeline(T: Tw) {
  // The spine is drawn as far as the camera has travelled.
  T.fromTo('[data-es-rt="spine"]', { strokeDashoffset: 1 - CAMERA.reveal(U.vinB) }, { strokeDashoffset: 1 - CAMERA.reveal(U.vinB + 0.012), duration: 0.03 }, 0);
  for (const m of CAMERA.moves) T.to('[data-es-rt="spine"]', { strokeDashoffset: 1 - CAMERA.reveal(m.u), duration: m.dur, ease: "none" }, m.at);
  T.fromTo('[data-es-rt="vout"]', { opacity: 0 }, { opacity: 1, duration: 0.02 }, 0.69);
  T.fromTo('[data-es-rt="node"]', { opacity: 0 }, { opacity: 1, duration: 0.012, stagger: 0.004 }, 0.735);
  T.fromTo('[data-es-rt="label"]', { opacity: 0 }, { opacity: 1, duration: 0.012, stagger: 0.005 }, 0.745);
  T.fromTo('[data-es-rt="flow"]', { opacity: 0 }, { opacity: 1, duration: 0.015 }, 0.745);
  T.fromTo('[data-es-rt="marker"]', { opacity: 0 }, { opacity: 1, duration: 0.015 }, 0.765);
  T.fromTo('[data-es-rt="tags"]', { opacity: 0 }, { opacity: 1, duration: 0.015 }, 0.775);
  // exit: names and instruments go first; the path and the outgoing wave stay longest.
  T.to('[data-es-rt="label"], [data-es-rt="marker"], [data-es-rt="tags"]', { opacity: 0, duration: 0.02 }, 0.88);
}
