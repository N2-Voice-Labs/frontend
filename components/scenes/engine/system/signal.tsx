import type { CSSProperties } from "react";
import { range, window01 } from "@/lib/cinematic/visual";
import { BEATS } from "../beats";
import { U, type Geo } from "./geometry";
import { C, Label, all, n2, one, op, s, setA, speech, type Bind, type Tw } from "./shared";

/**
 * VOICE IN — chapter 04's four layers arrive as one wave at h/2 (screen space), which is the same wave
 * as the world's VOICE IN span seen at the opening zoom; then the camera dives into it: the oscillation
 * opens up, harmonic traces and sample points appear, and VOICE IN · STREAM · REAL TIME flicker.
 */

const LAYERS = [
  { name: "VAD", c: C.ink },
  { name: "STT", c: C.ko },
  { name: "AGENT", c: C.gold },
  { name: "TTS", c: C.en },
] as const;
const FLICKER = ["VOICE IN", "STREAM", "REAL TIME"] as const;
const PERIODS = 9;
const N = 140;
const NPTS = 96;
const [, E1] = BEATS.enter;
const [D0, D1] = BEATS.dive;

/** Screen-space opening, drawn before (under) the camera group. */
export function SignalOpen({ G }: { G: Geo }) {
  const ly = G.portrait ? [-21, -7, 7, 21] : [-30, -10, 10, 30];
  const flat = `M0 0L${G.w} 0`;
  return (
    <g data-es="open" className={s.filmOnly} transform={`translate(0 ${n2(G.h / 2)})`}>
      <path data-es-live="open" data-es-open="base" className={s.stroke} d={flat} stroke={C.ko} strokeWidth={1.3} />
      {LAYERS.map((l, i) => (
        <g key={l.name} data-es-open="layer" className={s.layer} style={{ "--ly": `${ly[i]}px` } as CSSProperties}>
          <path data-es-live="open" className={s.stroke} d={flat} stroke={l.c} strokeOpacity={0.7} strokeWidth={1} />
          <text data-es-open="label" className={s.tiny} x={G.w * 0.04} y={-5}>{l.name}</text>
        </g>
      ))}
    </g>
  );
}

const flickLabel = (G: Geo, i: number) => {
  const u = U.vin + [-0.004, 0.012, 0.027][i];
  const dy = [-64, 70, -92][i];
  return { at: G.pt(u), dy };
};

/** World-space voice: the VOICE IN wave (alive for the whole chapter) and the dive's detail. */
export function SignalWorld({ G }: { G: Geo }) {
  const amp = 26 / G.Z.wave;
  const wave = G.along(U.vinA, U.vinB, N, (x) => amp * speech(x, 0, PERIODS, 0.3));
  return (
    <g data-es-part="signal">
      <path data-es-live="sig-wave" className={s.stroke} d={wave} stroke={C.ko} strokeWidth={1.3} />
      <g data-es-sig="dive" className={s.filmOnly}>
        {[0.45, 0.3, 0.22].map((o, i) => (
          <path key={i} data-es-live="sig-trace" className={s.stroke} d={wave} stroke={i === 1 ? C.ink : C.ko} strokeOpacity={o} strokeWidth={1} />
        ))}
        <path data-es-live="sig-pts" className={s.dots} d="M-9999 -9999h0.01" stroke={C.ko} strokeWidth={2.4} />
      </g>
      <g className={s.filmOnly}>
        {FLICKER.map((t, i) => {
          const l = flickLabel(G, i);
          return <Label key={t} at={l.at} dy={l.dy} g={{ "data-es-live": "sig-lab", opacity: 0 }}>{t}</Label>;
        })}
      </g>
    </g>
  );
}

const noise = (k: number) => {
  const v = Math.sin(k * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const bindSignal: Bind = (svg, G) => {
  const open = all(svg, "open");
  const wave = one(svg, "sig-wave");
  const traces = all(svg, "sig-trace");
  const pts = one(svg, "sig-pts");
  const labs = all(svg, "sig-lab");
  const at = Array.from({ length: N + 1 }, (_, i) => G.at(U.vinA + ((U.vinB - U.vinA) * i) / N));

  const path = (amp: (x: number) => number) => {
    let d = "";
    for (let i = 0; i <= N; i++) {
      const q = at[i], v = amp(i / N);
      d += (i ? "L" : "M") + n2(q.x + q.nx * v) + " " + n2(q.y + q.ny * v);
    }
    return d;
  };

  return (p, t) => {
    // opening: chapter 04's layers, still breathing, converge into one line (the scroll tween owns --sp).
    if (p < E1 + 0.01 && open.length) {
      const a = 5 * (1 - 0.4 * range(p, 0, E1));
      let d = "";
      for (let i = 0; i <= 160; i++) {
        const x = i / 160;
        d += (i ? "L" : "M") + n2(x * G.w) + " " + n2(a * speech(x, t, PERIODS, 0.3));
      }
      open.forEach((el) => setA(el, "d", d));
    }

    // VOICE IN wave: grows as the voice arrives; flatter (world) once the camera is far away.
    const near = p < 0.17 || p > 0.66;
    if (!near) return;
    const screenAmp = 5 + 21 * range(p, 0, E1);
    const amp = (screenAmp / G.Z.wave) * (1 - range(p, 0.7, 0.78)) + 7 * range(p, 0.7, 0.78);
    setA(wave, "d", path((x) => amp * speech(x, t, PERIODS, 0.3)));

    // dive: harmonics and samples appear inside the oscillation.
    if (p > D0 - 0.01 && p < D1 + 0.02) {
      const k = window01(p, D0 + 0.01, D1 - 0.01, 0.02);
      traces.forEach((el, i) => {
        const f = [2, 3, 5][i], a = amp * [0.55, 0.32, 0.18][i] * (0.4 + 0.6 * k);
        setA(el, "d", path((x) => a * speech(x, t * (1 + i * 0.15), PERIODS * f, 0.3 + i * 1.7) + amp * 0.08 * (i - 1) * Math.sin(Math.PI * x)));
      });
      if (pts) {
        let d = "";
        for (let i = 0; i < NPTS; i++) {
          const x = (i + 0.5) / NPTS, q = G.at(U.vinA + (U.vinB - U.vinA) * x), v = amp * speech(x, t, PERIODS, 0.3);
          d += `M${n2(q.x + q.nx * v)} ${n2(q.y + q.ny * v)}h0.01`;
        }
        setA(pts, "d", d);
      }
      labs.forEach((el, i) => {
        const w = window01(p, D0 + 0.012 + i * 0.012, D1 - 0.008, 0.008);
        const f = noise(Math.floor(t * 9 + i * 3.1)) > 0.32 ? 1 : 0.2;
        op(el, w * f);
      });
    } else labs.forEach((el) => op(el, 0));
  };
};

export function signalTimeline(T: Tw) {
  // opening: the four layers collapse into one cyan wave, then the screen copy gives way to the world wave.
  T.fromTo('[data-es-open="layer"]', { "--sp": 1 }, { "--sp": 0, duration: 0.035, ease: "power2.inOut" }, 0);
  T.fromTo('[data-es-open="label"]', { opacity: 1 }, { opacity: 0, duration: 0.014 }, 0.004);
  T.fromTo('[data-es="open"]', { opacity: 1 }, { opacity: 0, duration: 0.02 }, 0.03);
  T.fromTo('[data-es-part="signal"]', { opacity: 0 }, { opacity: 1, duration: 0.025 }, 0.012);
  // dive detail.
  T.fromTo('[data-es-sig="dive"]', { opacity: 0 }, { opacity: 1, duration: 0.025 }, D0 + 0.005);
  T.to('[data-es-sig="dive"]', { opacity: 0, duration: 0.02 }, D1 - 0.01);
  // afterwards: quiet; brighter again when the runtime is seen whole.
  T.to('[data-es-part="signal"]', { opacity: 0.5, duration: 0.02 }, 0.14);
  T.to('[data-es-part="signal"]', { opacity: 0.9, duration: 0.03 }, 0.72);
}
