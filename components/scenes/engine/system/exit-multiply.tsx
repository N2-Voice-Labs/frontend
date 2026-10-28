import { range } from "@/lib/cinematic/visual";
import { BEATS } from "../beats";
import type { Geo } from "./geometry";
import { C, GLOW, n2, one, s, setA, speech, type Bind, type Tw } from "./shared";

/**
 * EXIT → MULTIPLY (screen space, over the receding world): the outgoing signal grows from the screen
 * centre (where the camera has put VOICE OUT) as the runtime falls behind it; then it multiplies
 * 1 → 2 → 10 → ~100 very thin lines radiating from the centre past the edges — chapter 06's core and spokes.
 */

const [X0, X1] = BEATS.exit;
const [M0] = BEATS.multiply;
const STEPS = [
  { at: M0, dur: 0.012 },
  { at: M0 + 0.01, dur: 0.012 },
  { at: M0 + 0.021, dur: 0.014 },
  { at: M0 + 0.033, dur: 0.022 },
] as const;
const MANY = 90;
const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Ray angles per step: 1 (outgoing direction), its opposite, 8 around, then ~90 scattered. */
function rays() {
  const few = Array.from({ length: 8 }, (_, k) => ((22.5 + 45 * k + (rnd(k, 1) - 0.5) * 18) * Math.PI) / 180);
  const many = Array.from({ length: MANY }, (_, k) => ({ a: k * 2.39996 + rnd(k, 2) * 0.3, l: 0.78 + 0.22 * rnd(k, 3), c: k % 3 }));
  return { few, many };
}
/** Shared with chapter 06, which opens on exactly these rays. */
export const RAYS = rays();
const PKT = [0, Math.PI, ...RAYS.few.slice(0, 6)];

export function ExitMultiply({ G }: { G: Geo }) {
  const cx = G.w / 2, cy = G.h / 2;
  const L = Math.hypot(G.w, G.h) * 0.62;
  const ray = (a: number, l = 1) => `M${n2(cx)} ${n2(cy)}L${n2(cx + Math.cos(a) * L * l)} ${n2(cy + Math.sin(a) * L * l)}`;
  const manyD = [0, 1, 2].map((c) => RAYS.many.filter((r) => r.c === c).map((r) => ray(r.a, r.l)).join(""));
  return (
    <g data-es="out" className={s.filmOnly} opacity={0}>
      <g data-es-ex="wave" className={s.grow}>
        <path data-es-live="ex-wave" className={s.stroke} d={`M${n2(cx)} ${n2(cy)}L${G.w} ${n2(cy)}`} stroke={C.en} strokeWidth={1.5} />
      </g>
      <g data-es-ex="m4" className={s.ray}>
        {manyD.map((d, i) => <path key={i} className={s.stroke} d={d} stroke={[C.ko, C.en, C.gold][i]} strokeOpacity={0.32} strokeWidth={0.7} />)}
      </g>
      <g data-es-ex="m3" className={s.ray}>
        {RAYS.few.map((a, k) => <path key={k} className={s.stroke} d={ray(a)} stroke={[C.ko, C.en, C.gold][k % 3]} strokeOpacity={0.55} strokeWidth={0.9} />)}
      </g>
      <g data-es-ex="m2" className={s.ray}>
        <path className={s.stroke} d={ray(Math.PI)} stroke={C.ko} strokeOpacity={0.8} strokeWidth={1.1} />
      </g>
      <g data-es-ex="m1" className={s.ray}>
        <path className={s.stroke} d={ray(0)} stroke={C.en} strokeOpacity={0.85} strokeWidth={1.1} />
      </g>
      <path data-es-live="ex-pk" className={s.dots} d="M-9999 -9999h0.01" stroke={C.gold} strokeWidth={2.6} />
      <circle data-es-ex="core" cx={cx} cy={cy} r={3.2} fill={C.gold} filter={GLOW} opacity={0} />
    </g>
  );
}

export const bindExitMultiply: Bind = (svg, G) => {
  const wave = one(svg, "ex-wave"), pk = one(svg, "ex-pk");
  const cx = G.w / 2, cy = G.h / 2, len = G.w / 2 + 24;
  const L = Math.hypot(G.w, G.h) * 0.62;

  return (p, t) => {
    if (p < X0 - 0.01) return;
    if (p < 0.99) {
      // the outgoing voice: born at the centre, stretching to the edge (the scroll tween scales it up).
      let d = "";
      for (let i = 0; i <= 120; i++) {
        const x = i / 120, env = range(x, 0, 0.18);
        d += (i ? "L" : "M") + n2(cx + x * len) + " " + n2(cy + 10 * env * speech(0.08 + x * 0.84, t, 9, 2.1));
      }
      setA(wave, "d", d);
    }
    if (pk) {
      let d = "";
      if (p > M0) {
        PKT.forEach((a, k) => {
          const step = k < 2 ? k : 2;
          const m = range(p, STEPS[step].at, STEPS[step].at + STEPS[step].dur);
          if (m < 0.5) return;
          const f = (t * (0.18 + 0.03 * (k % 3)) + rnd(k, 9)) % 1;
          const r = L * m * f;
          d += `M${n2(cx + Math.cos(a) * r)} ${n2(cy + Math.sin(a) * r)}h0.01`;
        });
      }
      setA(pk, "d", d || "M-9999 -9999h0.01");
    }
  };
};

export function exitMultiplyTimeline(T: Tw) {
  T.fromTo('[data-es="out"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, X0 - 0.004);
  T.fromTo('[data-es-ex="wave"]', { "--g": 0 }, { "--g": 1, duration: X1 - X0, ease: "power2.in" }, X0);
  T.fromTo('[data-es-ex="core"]', { opacity: 0 }, { opacity: 1, duration: 0.01 }, M0 - 0.006);
  STEPS.forEach((st, i) => T.fromTo(`[data-es-ex="m${i + 1}"]`, { "--m": 0 }, { "--m": 1, duration: st.dur, ease: "power2.out" }, st.at));
  T.to('[data-es-ex="wave"]', { opacity: 0, duration: 0.02 }, M0 + 0.014);
}
