import { BEATS } from "../beats";
import { C, GLOW, Label, n2, one, op, range, s, setA, speech, type Bind, type Tw } from "./shared";

/**
 * The point (screen space). Chapter 07 ended with its two voices, KO on the left and EN on the right,
 * meeting in one point of light at the centre. Here that pair is seen once more, already small: two tiny
 * waveforms joined by a thread, receding toward the centre until they ARE the point the network grows from
 * (globe.ts: at p = 0 every node sits on the screen centre).
 */

const N = 48;

/** Half-span of the pair at p (px): shrinks to nothing as it recedes. */
const halfAt = (p: number, w: number, portrait: boolean) => w * (portrait ? 0.3 : 0.12) * (1 - range(p, 0, BEATS.point[1] - 0.005)) ** 1.5;

export function Point({ w, h }: { w: number; h: number }) {
  const c = { x: w / 2, y: h / 2 };
  return (
    <g data-fs="point" className={s.filmOnly}>
      <path data-fs-live="pt-ko" className={s.stroke} d={`M${n2(c.x)} ${n2(c.y)}h0`} stroke={C.ko} strokeOpacity={0.8} strokeWidth={1.1} />
      <path data-fs-live="pt-en" className={s.stroke} d={`M${n2(c.x)} ${n2(c.y)}h0`} stroke={C.en} strokeOpacity={0.8} strokeWidth={1.1} />
      {/* The connection between them: a thread through the centre. */}
      <path data-fs-live="pt-link" className={s.stroke} d={`M${n2(c.x)} ${n2(c.y)}h0`} stroke={C.ink} strokeOpacity={0.35} strokeWidth={0.7} />
      <Label at={c} cls="tiny" anchor="end" g={{ "data-fs-live": "pt-ko-label" }} text={{ style: { fill: C.ko } }}>KO · SEOUL</Label>
      <Label at={c} cls="tiny" anchor="start" g={{ "data-fs-live": "pt-en-label" }} text={{ style: { fill: C.en } }}>EN · TORONTO</Label>
      {/* Where they meet: the point of light the whole network will grow out of. */}
      <circle data-fs="point-core" cx={c.x} cy={c.y} r={2.4} fill={C.ink} filter={GLOW} />
    </g>
  );
}

export const bindPoint: Bind = (svg, portrait) => {
  const ko = one(svg, "pt-ko"), en = one(svg, "pt-en"), link = one(svg, "pt-link");
  const koL = one(svg, "pt-ko-label"), enL = one(svg, "pt-en-label");
  let done = false;
  return (p, t, F) => {
    if (p > BEATS.point[1] + 0.01) {
      if (!done) { for (const el of [ko, en, link]) setA(el, "d", "M-9999 -9999h0"); done = true; }
      return;
    }
    done = false;
    const cx = F.w / 2, cy = F.h / 2, half = halfAt(p, F.w, portrait);
    const gap = half * 0.32;
    // Still talking, quieter as they recede (the waves keep their size relative to the pair).
    const amp = half * 0.09 * (0.55 + 0.45 * Math.sin(t * 0.8));
    for (const [el, a, b, ph] of [[ko, cx - half, cx - gap, 0], [en, cx + gap, cx + half, 2.1]] as const) {
      let d = "";
      for (let i = 0; i <= N; i++) {
        const x = i / N;
        d += (i ? "L" : "M") + n2(a + (b - a) * x) + " " + n2(cy + amp * speech(x, t * 0.6, 5, ph));
      }
      setA(el, "d", d);
    }
    setA(link, "d", `M${n2(cx - gap)} ${n2(cy)}L${n2(cx + gap)} ${n2(cy)}`);
    // Labels just outside each end, very small, gone well before the pair becomes the point.
    const lab = 1 - range(p, 0.005, 0.04);
    setA(koL, "transform", `translate(${n2(cx - half - 8)} ${n2(cy)})`);
    setA(enL, "transform", `translate(${n2(cx + half + 8)} ${n2(cy)})`);
    op(koL, lab);
    op(enL, lab);
  };
};

export function pointTimeline(T: Tw) {
  const [, p1] = BEATS.point;
  // The pair is gone once it is the point; the point hands over to the canvas's first nodes.
  T.fromTo('[data-fs="point"]', { opacity: 1 }, { opacity: 0, duration: 0.025, ease: "power1.in" }, p1 - 0.02);
  T.fromTo('[data-fs="point-core"]', { opacity: 0.9 }, { opacity: 0.5, duration: p1 - 0.03 }, 0.01);
}
