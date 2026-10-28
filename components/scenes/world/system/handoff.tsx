import type { CSSProperties } from "react";
import { RAYS } from "@/components/scenes/engine/system/exit-multiply";
import { BEATS } from "../beats";
import { endSpan, n2, type Geo } from "./geometry";
import { C, GLOW, all, s, setA, speech, type Bind, type Tw } from "./shared";
import w from "./world-system.module.css";

/**
 * The two ends of chapter 06, in screen space.
 * Open: chapter 05's last frame exactly (gold core, 1 + 1 + 8 + ~90 rays from the centre), receding and
 *   dissolving into the conversation paths as the camera pulls back.
 * Close: the selected conversation opened up: one line across the screen, KO on the left, EN on the
 *   right, meeting in the centre, breathing but not yet speaking. Chapter 07 begins the conversation.
 */

export function Opening({ G }: { G: Geo }) {
  const cx = G.w / 2, cy = G.h / 2;
  const L = Math.hypot(G.w, G.h) * 0.62;
  const ray = (a: number, l = 1) => `M${n2(cx)} ${n2(cy)}L${n2(cx + Math.cos(a) * L * l)} ${n2(cy + Math.sin(a) * L * l)}`;
  const many = [0, 1, 2].map((c) => RAYS.many.filter((r) => r.c === c).map((r) => ray(r.a, r.l)).join(""));
  const col = [C.ko, C.en, C.gold];
  return (
    <g data-ws="open" className={`${s.filmOnly} ${s.ray}`} style={{ "--m": 1 } as CSSProperties}>
      {many.map((d, i) => <path key={i} className={s.stroke} d={d} stroke={col[i]} strokeOpacity={0.32} strokeWidth={0.7} />)}
      {RAYS.few.map((a, k) => <path key={k} className={s.stroke} d={ray(a)} stroke={col[k % 3]} strokeOpacity={0.55} strokeWidth={0.9} />)}
      <path className={s.stroke} d={ray(Math.PI)} stroke={C.ko} strokeOpacity={0.8} strokeWidth={1.1} />
      <path className={s.stroke} d={ray(0)} stroke={C.en} strokeOpacity={0.85} strokeWidth={1.1} />
    </g>
  );
}

const N = 90;

export function Closing({ G }: { G: Geo }) {
  const cy = G.h / 2, { x0, x1 } = endSpan(G.w);
  return (
    <g data-ws="end" className={s.filmOnly} opacity={0}>
      <g data-ws="end-line" className={w.wide}>
        <path data-ws-live="end-wave" className={s.stroke} d={`M${n2(x0)} ${n2(cy)}H${n2(G.w / 2)}`} stroke={C.ko} strokeWidth={1.4} />
        <path data-ws-live="end-wave" className={s.stroke} d={`M${n2(G.w / 2)} ${n2(cy)}H${n2(x1)}`} stroke={C.en} strokeWidth={1.4} />
        <circle cx={x0} cy={cy} r={2.6} fill={C.ko} filter={GLOW} />
        <circle cx={x1} cy={cy} r={2.6} fill={C.en} filter={GLOW} />
      </g>
      <circle cx={G.w / 2} cy={cy} r={2.8} fill={C.gold} filter={GLOW} />
    </g>
  );
}

export const bindClosing: Bind = (svg, G) => {
  const [left, right] = all(svg, "end-wave");
  const cy = G.h / 2, { x0, x1 } = endSpan(G.w), mid = G.w / 2;
  return (p, t) => {
    if (p < BEATS.setup[0] - 0.01) return;
    // Waiting to speak: a held breath on both sides, the faintest flicker, no words yet.
    const amp = 2.5 + 1.5 * Math.sin(t * 0.9);
    for (const [el, a, b, ph] of [[left, x0, mid, 0], [right, mid, x1, 2.1]] as const) {
      let d = "";
      for (let i = 0; i <= N; i++) {
        const x = i / N;
        d += (i ? "L" : "M") + n2(a + (b - a) * x) + " " + n2(cy + amp * speech(x, t * 0.35, 9, ph));
      }
      setA(el, "d", d);
    }
  };
};

export function handoffTimeline(T: Tw) {
  const [o0, o1] = BEATS.open;
  // Rays recede with the pull-back and dissolve into the paths drawn from the same centre.
  T.fromTo('[data-ws="open"]', { "--m": 1 }, { "--m": 0.45, duration: o1 - o0 + 0.04, ease: "power1.in" }, o0 + 0.005);
  T.fromTo('[data-ws="open"]', { opacity: 1 }, { opacity: 0, duration: o1 - o0 + 0.02, ease: "power1.in" }, o0 + 0.01);

  const [e0] = BEATS.setup;
  T.fromTo('[data-ws="end"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, e0);
  T.fromTo('[data-ws="end-line"]', { "--g": 0.02 }, { "--g": 1, duration: 0.05, ease: "power2.out" }, e0 + 0.004);
}
