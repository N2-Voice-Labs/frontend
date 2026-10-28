import { BEATS } from "../beats";
import { CONNECTIONS, NODES, arcPoints, nodeAppear, place, pulseAt, quadAt, type Connection, type GlobeFrame } from "./globe";
import { C, GLOW, Label, SEOUL, TALK, TORONTO, all, dotsD, lerp, n2, one, op, range, s, setA, type Bind, type Tw } from "./shared";
import fs from "./future-system.module.css";

/**
 * The few important connections in the foreground (the canvas draws the thousands of distant points from
 * the same globe.ts model; these arcs sit exactly where arcPoints() puts them).
 *
 * - Seoul ↔ Toronto first (chapter 07's conversation), then a handful of others as their nodes appear
 *   (nodeAppear), each a thin arc with one pulse travelling it: pulse → response (pulseAt). Arcs behind the
 *   globe dim strongly. Restrained: warm white arcs, the conversation in cyan / magenta, one faint gold.
 * - They step back through `far`, and go very quiet under the statements (`world`, `hear`).
 * - focus: only Seoul ↔ Toronto stays and brightens; one signal travels down it to Seoul as the camera goes
 *   in, and arrives as Seoul reaches the screen centre (voice.tsx takes over from there).
 */

/** Foreground connections (besides the conversation), by connection index; phones keep the first four. */
const OTHERS_L = [1, 8, 2, 18, 9, 13, 5, 15, 11];
const OTHERS_P = OTHERS_L.slice(0, 4);
/** The one connection with the faintest gold (NY ↔ Paris): a hint, never a theme. */
const GOLD = 18;

export const foreground = (portrait: boolean): Connection[] =>
  (portrait ? OTHERS_P : OTHERS_L).map((k) => CONNECTIONS[k]).filter((c) => c && c.k !== TALK.k);

const arcD = (A: { x: number; y: number }, K: { x: number; y: number }, B: { x: number; y: number }) =>
  `M${n2(A.x)} ${n2(A.y)}Q${n2(K.x)} ${n2(K.y)} ${n2(B.x)} ${n2(B.y)}`;
const OFF = "M-9999 -9999h0";

/** Behind the globe: strongly dimmed (front is min z of the two ends, 1 in front, -1 behind). */
const depth = (front: number, floor: number) => lerp(floor, 1, range(front, -0.3, 0.12));
/** Present once both of its people are. */
const appearAt = (c: Connection, p: number) => Math.min(nodeAppear(NODES[c.a], p), nodeAppear(NODES[c.b], p));
const pulseColour = (c: Connection, from: number) => (from === SEOUL.i ? C.ko : from === TORONTO.i ? C.en : c.k === GOLD ? C.gold : C.ink);

export function Connections({ portrait }: { portrait: boolean }) {
  const others = foreground(portrait);
  return (
    <>
      <g data-fs="net">
        {others.map((c) => (
          <g key={c.k}>
            <path data-fs-live="arc" className={s.stroke} d={OFF} pathLength={1} strokeDasharray="1 1"
              stroke={c.k === GOLD ? C.gold : C.ink} strokeOpacity={c.k === GOLD ? 0.2 : 0.24} strokeWidth={0.75} />
            <circle data-fs-live="pk" r={1.7} cx={-9999} cy={-9999} fill={C.ink} filter={GLOW} opacity={0} />
          </g>
        ))}
      </g>

      <g data-fs="talk">
        <path data-fs-live="talk-arc" className={s.stroke} d={OFF} pathLength={1} strokeDasharray="1 1" stroke={C.ink} strokeOpacity={0.38} strokeWidth={0.85} />
        {/* The focus: the same arc, brighter, in the conversation's colours (scroll fades it in). */}
        <path data-fs="talk-hot" data-fs-live="talk-hot" className={`${s.stroke} ${s.filmOnly}`} d={OFF} stroke="url(#fs-talk)" strokeWidth={1.3} opacity={0} />
        <circle data-fs-live="talk-pk" r={2} cx={-9999} cy={-9999} fill={C.ko} filter={GLOW} opacity={0} />
        <circle data-fs-live="talk-a" r={2.2} cx={-9999} cy={-9999} fill={C.ko} filter={GLOW} />
        <circle data-fs-live="talk-b" r={2} cx={-9999} cy={-9999} fill={C.en} filter={GLOW} />
        {/* Plain document: the conversation named, so the still reads on its own. */}
        <g className={fs.stillOnly}>
          <Label at={{ x: 0, y: 0 }} cls="tiny" anchor="start" dx={8} g={{ "data-fs-live": "talk-a-label" }} text={{ style: { fill: C.ko } }}>KO · SEOUL</Label>
          <Label at={{ x: 0, y: 0 }} cls="tiny" anchor="start" dx={8} g={{ "data-fs-live": "talk-b-label" }} text={{ style: { fill: C.en } }}>EN · TORONTO</Label>
        </g>
      </g>
    </>
  );
}

/** The gradient of the brightened conversation, in screen px along Seoul → Toronto (set per frame). */
export function TalkGradient() {
  return (
    <linearGradient id="fs-talk" data-fs-live="talk-grad" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={1} y2={0}>
      <stop offset="0" stopColor={C.ko} stopOpacity={0.95} />
      <stop offset="0.55" stopColor={C.ink} stopOpacity={0.55} />
      <stop offset="1" stopColor={C.en} stopOpacity={0.8} />
    </linearGradient>
  );
}

export const bindConnections: Bind = (svg, portrait) => {
  const others = foreground(portrait);
  const arcs = all(svg, "arc"), pks = all(svg, "pk");
  const tArc = one(svg, "talk-arc"), hot = one(svg, "talk-hot"), tPk = one(svg, "talk-pk");
  const tA = one(svg, "talk-a"), tB = one(svg, "talk-b"), grad = one(svg, "talk-grad");
  const tAL = one(svg, "talk-a-label"), tBL = one(svg, "talk-b-label");
  const [f0, f1] = BEATS.focus;
  let parked = false;

  const pulse = (c: Connection, F: GlobeFrame, t: number, el: SVGElement | undefined | null, vis: number, A: { x: number; y: number }, K: { x: number; y: number }, B: { x: number; y: number }) => {
    const pa = pulseAt(c, t);
    if (!pa || vis <= 0.01) { op(el, 0); return; }
    const u = pa.from === c.a ? pa.s : 1 - pa.s;
    const q = quadAt(A, K, B, u);
    setA(el, "cx", n2(q.x)); setA(el, "cy", n2(q.y));
    setA(el, "fill", pulseColour(c, pa.from));
    // Leaves softly, arrives softly.
    op(el, vis * Math.sin(Math.PI * pa.s) ** 0.6 * (F.portrait ? 0.85 : 0.9));
  };

  return (p, t, F) => {
    // After the focus there is nothing left to draw: park everything once.
    if (p > f1 + 0.012) {
      if (!parked) { for (const el of [...arcs, tArc, hot]) setA(el, "d", OFF); for (const el of [...pks, tPk]) op(el, 0); parked = true; }
      return;
    }
    parked = false;

    others.forEach((c, i) => {
      const { A, B, K, front } = arcPoints(c, F);
      const app = appearAt(c, p);
      const vis = app * depth(front, 0.1);
      setA(arcs[i], "d", arcD(A, K, B));
      // Drawn from one end to the other as the second person appears.
      setA(arcs[i], "stroke-dashoffset", (1 - app).toFixed(3));
      op(arcs[i], vis);
      pulse(c, F, t, pks[i], vis * range(app, 0.6, 1), A, K, B);
    });

    // The conversation: always a little more present than the rest, and never lost behind the globe.
    const { A, B, K, front } = arcPoints(TALK, F);
    const app = appearAt(TALK, p);
    const go = range(p, f0 - 0.02, f0 + 0.01);
    const vis = app * lerp(depth(front, 0.3), 1, go);
    const d = arcD(A, K, B);
    setA(tArc, "d", d);
    setA(tArc, "stroke-dashoffset", (1 - app).toFixed(3));
    op(tArc, vis);
    setA(tA, "cx", n2(A.x)); setA(tA, "cy", n2(A.y));
    setA(tB, "cx", n2(B.x)); setA(tB, "cy", n2(B.y));
    op(tA, app * lerp(depth(A.z, 0.25), 1, go));
    op(tB, app * depth(B.z, 0.25) * (1 - range(p, f0 + 0.02, f0 + 0.05)));
    setA(tAL, "transform", `translate(${n2(A.x)} ${n2(A.y)})`);
    setA(tBL, "transform", `translate(${n2(B.x)} ${n2(B.y)})`);

    if (p < f0 - 0.005) {
      pulse(TALK, F, t, tPk, vis * range(app, 0.6, 1), A, K, B);
    } else {
      // Down the signal: one response leaves Toronto and reaches Seoul as Seoul reaches the screen centre.
      setA(hot, "d", d);
      setA(grad, "x1", n2(A.x)); setA(grad, "y1", n2(A.y));
      setA(grad, "x2", n2(B.x)); setA(grad, "y2", n2(B.y));
      const u = range(p, f0 + 0.004, f1 - 0.006);
      const q = quadAt(A, K, B, 1 - u);
      setA(tPk, "cx", n2(q.x)); setA(tPk, "cy", n2(q.y));
      setA(tPk, "fill", C.ink);
      op(tPk, range(p, f0 - 0.004, f0 + 0.006) * (1 - range(u, 0.92, 1)));
    }
  };
};

/** Plain document only: the globe's people as faint dots, front side only, at the still frame. */
export function StillNodes({ F }: { F: GlobeFrame | null }) {
  if (!F) return null;
  const xs: number[] = [], ys: number[] = [];
  const o = { x: 0, y: 0, z: 1 };
  for (const n of NODES) {
    const q = place(n.lat, n.lon, F, o);
    if (q.z > 0.05) { xs.push(q.x); ys.push(q.y); }
  }
  return (
    <g className={fs.stillOnly}>
      <circle className={s.stroke} cx={F.cx} cy={F.cy} r={F.R} stroke={C.ink} strokeOpacity={0.07} strokeWidth={0.8} />
      <path className={s.dots} d={dotsD(xs, ys, xs.length)} stroke={C.ink} strokeOpacity={0.32} strokeWidth={1.6} />
    </g>
  );
}

export function connectionsTimeline(T: Tw) {
  // The world pulls far back: the foreground steps back with it, leaving the darkness enormous.
  const [a0, a1] = BEATS.far;
  T.fromTo('[data-fs="net"], [data-fs="talk"]', { opacity: 1 }, { opacity: 0.45, duration: a1 - a0 - 0.04, ease: "power1.inOut" }, a0 + 0.01);
  // Under the statements: very quiet.
  T.to('[data-fs="net"], [data-fs="talk"]', { opacity: 0.16, duration: 0.025 }, BEATS.world[0] - 0.005);
  // Focus: the rest vanish; the conversation brightens, then hands over to the single voice.
  const [f0, f1] = BEATS.focus;
  T.to('[data-fs="net"]', { opacity: 0, duration: 0.02 }, f0 - 0.012);
  T.to('[data-fs="talk"]', { opacity: 1, duration: 0.02 }, f0 - 0.01);
  T.fromTo('[data-fs="talk-hot"]', { opacity: 0 }, { opacity: 0.9, duration: 0.025, ease: "power1.out" }, f0);
  T.to('[data-fs="talk"]', { opacity: 0, duration: 0.018, ease: "power1.in" }, f1 - 0.016);
}
