import type { ReactNode } from "react";
import { BEATS, WORLDS } from "../beats";
import { activity, n2, turnIn, type Geo, type P2, type WorldGeo } from "./geometry";
import { C, Dot, Label, frac, langColour, one, op, s, setA, speech, type Bind, type Tw } from "./shared";

/**
 * The worlds: small fragments of the same cinematic space, not cards. Each is a waveform with its own
 * conversational rhythm, a hint of its environment (abstract: a handset's arcs, two voices exchanging, a
 * calendar row with one slot confirmed, a route with stops, a table and its seats, a calm slow ring, a
 * stack of simultaneous calls), its name and verbs, and later its agent's own configuration as metadata.
 * In the global beat each one shrinks to a point.
 */

/** Phones show metadata for a curated few, so the narrow screen never fills with it. */
const PORTRAIT_META = new Set(["support", "booking"]);
const LH = 13;
const WAVE_N = 44;

function waveD(p: P2, sz: number, amp: number, t: number, seed: number, len = 1.6, dy = 0) {
  let d = "";
  for (let k = 0; k <= WAVE_N; k++) {
    const x = k / WAVE_N;
    d += (k ? "L" : "M") + n2(p.x + (x * 2 - 1) * len * sz) + " " + n2(p.y + dy + amp * speech(x, t, 4 + (seed % 3), seed));
  }
  return d;
}

const ROUTE = [[-1.8, -0.62], [-0.9, -1.02], [0.1, -0.8], [1.0, -1.16], [1.8, -0.86]] as const;
const DENSE = [-0.62, -0.31, 0.31, 0.62] as const;

/** The environment, abstract and faint. */
function Motif({ wd, sz }: { wd: WorldGeo; sz: number }): ReactNode {
  const { p } = wd;
  const X = (k: number) => n2(p.x + k * sz), Y = (k: number) => n2(p.y + k * sz);
  const line = { className: s.stroke, stroke: C.ink, strokeOpacity: 0.26, strokeWidth: 1 };
  switch (wd.motif) {
    case "phone":
      return (
        <>
          <path {...line} d={`M${X(-1.95)} ${Y(-0.5)}Q${X(-2.35)} ${Y(0)} ${X(-1.95)} ${Y(0.5)}M${X(-2.25)} ${Y(-0.75)}Q${X(-2.8)} ${Y(0)} ${X(-2.25)} ${Y(0.75)}`} />
          <path {...line} d={`M${X(1.95)} ${Y(-0.5)}Q${X(2.35)} ${Y(0)} ${X(1.95)} ${Y(0.5)}M${X(2.25)} ${Y(-0.75)}Q${X(2.8)} ${Y(0)} ${X(2.25)} ${Y(0.75)}`} />
        </>
      );
    case "exchange":
      return <path data-ws-live="wave-b" className={s.stroke} d="" stroke={C.en} strokeOpacity={0.7} strokeWidth={1} />;
    case "calendar": {
      let d = "";
      for (let r = 0; r < 2; r++) for (let k = 0; k < 7; k++) d += `M${X(-1.2 + k * 0.4)} ${Y(-1.12 + r * 0.26)}v${n2(sz * 0.12)}`;
      return (
        <>
          <path {...line} d={d} />
          <g data-ws-live="lit" opacity={0.3}>
            <Dot at={{ x: p.x + (-1.2 + 4 * 0.4) * sz, y: p.y + (-1.12 + 0.26 + 0.06) * sz }} r={2.4} fill={C.gold} />
          </g>
        </>
      );
    }
    case "route":
      return (
        <>
          <path {...line} d={ROUTE.map(([x, y], k) => `${k ? "L" : "M"}${X(x)} ${Y(y)}`).join("")} />
          {ROUTE.map(([x, y], k) => <Dot key={k} at={{ x: p.x + x * sz, y: p.y + y * sz }} r={1.6} fill={C.ink} glow={false} />)}
          <Dot at={{ x: -9999, y: -9999 }} r={2.4} fill={C.ko} g={{ "data-ws-live": "route-pk" }} />
        </>
      );
    case "table":
      return (
        <>
          <path {...line} d={`M${X(-0.95)} ${Y(0.8)}H${X(0.95)}`} />
          <g data-ws-live="seats">
            {[-1.25, -0.42, 0.42, 1.25].map((x, k) => <Dot key={k} at={{ x: p.x + x * sz, y: p.y + 1.05 * sz }} r={1.7} fill={C.ink} glow={false} />)}
          </g>
        </>
      );
    case "calm":
      return <circle data-ws-live="calm" className={s.stroke} cx={p.x} cy={p.y} r={1.75 * sz} stroke={C.ink} strokeOpacity={0.1} strokeWidth={1} />;
    case "dense":
      return (
        <>
          {DENSE.map((_, k) => <path key={k} data-ws-live="wave-x" className={s.stroke} d="" stroke={k % 2 ? C.en : C.ko} strokeOpacity={0.45} strokeWidth={0.8} />)}
        </>
      );
  }
}

export function ConversationWorlds({ G }: { G: Geo }) {
  return (
    <g data-ws="worlds">
      {G.worlds.map((wd) => {
        const { p, above } = wd;
        const at = { x: p.x, y: p.y + (above ? -1 : 1) * 0.95 * G.sz };
        const meta = !G.portrait || PORTRAIT_META.has(wd.id);
        // Below: name, verbs, then the metadata. Above: metadata on top, then name and verbs nearest the wave.
        const nameDy = above ? -10 - LH * 1.15 : 10, verbsDy = above ? -10 : 10 + LH * 1.15;
        const metaDy = (k: number) => (above ? -10 - LH * 2.5 - (wd.meta.length - 1 - k) * LH : 10 + LH * 2.5 + k * LH);
        return (
          <g key={wd.id} data-ws-world={wd.i}>
            <g data-ws-detail="">
              <Motif wd={wd} sz={G.sz} />
              <path data-ws-live="wave" className={s.stroke} d={waveD(p, G.sz, G.sz * 0.3, 1, wd.i)} stroke={langColour(wd.lang)} strokeWidth={1.3} />
            </g>
            <g data-ws-point="" opacity={0}>
              <Dot at={p} r={2.4} fill={C.gold} />
            </g>
            <g data-ws-names="">
              <Label at={at} dy={nameDy}>{wd.name}</Label>
              <Label at={at} dy={verbsDy} cls="tiny">{wd.verbs}</Label>
            </g>
            {meta && (
              <g data-ws-meta={wd.i}>
                {wd.meta.map((m, k) => (
                  <Label key={m} at={at} dy={metaDy(k)} cls="tiny" text={{ fill: k === 0 ? langColour(wd.lang) : C.ink, style: { fillOpacity: k === 0 ? 0.9 : 0.45 } }}>{m}</Label>
                ))}
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

export const bindConversationWorlds: Bind = (svg, G) => {
  const parts = G.worlds.map((wd) => {
    const root = svg.querySelector(`[data-ws-world="${wd.i}"]`);
    const q = (k: string) => root?.querySelector<SVGElement>(`[data-ws-live="${k}"]`) ?? null;
    return {
      wave: q("wave"), b: q("wave-b"), lit: q("lit"), route: q("route-pk"), seats: q("seats"), calm: q("calm"),
      x: Array.from(root?.querySelectorAll<SVGElement>('[data-ws-live="wave-x"]') ?? []),
    };
  });
  const { sz } = G;
  return (p, t, _cam, still) => {
    if (p < BEATS.worlds[0] - 0.02 || p > BEATS.select[1]) return;
    G.worlds.forEach((wd, i) => {
      const P = parts[i];
      const a = still ? 0.7 : activity(i, t);
      const inbound = still || turnIn(i, t);
      const tt = still ? 1 + i : t;
      // Sales is a dynamic exchange: caller and agent alternate on two waves.
      const main = wd.motif === "exchange" ? (inbound ? a : 0) : a;
      setA(P.wave, "d", waveD(wd.p, sz, sz * (0.03 + 0.5 * main), tt, wd.i));
      if (P.b) setA(P.b, "d", waveD(wd.p, sz, sz * (0.03 + 0.42 * (inbound ? 0 : a)), tt + 0.7, wd.i + 1, 1.3, -0.42 * sz));
      // Call centers: many calls at once, each its own rhythm.
      P.x.forEach((el, k) => {
        const ak = still ? 0.5 : activity((i + k + 1) % WORLDS.length, t + k * 0.9);
        setA(el, "d", waveD(wd.p, sz, sz * (0.02 + 0.18 * ak), tt + k, k + 2, 1.2, DENSE[k] * sz));
      });
      // Booking: a slot is confirmed as each turn ends.
      if (P.lit) op(P.lit, still ? 1 : 0.3 + 0.7 * Math.exp(-frac(t / wd.act.period + i * 0.37 - wd.act.duty) * 6));
      if (P.route) {
        const u = still ? 0.45 : frac(t * 0.08);
        const f = u * (ROUTE.length - 1), j = Math.min(ROUTE.length - 2, Math.floor(f)), e = f - j;
        const x = ROUTE[j][0] + (ROUTE[j + 1][0] - ROUTE[j][0]) * e, y = ROUTE[j][1] + (ROUTE[j + 1][1] - ROUTE[j][1]) * e;
        setA(P.route, "transform", `translate(${n2(wd.p.x + x * sz)} ${n2(wd.p.y + y * sz)})`);
      }
      if (P.seats) op(P.seats, 0.5 + 0.5 * a);
      if (P.calm) setA(P.calm, "r", n2(sz * (1.75 + 0.07 * Math.sin(t * 0.6))));
    });
  };
};

export function conversationWorldsTimeline(T: Tw) {
  const [w0, w1] = BEATS.worlds;
  const step = (w1 - w0) / WORLDS.length;
  WORLDS.forEach((_, i) => {
    const at = w0 + i * step;
    T.fromTo(`[data-ws-world="${i}"]`, { opacity: 0 }, { opacity: 1, duration: step * 1.2, ease: "power2.out" }, at);
    T.fromTo(`[data-ws-world="${i}"] [data-ws-names]`, { opacity: 0 }, { opacity: 1, duration: step, ease: "power1.out" }, at + step * 0.5);
  });
  // Each agent differs: its configuration attaches to it, one world after another.
  const [a0, a1] = BEATS.agents;
  const ms = (a1 - a0) / WORLDS.length;
  WORLDS.forEach((_, i) => T.fromTo(`[data-ws-meta="${i}"]`, { opacity: 0 }, { opacity: 1, duration: ms * 1.5 }, a0 + i * ms));

  // Under the statements: the words step back, the conversations keep moving.
  const [s0] = BEATS.statement, [u0, u1] = BEATS.underneath;
  T.to("[data-ws-meta]", { opacity: 0, duration: 0.03 }, s0 - 0.01);
  T.to("[data-ws-names]", { opacity: 0.22, duration: 0.03 }, s0 - 0.01);
  T.to("[data-ws-names]", { opacity: 0.4, duration: 0.04 }, u0 + 0.02);

  // Worlds become points.
  const [g0] = BEATS.global;
  T.to("[data-ws-names]", { opacity: 0, duration: 0.02 }, Math.max(u1 - 0.02, g0 - 0.02));
  T.to("[data-ws-detail]", { opacity: 0, duration: 0.04 }, g0);
  T.fromTo("[data-ws-point]", { opacity: 0 }, { opacity: 1, duration: 0.03 }, g0 + 0.01);
}
