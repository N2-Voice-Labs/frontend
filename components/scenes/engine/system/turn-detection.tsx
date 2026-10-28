import { range } from "@/lib/cinematic/visual";
import { BEATS } from "../beats";
import { U, type Geo } from "./geometry";
import { C, Label, n2, one, op, s, setA, speech, type Bind, type Tw } from "./shared";

/**
 * VAD · TURN DETECTION — a scan line walks the voice: speech segments brighten and their packets hurry,
 * the silence goes quiet and its packets wait; at the end of the second phrase a tick marks the turn.
 * Afterwards the scan keeps looping slowly, so the stage stays alive in the pulled-back runtime.
 */

const SEG = [
  { a: 0, b: 0.36, speech: true, name: "SPEECH" },
  { a: 0.36, b: 0.6, speech: false, name: "SILENCE" },
  { a: 0.6, b: 0.86, speech: true, name: "SPEECH" },
  { a: 0.86, b: 1, speech: false, name: "" },
] as const;
const TURN = 0.9;
const N = 110;
const PK = 5;
const [V0, V1] = BEATS.vad;
const uAt = (x: number) => U.vadA + (U.vadB - U.vadA) * x;

const env = (x: number) => {
  for (const g of SEG) if (x >= g.a && x <= g.b) return g.speech ? Math.pow(Math.sin((Math.PI * (x - g.a)) / (g.b - g.a)), 0.6) : 0.05;
  return 0;
};
const isSpeech = (x: number) => SEG.some((g) => g.speech && x >= g.a && x <= g.b);

/** Packets: a speech stretch takes 1 unit of time per unit of length, silence 3.5 (they wait). */
const LUT = (() => {
  const n = 64, cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + (isSpeech((i - 0.5) / n) ? 1 : 3.5));
  return cum.map((c) => c / cum[n]);
})();
function warp(phi: number) {
  let i = 1;
  while (i < LUT.length - 1 && LUT[i] < phi) i++;
  const a = LUT[i - 1], b = LUT[i];
  return (i - 1 + (phi - a) / (b - a || 1)) / (LUT.length - 1);
}

const sides = (G: Geo) => ({
  above: G.portrait ? { dx: 16, dy: 0, anchor: "start" as const } : { dx: 0, dy: -16, anchor: "middle" as const },
  below: G.portrait ? { dx: -16, dy: 0, anchor: "end" as const } : { dx: 0, dy: 16, anchor: "middle" as const },
});

export function TurnDetection({ G }: { G: Geo }) {
  const A = 24 / G.Z.vad;
  const br = 15 / G.Z.vad;
  const { above, below } = sides(G);
  const base = G.along(U.vadA, U.vadB, N, (x) => A * env(x) * speech(x, 0, 7, 1.1));
  const turn = G.pt(uAt(TURN));
  const scanD = G.portrait ? "M-30 0H30" : "M0 -30V30";
  const tickD = G.portrait ? "M-11 0H11" : "M0 -11V11";
  return (
    <g data-es-part="vad">
      <path data-es-live="vad-base" className={s.stroke} d={base} stroke={C.ko} strokeOpacity={0.3} strokeWidth={1.1} />
      <path data-es-live="vad-lit" className={s.stroke} d={base} stroke={C.ko} strokeWidth={1.4} />
      {SEG.filter((g) => g.name).map((g, i) => (
        <g key={i}>
          <path
            data-es-vad="bracket"
            className={s.stroke}
            d={G.along(uAt(g.a + 0.015), uAt(g.b - 0.015), 16, () => br)}
            stroke={g.speech ? C.ko : C.ink}
            strokeOpacity={g.speech ? 0.55 : 0.22}
            strokeWidth={1}
            pathLength={1}
            strokeDasharray="1 1"
          />
          <Label at={G.pt(uAt((g.a + g.b) / 2), br)} {...below} cls="tiny" g={{ "data-es-vad": "seg" }}>{g.name}</Label>
        </g>
      ))}
      <path data-es-live="vad-pk" className={s.dots} d="M-9999 -9999h0.01" stroke={C.ko} strokeWidth={2.6} />
      <g data-es-live="vad-scan" transform={`translate(${n2(G.pt(U.vadA).x)} ${n2(G.pt(U.vadA).y)})`}>
        <g className={s.cs}><path className={s.stroke} d={scanD} stroke={C.gold} strokeOpacity={0.75} strokeWidth={1} /></g>
      </g>
      <g data-es-live="vad-turn" transform={`translate(${n2(turn.x)} ${n2(turn.y)})`} opacity={0.4}>
        <g className={s.cs}>
          <path className={s.stroke} d={tickD} stroke={C.gold} strokeWidth={1.4} />
          <circle data-es-live="vad-ring" className={s.stroke} r={4} stroke={C.gold} strokeWidth={1} opacity={0} />
          <text className={s.tiny} x={above.dx} y={above.dy - (G.portrait ? 0 : 6)} textAnchor={above.anchor} dominantBaseline="middle">TURN END</text>
        </g>
      </g>
      <Label at={G.pt(U.vad)} dx={G.portrait ? 30 : 0} dy={G.portrait ? 0 : -52} anchor={G.portrait ? "start" : "middle"} g={{ "data-es-vad": "label" }}>
        VAD · TURN DETECTION
      </Label>
    </g>
  );
}

export const bindTurnDetection: Bind = (svg, G) => {
  const baseEl = one(svg, "vad-base"), lit = one(svg, "vad-lit"), pk = one(svg, "vad-pk");
  const scan = one(svg, "vad-scan"), turn = one(svg, "vad-turn"), ring = one(svg, "vad-ring");
  const at = Array.from({ length: N + 1 }, (_, i) => G.at(uAt(i / N)));
  const A = 24 / G.Z.vad;

  return (p, t) => {
    if (p < V0 - 0.04 || (p > V1 + 0.04 && p < 0.68)) return;
    const k = range(p, 0.7, 0.78);
    const amp = A * (1 - k) + 6 * k;
    const val = (x: number) => amp * env(x) * speech(x, t, 7, 1.1);

    // scan position: walks the region during the beat, then loops slowly.
    const sc = p < V1 ? Math.max(0, Math.min(1, (p - (V0 + 0.008)) / 0.09)) : (t / 7) % 1;

    let dBase = "", dLit = "", pen = false;
    for (let i = 0; i <= N; i++) {
      const x = i / N, q = at[i], v = val(x);
      const xy = n2(q.x + q.nx * v) + " " + n2(q.y + q.ny * v);
      dBase += (i ? "L" : "M") + xy;
      const on = x <= sc && isSpeech(x);
      dLit += on ? (pen ? "L" : "M") + xy : "";
      pen = on;
    }
    setA(baseEl, "d", dBase);
    setA(lit, "d", dLit || "M-9999 -9999h0.01");

    const sp = G.pt(uAt(sc));
    setA(scan, "transform", `translate(${n2(sp.x)} ${n2(sp.y)})`);
    op(scan, p < V1 ? (sc > 0 && sc < 1 ? 1 : 0) : 0.45);

    // packets hurry through speech and wait in silence.
    if (pk) {
      let d = "";
      for (let i = 0; i < PK; i++) {
        const x = warp(((t / 6 + i / PK) % 1 + 1) % 1), q = G.at(uAt(x)), v = val(x) * 0.5;
        d += `M${n2(q.x + q.nx * v)} ${n2(q.y + q.ny * v)}h0.01`;
      }
      setA(pk, "d", d);
    }

    // turn end: a tick that flashes as the scan passes it, with a ring opening out.
    const dt = sc - TURN;
    if (dt >= 0) {
      op(turn, 0.45 + 0.55 * Math.exp(-dt * 30));
      setA(ring, "r", (4 + 16 * (1 - Math.exp(-dt * 18))).toFixed(2));
      op(ring, Math.exp(-dt * 14) * 0.9);
    } else {
      op(turn, p < V1 ? 0.18 : 0.45);
      op(ring, 0);
    }
  };
};

export function turnDetectionTimeline(T: Tw) {
  T.fromTo('[data-es-part="vad"]', { opacity: 0 }, { opacity: 1, duration: 0.02 }, V0 - 0.008);
  T.fromTo('[data-es-vad="label"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, V0 + 0.004);
  T.fromTo('[data-es-vad="bracket"]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.025, stagger: 0.03 }, V0 + 0.012);
  T.fromTo('[data-es-vad="seg"]', { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: 0.03 }, V0 + 0.02);
  T.to('[data-es-vad="label"]', { opacity: 0, duration: 0.015 }, V1 + 0.005);
  T.to('[data-es-vad="seg"]', { opacity: 0, duration: 0.015 }, V1 + 0.005);
  T.to('[data-es-part="vad"]', { opacity: 0.4, duration: 0.02 }, V1 + 0.005);
  T.to('[data-es-part="vad"]', { opacity: 0.8, duration: 0.03 }, 0.72);
}
