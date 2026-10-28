"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import { gsap } from "@/lib/cinematic/gsap";
import { director, isCinematic, subscribeDirector } from "@/lib/cinematic/director";
import { BRIDGE, EN, INK, KO, PALETTE, range } from "@/lib/cinematic/visual";
import { LANE_Y } from "@/components/scenes/conversation/visual";
import { AGENT_BRANCHES, STAGES, type StageId } from "./beats";
import { bridgeGeometry, isPortrait } from "./geometry";
import s from "./bridge-system.module.css";

/**
 * The Voice Labs system of chapter 03 as ONE evolving SVG: bridge strands → one line + one signal →
 * the four states of the concept → the runtime pipeline → VOICE OUT's waveform handed to chapter 04.
 *
 * - Scroll (systemTimeline) handles visibility and reveals; it only tweens size-independent values
 *   (opacity, normalised dash offsets, unitless CSS vars), so it survives resizes. All geometry is
 *   re-rendered from React state (viewBox = viewport, 1 unit = 1 CSS px, matching the canvas arc).
 * - Time (gsap.ticker, only while chapter 03 is on screen, never under reduced motion) handles life:
 *   live waveforms, packets, the heartbeat of the active stage. It writes attributes through the DOM.
 */

/**
 * Where the HTML statement lines go during BEATS.statement. The system keeps the bottom ~25% of the
 * screen free of labels: desktop pipeline sits on y = 50% with everything above ~0.72h; portrait
 * pipeline runs vertically from 10% to 70% of the height.
 */
export const STATEMENT_ZONE: "top" | "bottom" = "bottom";

const C = { ink: PALETTE[INK], ko: PALETTE[KO], en: PALETTE[EN], gold: PALETTE[BRIDGE] };
const GLOW = "url(#bs-glow)";

// ---------------------------------------------------------------- geometry helpers

/** The runtime spine: point at u (0–1 along it) with perpendicular offset v (px). */
type Frame = { ox: number; oy: number; dx: number; dy: number; nx: number; ny: number };
const fx = (F: Frame, u: number, v: number) => F.ox + F.dx * u + F.nx * v;
const fy = (F: Frame, u: number, v: number) => F.oy + F.dy * u + F.ny * v;
const n1 = (v: number) => (Math.round(v * 10) / 10).toString();
const pt = (F: Frame, u: number, v: number) => `${n1(fx(F, u, v))} ${n1(fy(F, u, v))}`;
const seg = (F: Frame, u0: number, u1: number, v0 = 0, v1 = v0) => `M${pt(F, u0, v0)}L${pt(F, u1, v1)}`;

function trace(F: Frame, u0: number, u1: number, n: number, v: (s: number) => number) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    d += (i ? "L" : "M") + pt(F, u0 + (u1 - u0) * t, v(t));
  }
  return d;
}

/** Speech-like wave, 0 at both ends so it joins the line. `t` = seconds (0 for the static drawing). */
function waveV(x: number, amp: number, periods: number, phase: number, t: number) {
  return amp * Math.sin(Math.PI * x) * (0.55 + 0.45 * Math.sin(t * 2.3 + x * 4 + phase)) * Math.sin(Math.PI * 2 * periods * x - t * 7 + phase);
}

function waveD(F: Frame, u0: number, u1: number, amp: number, periods: number, phase: number, t: number, n = 44) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const x = i / n, u = u0 + (u1 - u0) * x, v = waveV(x, amp, periods, phase, t);
    d += (i ? "L" : "M") + n1(fx(F, u, v)) + " " + n1(fy(F, u, v));
  }
  return d;
}

/** The handoff wave in its own coordinates (x 0…len, y around 0); the .handoff transform places it. */
function localWaveD(len: number, amp: number, periods: number, phase: number, t: number, sign: number, n = 72) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    d += (i ? "L" : "M") + n1(x * len) + " " + n1(sign * waveV(x, amp, periods, phase, t));
  }
  return d;
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// ---------------------------------------------------------------- the runtime along the spine (u)

const AG0 = 0.4, AG1 = 0.6;
/** 0 at the agent's split/join, 1 along its flat middle. */
const branchS = (u: number) => smooth((u - AG0) / 0.03) * (1 - smooth((u - (AG1 - 0.03)) / 0.03));
const VIN: [number, number] = [0, 0.11];
const VOUT: [number, number] = [0.84, 1];
const WAVE = { periods: 6, inPhase: 0.3, outPhase: 2.1 };
const NODE_U: Record<Exclude<StageId, "tools">, number[]> = { "voice-in": [0], vad: [0.14], stt: [0.28], agent: [AG0, AG1], tts: [0.64], "voice-out": [0.84] };
const CONN: Partial<Record<StageId, [number, number]>> = { vad: [0.11, 0.14], stt: [0.25, 0.28], agent: [0.36, AG0], tts: [AG1, 0.64], "voice-out": [0.8, 0.84] };
const LABEL_U: Record<StageId, number> = { "voice-in": 0.055, vad: 0.195, stt: 0.32, agent: 0.5, tools: 0.525, tts: 0.72, "voice-out": 0.92 };
const STT_TOKENS = [
  { u: 0.292, t: "내일" },
  { u: 0.318, t: "오전에" },
  { u: 0.346, t: "…" },
];
const TOOL_NAMES = ["TOOLS", "KNOWLEDGE", "MEMORY", "INTEGRATIONS"] as const;

/** Packets pause (slowly creep) at each stop: VOICE IN, VAD, STT, AGENT (mid), TTS, VOICE OUT. */
const STOPS = [0, 0.055, 0.195, 0.32, 0.5, 0.72, 0.92, 1];
const SEG_T = (() => {
  const d = STOPS.slice(1).map((b, j) => 0.06 + (b - STOPS[j]));
  const total = d.reduce((a, b) => a + b, 0);
  const out = [0];
  d.forEach((x) => out.push(out[out.length - 1] + x / total));
  return out;
})();
const PACKETS = 3;
const PERIOD = 9;
const travel = { u: 0, seg: 0, dwell: false };
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
function travelAt(phi: number) {
  let j = 0;
  while (j < STOPS.length - 2 && phi >= SEG_T[j + 1]) j++;
  const x = (phi - SEG_T[j]) / (SEG_T[j + 1] - SEG_T[j]);
  const a = STOPS[j], b = STOPS[j + 1];
  travel.seg = j;
  if (j === STOPS.length - 2) {
    travel.u = a + (b - a) * x;
    travel.dwell = false;
  } else if (x < 0.72) {
    travel.u = a + (b - a) * 0.94 * easeInOut(x / 0.72);
    travel.dwell = false;
  } else {
    travel.u = a + (b - a) * (0.94 + 0.06 * (x - 0.72) / 0.28);
    travel.dwell = true;
  }
}
/** Index into STAGES of the stage a packet at `u` is in; the agent's mid pause belongs to TOOLS · CONTEXT. */
function stageAt(u: number, seg: number, dwell: boolean) {
  if (u < 0.125) return 0;
  if (u < 0.265) return 1;
  if (u < 0.38) return 2;
  if (u < 0.62) return seg === 3 && dwell ? 4 : 3;
  if (u < 0.82) return 5;
  return 6;
}

// ---------------------------------------------------------------- composition

type Label = { x: number; y: number; anchor: "start" | "middle" | "end"; base: "hanging" | "middle" | "auto"; rot?: string };

function compose(w: number, h: number) {
  const portrait = isPortrait(w, h);
  const G = bridgeGeometry(w, h, portrait);
  const cy = h / 2;

  let arc = "";
  for (let i = 0; i <= 64; i++) {
    const p = G.at(i / 64);
    arc += (i ? "L" : "M") + n1(p.x) + " " + n1(p.y);
  }

  // Desktop: horizontal through the centre. Portrait: vertical, 10% → 70% of the height, labels to the right.
  const F: Frame = portrait ? { ox: w * 0.2, oy: h * 0.1, dx: 0, dy: h * 0.6, nx: 1, ny: 0 } : { ox: w * 0.06, oy: cy, dx: w * 0.88, dy: 0, nx: 0, ny: 1 };
  const H: Frame = { ox: 0, oy: cy, dx: w, dy: 0, nx: 0, ny: 1 };
  const amp = portrait ? 7 : 9;
  const V = portrait ? [-34, -12, 12, 34] : [-42, -16, 16, 42];
  const len = portrait ? F.dy : F.dx;

  const stageLabel = (id: StageId): Label => {
    if (id === "agent") return portrait ? { x: fx(F, AG0, 0) + 52, y: fy(F, AG0, 0), anchor: "start", base: "middle" } : { x: fx(F, 0.5, -70), y: fy(F, 0.5, -70), anchor: "middle", base: "auto" };
    if (id === "tools") return portrait ? { x: fx(F, 0.65, 142), y: fy(F, 0.65, 142), anchor: "start", base: "middle" } : { x: fx(F, LABEL_U.tools, 152), y: fy(F, LABEL_U.tools, 152), anchor: "middle", base: "hanging" };
    const u = LABEL_U[id];
    return portrait ? { x: fx(F, u, 0) + 52, y: fy(F, u, 0), anchor: "start", base: "middle" } : { x: fx(F, u, 26), y: fy(F, u, 26), anchor: "middle", base: "hanging" };
  };

  // Concept: four zones on the horizontal line.
  const zu = [0.2, 0.4, 0.6, 0.8];
  const zh = portrait ? 0.085 : 0.07;
  const camp = portrait ? 7 : 10;
  const ns = portrait ? 0.8 : 1;
  const netPts = [[-0.62, -14], [-0.2, -30], [0.18, -12], [0.5, -32], [0.1, 16]].map(([a, b]) => [zu[2] + a * zh, b * ns] as [number, number]);
  const L: [number, number] = [zu[2] - 0.95 * zh, 0], R: [number, number] = [zu[2] + 0.95 * zh, 0];
  const P = (i: number) => (i === -1 ? L : i === -2 ? R : netPts[i]);
  const netEdges = [[-1, 0], [0, 1], [1, 2], [0, 2], [2, 3], [2, 4], [3, -2], [4, -2]].map(([a, b]) => seg(H, P(a)[0], P(b)[0], P(a)[1], P(b)[1]));
  const tokenU = [-1, 0, 1].map((k) => zu[1] + k * zh * 0.72);

  // Tools · context: a small connected cluster off the agent's outer branch.
  const toolFrom: [number, number] = [0.5, V[3]];
  const toolD: [number, number] = portrait ? [0.5, 110] : [0.5, 72];
  const toolNodes: [number, number][] = portrait ? [[0.45, 150], [0.5, 150], [0.55, 150], [0.6, 150]] : [[0.45, 96], [0.5, 120], [0.55, 96], [0.6, 120]];
  const toolEdges: [number, number][][] = portrait
    ? toolNodes.map((n) => [toolD, n])
    : [[toolD, toolNodes[0]], [toolD, toolNodes[2]], [toolNodes[0], toolNodes[1]], [toolNodes[1], toolNodes[2]], [toolNodes[2], toolNodes[3]]];
  const toolLabels: Label[] = toolNodes.map(([u, v]) =>
    portrait ? { x: fx(F, u, v) + 8, y: fy(F, u, v), anchor: "start", base: "middle" } : { x: fx(F, u, v + 8), y: fy(F, u, v + 8), anchor: "middle", base: "hanging" },
  );

  const branchLabels: Label[] = V.map((v) => {
    if (portrait) {
      const x = fx(F, 0.435, v) - 9, y = fy(F, 0.435, v);
      return { x, y, anchor: "start", base: "auto", rot: `rotate(90 ${n1(x)} ${n1(y)})` };
    }
    return { x: fx(F, 0.565, v - 5), y: fy(F, 0.565, v - 5), anchor: "end", base: "auto" };
  });

  const vars = {
    "--base": `${n1(G.base)}px`,
    "--fdy": `${n1(cy - G.base)}px`,
    "--cy": `${n1(cy)}px`,
    "--W": `${w}px`,
    "--hx0": `${n1(fx(F, VOUT[0], 0))}px`,
    "--hy0": `${n1(fy(F, VOUT[0], 0))}px`,
    "--hy1": `${n1(LANE_Y.ko * h)}px`,
    "--hs0": ((VOUT[1] - VOUT[0]) * len) / w,
    "--hr": portrait ? "90deg" : "0deg",
  } as CSSProperties;

  return {
    w, h, cy, portrait, G, arc, F, H, amp, V, vars,
    leadIn: -(portrait ? F.oy / F.dy : F.ox / F.dx),
    concept: {
      wave1: waveD(H, zu[0] - zh, zu[0] + zh, camp, 4, 0.4, 0),
      wave2: waveD(H, zu[3] - zh, zu[3] + zh, camp, 4, 1.7, 0),
      tokens: tokenU.map((u) => ({ x: u * w, mark: seg(H, u - zh * 0.18, u + zh * 0.18) })),
      netEdges,
      netPts: netPts.map(([u, v]) => ({ x: fx(H, u, v), y: fy(H, u, v) })),
      labels: zu.map((u) => u * w),
    },
    stageLabel,
    branches: V.map((v) => trace(F, AG0, AG1, 40, (t) => v * branchS(AG0 + t * (AG1 - AG0)))),
    branchLabels,
    toolFrom, toolD, toolNodes, toolEdges, toolLabels,
  };
}

type Layout = ReturnType<typeof compose>;

/** Bridge strands: [dy px, lift delta, colour, opacity]. #1/#2 sit on the canvas' outer cables (±5px) and merge; #3/#4 fade. */
const STRANDS = [
  { dy: 0, ds: 0, c: C.gold, o: 0.9, sw: 1.3 },
  { dy: -5, ds: 0.06, c: C.gold, o: 0.55, sw: 1 },
  { dy: 5, ds: -0.05, c: C.ink, o: 0.4, sw: 1 },
  { dy: -15, ds: 0.3, c: C.ink, o: 0.25, sw: 1 },
  { dy: 13, ds: -0.25, c: C.gold, o: 0.3, sw: 1 },
];

// ---------------------------------------------------------------- component

type Live = {
  idle: SVGElement | null;
  idleKo: SVGElement | null;
  idleEn: SVGElement | null;
  vin: SVGElement | null;
  vout: SVGElement | null;
  hand: SVGElement | null;
  pk: SVGElement[];
  pkCore: SVGElement[];
  br: SVGElement[];
  act: (SVGElement | null)[];
  nodes: SVGElement[][];
};

/** The system SVG, covering the chapter layer (absolute, inset 0, behind the type, pointer-events none, aria-hidden). */
export function BridgeSystem(): JSX.Element {
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const L = useMemo(() => compose(size.w, size.h), [size.w, size.h]);
  const svgRef = useRef<SVGSVGElement>(null);
  const layoutRef = useRef<Layout>(L);
  const live = useRef<Live | null>(null);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      setSize((o) => (o.w === window.innerWidth && o.h === window.innerHeight ? o : { w: window.innerWidth, h: window.innerHeight }));
    };
    const onResize = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // Re-collect the live elements whenever the geometry re-renders.
  useEffect(() => {
    layoutRef.current = L;
    const svg = svgRef.current;
    if (!svg) return;
    const one = (sel: string) => svg.querySelector<SVGElement>(sel);
    const all = (sel: string) => Array.from(svg.querySelectorAll<SVGElement>(sel));
    live.current = {
      idle: one('[data-bs-live="idle"]'),
      idleKo: one('[data-bs-live="idle-ko"]'),
      idleEn: one('[data-bs-live="idle-en"]'),
      vin: one('[data-bs-live="vin"]'),
      vout: one('[data-bs-live="vout"]'),
      hand: one('[data-bs-live="handoff"]'),
      pk: all("[data-bs-pk]"),
      pkCore: all("[data-bs-pk-core]"),
      br: all("[data-bs-br]"),
      act: STAGES.map((st) => one(`[data-bs-act="${st.id}"]`)),
      nodes: STAGES.map((st) => all(`[data-bs-stage="${st.id}"][data-bs-role="node"]`)),
    };
  }, [L]);

  // Life: only while chapter 03 is on screen, never under reduced motion / outside the film.
  useEffect(() => {
    if (!isCinematic() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let running = false, flowing = false, active = -1, activeAt = 0;
    const act = new Float32Array(STAGES.length).fill(1);
    const colour = new Int8Array(PACKETS).fill(-1);
    const brOn = new Uint8Array(PACKETS);

    const tick = (time: number, dtMs: number) => {
      const E = live.current, Lr = layoutRef.current;
      if (!E) return;
      const p = director.position - 2;
      const F = Lr.F;

      // title / tagline: a slow packet keeps crossing, cyan → magenta.
      if (p > 0.39 && p < 0.58 && E.idle && E.idleKo && E.idleEn) {
        const k = (time / 7) % 1;
        E.idle.setAttribute("transform", `translate(${n1(k * Lr.w)} ${n1(Lr.cy)})`);
        E.idleKo.setAttribute("opacity", (1 - k).toFixed(2));
        E.idleEn.setAttribute("opacity", k.toFixed(2));
      }

      // live waveforms at both ends of the runtime, and the handoff wave flattening into chapter 04.
      if (p > 0.62 && p < 0.975) {
        E.vin?.setAttribute("d", waveD(F, VIN[0], VIN[1], Lr.amp, WAVE.periods, WAVE.inPhase, time));
        E.vout?.setAttribute("d", waveD(F, VOUT[0], VOUT[1], Lr.amp, WAVE.periods, WAVE.outPhase, time));
      }
      if (p > 0.93 && E.hand) {
        const calm = 1 - 0.85 * range(p, 0.955, 1);
        E.hand.setAttribute("d", localWaveD(Lr.w, Lr.amp * calm, WAVE.periods, WAVE.outPhase, time, Lr.portrait ? -1 : 1));
      }

      // flow: a few packets travel the pipeline; one stage at a time is active.
      if (p > 0.76 && p < 0.975) {
        flowing = true;
        let lead = 0;
        for (let i = 0; i < PACKETS; i++) {
          travelAt((time / PERIOD + i / PACKETS) % 1);
          const u = travel.u;
          if (i === 0) lead = stageAt(u, travel.seg, travel.dwell);
          const inAgent = u > AG0 + 0.004 && u < AG1 - 0.004;
          const fade = range(u, 0, 0.02) * (1 - range(u, 0.97, 1));
          const pk = E.pk[i];
          if (pk) {
            pk.setAttribute("transform", `translate(${n1(fx(F, u, 0))} ${n1(fy(F, u, 0))})`);
            pk.setAttribute("opacity", inAgent ? "0" : fade.toFixed(2));
          }
          const c = u < AG0 ? KO : u < 0.8 ? BRIDGE : EN;
          if (c !== colour[i] && E.pkCore[i]) { E.pkCore[i].setAttribute("fill", PALETTE[c]); colour[i] = c; }
          if (inAgent || brOn[i]) {
            for (let k = 0; k < 4; k++) {
              const b = E.br[i * 4 + k];
              if (!b) continue;
              if (inAgent) {
                const v = Lr.V[k] * branchS(u);
                b.setAttribute("transform", `translate(${n1(fx(F, u, v))} ${n1(fy(F, u, v))})`);
                b.setAttribute("opacity", "1");
              } else b.setAttribute("opacity", "0");
            }
            brOn[i] = inAgent ? 1 : 0;
          }
        }
        if (lead !== active) {
          if (active >= 0) E.nodes[active]?.forEach((n) => n.style.setProperty("--pulse", "1"));
          active = lead;
          activeAt = time;
        }
        const pulse = (1 + 0.9 * Math.exp(-(time - activeAt) * 4)).toFixed(3);
        E.nodes[active]?.forEach((n) => n.style.setProperty("--pulse", pulse));
        const dim = 1 - 0.65 * range(p, 0.78, 0.8);
        const ease = Math.min(1, (dtMs / 1000) * 6);
        for (let j = 0; j < act.length; j++) {
          act[j] += ((j === active ? 1 : dim) - act[j]) * ease;
          const g = E.act[j];
          if (g) g.style.opacity = act[j].toFixed(3);
        }
      } else if (flowing) {
        flowing = false;
        active = -1;
        act.fill(1);
        E.act.forEach((g) => g && (g.style.opacity = ""));
        E.nodes.forEach((ns) => ns.forEach((n) => n.style.setProperty("--pulse", "1")));
      }
    };

    const unsubscribe = subscribeDirector((_, chapter) => {
      const on = chapter === 2;
      if (on && !running) { gsap.ticker.add(tick); running = true; }
      else if (!on && running) { gsap.ticker.remove(tick); running = false; }
    });
    return () => { unsubscribe(); if (running) gsap.ticker.remove(tick); };
  }, []);

  const { w, h, cy, F, H, G, arc, amp, concept } = L;
  const node = (id: StageId, u: number, v = 0, stroke: string = C.ink) => (
    <circle key={`${id}-${u}`} data-bs-stage={id} data-bs-role="node" className={`${s.node} ${s.pop}`} cx={fx(F, u, v)} cy={fy(F, u, v)} r={3.2} stroke={stroke} strokeWidth={1.2} />
  );
  const conn = (id: StageId, d: string) => <path data-bs-stage={id} data-bs-role="conn" className={s.stroke} d={d} stroke={C.ink} strokeOpacity={0.35} strokeWidth={1} pathLength={1} strokeDasharray="1 1" />;
  const label = (id: StageId, text: string) => {
    const l = L.stageLabel(id);
    return <text data-bs-stage={id} data-bs-role="label" className={s.label} x={l.x} y={l.y} textAnchor={l.anchor} dominantBaseline={l.base}>{text}</text>;
  };
  const draw = { pathLength: 1, strokeDasharray: "1 1", className: s.stroke };
  const lab = Object.fromEntries(STAGES.map((st) => [st.id, st.label])) as Record<StageId, string>;

  return (
    <svg ref={svgRef} className={s.svg} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false" data-portrait={L.portrait || undefined} style={L.vars}>
      <defs>
        <filter id="bs-glow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* 1–3 · stabilize → align → enter: strands over the canvas arc, merging, then the camera moves in. */}
      <g data-bs="bridge" className={s.filmOnly}>
        <g data-bs="cam" className={s.cam}>
          <g data-bs="flat" className={s.flat}>
            <path data-bs="halo" className={s.stroke} d={arc} stroke={C.gold} strokeOpacity={0.07} strokeWidth={6} />
            {STRANDS.map((st, i) => (
              <path
                key={i}
                data-bs-strand={i}
                className={`${s.stroke} ${s.strand}`}
                d={arc}
                stroke={st.c}
                strokeOpacity={st.o}
                strokeWidth={st.sw}
                pathLength={1}
                strokeDasharray="1 1"
                display={L.portrait && i > 2 ? "none" : undefined}
                style={{ "--dy": `${st.dy}px`, "--ds": st.ds } as CSSProperties}
              />
            ))}
            <path data-bs="trail" className={s.stroke} d={arc} stroke={C.ink} strokeOpacity={0.9} strokeWidth={1.5} pathLength={1} strokeDasharray="0.06 1" />
          </g>
          <g data-bs="end" className={s.pop}>
            <circle className={s.stroke} cx={G.x0} cy={G.base} r={8} stroke={C.ko} strokeOpacity={0.6} strokeWidth={1} />
            <circle cx={G.x0} cy={G.base} r={2.4} fill={C.ko} filter={GLOW} />
          </g>
          <g data-bs="end" className={s.pop}>
            <circle className={s.stroke} cx={G.x1} cy={G.base} r={8} stroke={C.en} strokeOpacity={0.6} strokeWidth={1} />
            <circle cx={G.x1} cy={G.base} r={2.4} fill={C.en} filter={GLOW} />
          </g>
        </g>
      </g>

      {/* 4–5 · signal, title, tagline: one line through the centre, one packet crossing. */}
      <g className={s.filmOnly}>
        <path data-bs="line" className={s.stroke} d={`M0 ${n1(cy)}L${w} ${n1(cy)}`} stroke={C.ink} strokeOpacity={0.8} strokeWidth={1} />
        <g data-bs="packet" className={s.packet}>
          <circle className={s.pkKo} r={3.4} fill={C.ko} filter={GLOW} />
          <circle className={s.pkEn} r={3.4} fill={C.en} filter={GLOW} />
        </g>
        <g data-bs="idle">
          <g data-bs-live="idle" transform={`translate(0 ${n1(cy)})`}>
            <circle data-bs-live="idle-ko" r={2.6} fill={C.ko} filter={GLOW} />
            <circle data-bs-live="idle-en" r={2.6} fill={C.en} opacity={0} filter={GLOW} />
          </g>
        </g>
      </g>

      {/* 6 · concept: one signal, four states. */}
      <g data-bs="concept" className={s.filmOnly}>
        <g data-bs-concept="0">
          <path data-bs-role="draw" {...draw} d={concept.wave1} stroke={C.ko} strokeWidth={1.2} />
          <text data-bs-role="label" className={s.label} x={concept.labels[0]} y={cy + 26} textAnchor="middle" dominantBaseline="hanging">SPEECH</text>
        </g>
        <g data-bs-concept="1">
          {concept.tokens.map((t, i) => <path key={i} data-bs-role="draw" {...draw} d={t.mark} stroke={C.ink} strokeOpacity={0.8} strokeWidth={1.5} />)}
          {["내일", "오전", "회의"].map((t, i) => (
            <text key={t} data-bs-role="fade" className={s.token} x={concept.tokens[i].x} y={cy - 8} textAnchor="middle">{t}</text>
          ))}
          <text data-bs-role="label" className={s.label} x={concept.labels[1]} y={cy + 26} textAnchor="middle" dominantBaseline="hanging">UNDERSTAND</text>
        </g>
        <g data-bs-concept="2">
          {concept.netEdges.map((d, i) => <path key={i} data-bs-role="draw" {...draw} d={d} stroke={C.gold} strokeOpacity={0.7} strokeWidth={1} />)}
          {concept.netPts.map((p, i) => <circle key={i} data-bs-role="fade" cx={p.x} cy={p.y} r={1.9} fill={C.gold} />)}
          <text data-bs-role="label" className={s.label} x={concept.labels[2]} y={cy + 26} textAnchor="middle" dominantBaseline="hanging">REASON</text>
        </g>
        <g data-bs-concept="3">
          <path data-bs-role="draw" {...draw} d={concept.wave2} stroke={C.en} strokeWidth={1.2} />
          <text data-bs-role="label" className={s.label} x={concept.labels[3]} y={cy + 26} textAnchor="middle" dominantBaseline="hanging">RESPOND</text>
        </g>
      </g>

      {/* 7 · runtime: the same line, reorganised into the pipeline. Each stage: node → connector → body → label. */}
      <g data-bs="runtime">
        <g data-bs-act="voice-in">
          <path data-bs-stage="voice-in" data-bs-role="conn" className={s.stroke} d={seg(F, L.leadIn, 0)} stroke={C.ink} strokeOpacity={0.2} strokeWidth={1} pathLength={1} strokeDasharray="1 1" />
          {node("voice-in", 0, 0, C.ko)}
          <path data-bs-live="vin" data-bs-stage="voice-in" data-bs-role="draw" {...draw} d={waveD(F, VIN[0], VIN[1], amp, WAVE.periods, WAVE.inPhase, 0)} stroke={C.ko} strokeWidth={1.2} />
          {label("voice-in", lab["voice-in"])}
        </g>

        <g data-bs-act="vad">
          {conn("vad", seg(F, ...CONN.vad!))}
          {node("vad", 0.14)}
          <path data-bs-stage="vad" data-bs-role="draw" {...draw} d={waveD(F, 0.142, 0.166, amp * 0.8, 2, 0.2, 0, 16)} stroke={C.ko} strokeWidth={1.1} />
          <path data-bs-stage="vad" data-bs-role="draw" {...draw} d={waveD(F, 0.172, 0.198, amp * 0.9, 2.5, 1.1, 0, 16)} stroke={C.ko} strokeWidth={1.1} />
          <path data-bs-stage="vad" data-bs-role="draw" {...draw} d={seg(F, 0.198, 0.222)} stroke={C.ink} strokeOpacity={0.3} strokeWidth={1} />
          <path data-bs-stage="vad" data-bs-role="draw" {...draw} d={waveD(F, 0.222, 0.244, amp * 0.7, 2, 2.3, 0, 16)} stroke={C.ko} strokeWidth={1.1} />
          <path data-bs-stage="vad" data-bs-role="draw" {...draw} d={seg(F, 0.25, 0.25, -8, 8)} stroke={C.gold} strokeWidth={1.2} />
          {label("vad", lab.vad)}
        </g>

        <g data-bs-act="stt">
          {conn("stt", seg(F, ...CONN.stt!))}
          {node("stt", 0.28)}
          {STT_TOKENS.map((t) => (
            <path key={t.t} data-bs-stage="stt" data-bs-role="draw" {...draw} d={seg(F, t.u - 0.007, t.u + 0.007)} stroke={C.ink} strokeOpacity={0.8} strokeWidth={1.5} />
          ))}
          {STT_TOKENS.map((t) => (
            <text
              key={t.t}
              data-bs-stage="stt"
              data-bs-role="fade"
              className={s.token}
              x={fx(F, t.u, L.portrait ? -10 : -7)}
              y={fy(F, t.u, L.portrait ? -10 : -7)}
              textAnchor={L.portrait ? "end" : "middle"}
              dominantBaseline={L.portrait ? "middle" : "auto"}
            >
              {t.t}
            </text>
          ))}
          {label("stt", lab.stt)}
        </g>

        <g data-bs-act="agent">
          {conn("agent", seg(F, ...CONN.agent!))}
          {NODE_U.agent.map((u) => node("agent", u, 0, C.gold))}
          {L.branches.map((d, k) => <path key={k} data-bs-stage="agent" data-bs-role="draw" {...draw} d={d} stroke={C.gold} strokeOpacity={0.85} strokeWidth={1} />)}
          {L.branchLabels.map((l, k) => (
            <text key={k} data-bs-stage="agent" data-bs-role="fade" className={s.tiny} x={l.x} y={l.y} textAnchor={l.anchor} dominantBaseline={l.base} transform={l.rot}>
              {AGENT_BRANCHES[k].toLowerCase()}
            </text>
          ))}
          {label("agent", lab.agent)}
        </g>

        <g data-bs-act="tools">
          {node("tools", L.toolFrom[0], L.toolFrom[1], C.gold)}
          {conn("tools", seg(F, L.toolFrom[0], L.toolD[0], L.toolFrom[1] + 3.2, L.toolD[1]))}
          {L.toolEdges.map(([a, b], i) => <path key={i} data-bs-stage="tools" data-bs-role="draw" {...draw} d={seg(F, a[0], b[0], a[1], b[1])} stroke={C.ink} strokeOpacity={0.35} strokeWidth={1} />)}
          {L.toolNodes.map(([u, v], i) => <circle key={i} data-bs-stage="tools" data-bs-role="fade" cx={fx(F, u, v)} cy={fy(F, u, v)} r={2} fill={C.gold} />)}
          {L.toolLabels.map((l, i) => (
            <text key={i} data-bs-stage="tools" data-bs-role="fade" className={s.tiny} x={l.x} y={l.y} textAnchor={l.anchor} dominantBaseline={l.base}>{TOOL_NAMES[i]}</text>
          ))}
          {label("tools", lab.tools)}
        </g>

        <g data-bs-act="tts">
          {conn("tts", seg(F, ...CONN.tts!))}
          {node("tts", 0.64)}
          {[0.648, 0.656, 0.664, 0.672].map((u) => <circle key={u} data-bs-stage="tts" data-bs-role="fade" cx={fx(F, u, 0)} cy={fy(F, u, 0)} r={1.4} fill={C.gold} />)}
          <path data-bs-stage="tts" data-bs-role="draw" {...draw} d={seg(F, 0.68, 0.715)} stroke={C.gold} strokeWidth={1.2} />
          <path data-bs-stage="tts" data-bs-role="draw" {...draw} d={waveD(F, 0.715, 0.8, amp * 0.8, 4, 0.9, 0, 30)} stroke={C.en} strokeWidth={1.1} />
          {label("tts", lab.tts)}
        </g>

        <g data-bs-act="voice-out">
          {conn("voice-out", seg(F, ...CONN["voice-out"]!))}
          {node("voice-out", 0.84, 0, C.en)}
          <path data-bs-live="vout" data-bs-stage="voice-out" data-bs-role="draw" {...draw} d={waveD(F, VOUT[0], VOUT[1], amp, WAVE.periods, WAVE.outPhase, 0)} stroke={C.en} strokeWidth={1.2} />
          {label("voice-out", lab["voice-out"])}
        </g>
      </g>

      {/* 8 · flow: a few packets; at the agent each splits into branch packets that rejoin. */}
      <g data-bs="flow" className={s.filmOnly}>
        {Array.from({ length: PACKETS }, (_, i) => (
          <g key={i} data-bs-pk={i} transform="translate(-40 -40)" opacity={0}>
            <circle data-bs-pk-core={i} r={2.8} fill={C.ko} filter={GLOW} />
          </g>
        ))}
        {Array.from({ length: PACKETS * 4 }, (_, i) => (
          <circle key={i} data-bs-br={i} r={1.8} fill={C.gold} filter={GLOW} transform="translate(-40 -40)" opacity={0} />
        ))}
      </g>

      {/* 10 · handoff: VOICE OUT's wave stretches across the screen to chapter 04's first lane. */}
      <g data-bs="handoff" className={`${s.filmOnly} ${s.handoff}`}>
        <path data-bs-live="handoff" className={s.stroke} d={localWaveD(w, amp, WAVE.periods, WAVE.outPhase, 0, L.portrait ? -1 : 1)} stroke={C.en} strokeWidth={1.2} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------- scroll timeline

/** Adds every scroll-scrubbed SVG tween to the chapter timeline (positions = chapter progress). */
export function systemTimeline(tl: gsap.core.Timeline, q: (selector: string) => Element[]): void {
  const fromTo = (sel: string, from: gsap.TweenVars, to: gsap.TweenVars, at: number) => {
    const t = q(sel);
    if (t.length) tl.fromTo(t, from, to, at);
  };
  const to = (sel: string, vars: gsap.TweenVars, at: number) => {
    const t = q(sel);
    if (t.length) tl.to(t, vars, at);
  };
  const ease = "power2.inOut";
  const strand = (...i: number[]) => i.map((k) => `[data-bs-strand="${k}"]`).join(",");

  // 1 · stabilize (0–0.08): the arc appears exactly over the canvas bridge, the other strands draw along it.
  fromTo(strand(0), { opacity: 0 }, { opacity: 1, duration: 0.035 }, 0);
  fromTo(strand(1, 2, 3, 4), { opacity: 0, strokeDashoffset: 1 }, { opacity: 1, strokeDashoffset: 0, duration: 0.05, stagger: 0.007 }, 0.012);
  fromTo('[data-bs="end"]', { opacity: 0, "--s": 0.3 }, { opacity: 1, "--s": 1, duration: 0.04, stagger: 0.01 }, 0.005);
  fromTo('[data-bs="trail"]', { opacity: 0 }, { opacity: 1, duration: 0.01 }, 0.09);

  // 2 · align (0.08–0.18): two strands merge into the arc, two fade; a light trail runs along it.
  fromTo(strand(1, 2), { "--k": 0 }, { "--k": 1, duration: 0.08, ease }, 0.085);
  to(strand(3, 4), { opacity: 0, duration: 0.05 }, 0.09);
  fromTo('[data-bs="halo"]', { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.1);
  fromTo('[data-bs="trail"]', { strokeDashoffset: 0.06 }, { strokeDashoffset: -1, duration: 0.085, ease: "power1.inOut" }, 0.09);
  to('[data-bs="trail"]', { opacity: 0, duration: 0.01 }, 0.168);

  // 3 · enter (0.18–0.30): camera moves into the bridge; the arc flattens onto the centre line.
  const strands = q("[data-bs-strand]");
  if (strands.length) tl.set(strands, { strokeDasharray: "none" }, 0.18);
  to('[data-bs="end"]', { opacity: 0, duration: 0.04 }, 0.18);
  fromTo('[data-bs="cam"]', { "--cam": 1 }, { "--cam": 2.6, duration: 0.12, ease }, 0.18);
  fromTo('[data-bs="flat"]', { "--f": 0 }, { "--f": 1, duration: 0.1, ease }, 0.2);
  to('[data-bs="halo"]', { opacity: 0, duration: 0.05 }, 0.22);

  // 4 · signal (0.30–0.40): one line, one packet crossing cyan → magenta.
  fromTo('[data-bs="line"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, 0.296);
  to('[data-bs="bridge"]', { opacity: 0, duration: 0.015 }, 0.302);
  fromTo('[data-bs="packet"]', { opacity: 0 }, { opacity: 1, duration: 0.008 }, 0.308);
  fromTo('[data-bs="packet"]', { "--u": 0 }, { "--u": 1, duration: 0.085, ease: "sine.inOut" }, 0.31);
  to('[data-bs="packet"]', { opacity: 0, duration: 0.01 }, 0.396);

  // 5 · title / tagline: the line stays, dim; a slow packet keeps crossing (time loop moves it).
  to('[data-bs="line"]', { opacity: 0.32, duration: 0.03 }, 0.4);
  fromTo('[data-bs="idle"]', { opacity: 0 }, { opacity: 1, duration: 0.02 }, 0.41);
  to('[data-bs="idle"]', { opacity: 0, duration: 0.02 }, 0.55);

  // 6 · concept (0.56–0.66): SPEECH → UNDERSTAND → REASON → RESPOND, drawn left to right.
  for (let k = 0; k < 4; k++) {
    const at = 0.564 + k * 0.017, z = `[data-bs-concept="${k}"]`;
    fromTo(`${z} [data-bs-role="draw"]`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.016, stagger: 0.002 }, at);
    fromTo(`${z} [data-bs-role="fade"]`, { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: 0.003 }, at + 0.004);
    fromTo(`${z} [data-bs-role="label"]`, { opacity: 0 }, { opacity: 1, duration: 0.01 }, at + 0.006);
  }
  to('[data-bs="concept"]', { opacity: 0, duration: 0.018 }, 0.646);
  to('[data-bs="line"]', { opacity: 0, duration: 0.015 }, 0.648);

  // 7 · runtime (0.64–0.80): each stage at STAGES[k].at — node, then connector, then body, then label.
  for (const { id, at } of STAGES) {
    const sel = (role: string) => `[data-bs-stage="${id}"][data-bs-role="${role}"]`;
    fromTo(sel("node"), { opacity: 0, "--s": 0.2 }, { opacity: 1, "--s": 1, duration: 0.006 }, at);
    fromTo(sel("conn"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.008 }, at + 0.003);
    fromTo(sel("draw"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.012, stagger: 0.002 }, at + 0.006);
    fromTo(sel("fade"), { opacity: 0 }, { opacity: 1, duration: 0.008, stagger: 0.002 }, at + 0.008);
    fromTo(sel("label"), { opacity: 0 }, { opacity: 1, duration: 0.008 }, at + 0.011);
  }

  // 8 · flow (0.78–0.90): packets appear (the time loop moves them and runs the heartbeat).
  fromTo('[data-bs="flow"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, 0.782);

  // 9 · statement (0.88–0.96): the flow continues, slightly dimmed (text goes in the bottom zone).
  to('[data-bs="runtime"]', { opacity: 0.55, duration: 0.02 }, 0.88);
  to('[data-bs="flow"]', { opacity: 0.7, duration: 0.02 }, 0.88);

  // 10 · handoff (0.95–1): everything recedes; VOICE OUT's wave (an identical copy) stretches to lane y.
  fromTo('[data-bs="handoff"]', { opacity: 0 }, { opacity: 0.55, duration: 0.004 }, 0.95);
  to('[data-bs="runtime"]', { opacity: 0, duration: 0.012 }, 0.951);
  to('[data-bs="flow"]', { opacity: 0, duration: 0.008 }, 0.95);
  fromTo('[data-bs="handoff"]', { "--hk": 0 }, { "--hk": 1, duration: 0.04, ease }, 0.952);
  to('[data-bs="handoff"]', { opacity: 0.9, duration: 0.02 }, 0.956);
}
