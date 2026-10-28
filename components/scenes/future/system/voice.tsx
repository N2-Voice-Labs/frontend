import { syllables, waveY } from "@/lib/cinematic/visual";
import { BEATS } from "../beats";
import { C, lerp, n2, one, range, s, setA, type Bind, type Tw } from "./shared";

/**
 * The end of the signal (screen space): as the camera arrives at Seoul, ONE tiny horizontal waveform at
 * the screen centre, in cyan: the same visual language as chapter 01's first signal (waveY, syllables).
 * One voice, speaking. Then silence: it gets smaller, its amplitude goes to zero, it stops, and it fades
 * out completely by ~0.79. From 0.8 on the foreground is empty (the final line needs pure darkness).
 */

const N = 90;
const OFF = "M-9999 -9999h0";

export function Voice() {
  return (
    <g data-fs="voice" className={s.filmOnly} opacity={0}>
      <path data-fs-live="voice" className={s.stroke} d={OFF} stroke={C.ko} strokeOpacity={0.9} strokeWidth={1.15} />
    </g>
  );
}

export const bindVoice: Bind = (svg, portrait) => {
  const el = one(svg, "voice");
  const [, f1] = BEATS.focus;
  const [s0, s1] = BEATS.silence;
  return (p, t, F) => {
    if (p < f1 - 0.02 || p > s1 - 0.005) { setA(el, "d", OFF); return; }
    const cx = F.w / 2, cy = F.h / 2, u = Math.min(F.w, F.h);
    // ~14% of the width (16% on phones), opening out of Seoul's point, then drawing in as it falls silent.
    const open = range(p, f1 - 0.014, f1 + 0.002);
    const small = range(p, s0 + 0.014, s0 + 0.04);
    const half = F.w * (portrait ? 0.08 : 0.07) * open * lerp(1, 0.45, small);
    // A voice: syllables with pauses; quieter as it gets smaller, then nothing at all; then a still line.
    const quiet = 1 - range(p, s0 + 0.014, s0 + 0.042);
    const amp = u * 0.032 * (0.25 + 0.75 * syllables(t, 1)) * quiet * open;
    let d = "";
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      d += (i ? "L" : "M") + n2(cx - half + 2 * half * x) + " " + n2(cy + waveY(x, t, amp, 0));
    }
    setA(el, "d", d);
  };
};

export function voiceTimeline(T: Tw) {
  const [, f1] = BEATS.focus;
  const [, s1] = BEATS.silence;
  T.fromTo('[data-fs="voice"]', { opacity: 0 }, { opacity: 1, duration: 0.014, ease: "power1.out" }, f1 - 0.016);
  // It stops; held a moment; then gone, well before the final line.
  T.to('[data-fs="voice"]', { opacity: 0, duration: 0.016, ease: "power1.in" }, s1 - 0.026);
}
