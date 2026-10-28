import { range } from "@/lib/cinematic/visual";
import { BEATS, MEANING, UTTERANCE } from "../beats";
import { U, type Geo, type P2 } from "./geometry";
import { C, Label, all, n2, one, op, s, setA, textWidth, type Bind, type Tw } from "./shared";

/**
 * UNDERSTAND — the sentence breaks into meaning: TIME · TOMORROW · MORNING · MEETING · AVAILABILITY drift
 * apart from where the sentence was, a few of them join by hairlines, TIME dissolves into the others,
 * the rest of the sentence scatters as dust. Then the meaning drifts on into the reasoning field; what
 * stays is a faint knot of hairlines that keeps breathing.
 */

const [M0, M1] = BEATS.understand;
/** Design offsets (screen px at the understanding zoom) around the region centre. */
const OFF_L: [number, number][] = [[-160, -78], [-40, -118], [118, -72], [-96, 64], [96, 92]];
const OFF_P: [number, number][] = [[64, -130], [-72, -78], [70, -24], [-62, 58], [52, 124]];
const LINKS: [number, number][] = [[0, 1], [1, 2], [2, 4], [3, 4]];
const DUST = 26;

const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function layout(G: Geo) {
  const size = G.portrait ? 11 : 12;
  const W = textWidth(UTTERANCE.text, size);
  const left = G.portrait ? 18 : -W / 2, top = G.portrait ? 0 : -40;
  const z = G.Z.und;
  const centre = G.pt(U.und);
  const off = G.portrait ? OFF_P : OFF_L;
  const target: P2[] = off.map(([x, y]) => ({ x: centre.x + x / z, y: centre.y + y / z }));
  // Where each word starts: spread across the sentence it comes from (screen offsets from U.sent).
  const start: P2[] = MEANING.map((_, i) => ({ x: left + (W * (i + 0.5)) / MEANING.length, y: top }));
  return { W, left, top, z, centre, target, start, origin: G.pt(U.sent) };
}

export function Understanding({ G }: { G: Geo }) {
  const L = layout(G);
  const lab = G.portrait ? 176 : 132;
  return (
    <g data-es-part="und">
      <path data-es-live="und-hair" className={s.stroke} d="M-9999 -9999h0.01" stroke={C.gold} strokeOpacity={0.5} strokeWidth={1} />
      <path data-es-live="und-dust" className={s.dots} d="M-9999 -9999h0.01" stroke={C.ink} strokeOpacity={0.6} strokeWidth={1.6} />
      <g className={s.filmOnly}>
        {MEANING.map((m, i) => (
          <Label key={m} at={L.origin} cls="word" g={{ "data-es-live": "und-word", opacity: 0 }} text={{ fill: m === "AVAILABILITY" ? C.gold : C.ink }}>
            {m}
          </Label>
        ))}
      </g>
      <Label at={L.centre} dy={lab} g={{ "data-es-und": "label" }}>UNDERSTAND</Label>
      <Label at={L.centre} dy={lab + 16} cls="tiny" g={{ "data-es-und": "label2" }}>CONTEXT · INTENT · LANGUAGE</Label>
    </g>
  );
}

export const bindUnderstanding: Bind = (svg, G) => {
  const hair = one(svg, "und-hair"), dust = one(svg, "und-dust");
  const words = all(svg, "und-word");
  const texts = words.map((g) => g.querySelector("text"));
  const L = layout(G);
  const pos: P2[] = MEANING.map(() => ({ x: 0, y: 0 }));
  const entry = { x: G.c.x - G.tc.tx * G.R * 1.05, y: G.c.y - G.tc.ty * G.R * 1.05 };

  return (p, t, cam) => {
    if (p < M0 - 0.01 || (p > M1 + 0.05 && p < 0.68)) return;
    const q = (p - M0) / (M1 - M0);
    const z = cam.z || 1;
    const leave = range(p, M1 - 0.006, M1 + 0.03);
    const amp = 6 / L.z;

    words.forEach((el, i) => {
      const a = range(q, 0.02 + 0.04 * i, 0.42 + 0.04 * i);
      const tg = L.target[i];
      const tx = tg.x + Math.sin(t * 0.5 + i * 2) * amp, ty = tg.y + Math.cos(t * 0.4 + i) * amp;
      // the meaning drifts on into the reasoning field after the beat.
      const wx0 = L.origin.x + (tx - L.origin.x) * a, wy0 = L.origin.y + (ty - L.origin.y) * a;
      const wx = wx0 + (entry.x - wx0) * leave * 0.85, wy = wy0 + (entry.y - wy0) * leave * 0.85;
      pos[i].x = tx; pos[i].y = ty;
      setA(el, "transform", `translate(${n2(wx)} ${n2(wy)})`);
      const st = L.start[i];
      setA(texts[i], "x", (st.x * (1 - a)).toFixed(1));
      setA(texts[i], "y", (st.y * (1 - a)).toFixed(1));
      let o = range(q, 0.02 + 0.04 * i, 0.16 + 0.04 * i) * (1 - leave);
      if (i === 0) o *= 1 - range(q, 0.6, 0.8);
      op(el, p > 0.68 ? 0 : o * 0.92);
    });

    // hairlines: grow between the words, TIME's link vanishes with it; afterwards a faint living knot.
    let d = "";
    const after = p > M1 + 0.02;
    LINKS.forEach(([a, b], j) => {
      let f = range(q, 0.34 + 0.07 * j, 0.5 + 0.07 * j);
      if (a === 0) f *= 1 - range(q, 0.6, 0.78);
      if (after) f = a === 0 ? 0 : 1;
      if (f <= 0.01) return;
      const A = pos[a], B = pos[b];
      const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1;
      const cut = Math.min(after ? 0 : 14 / z, l * 0.3);
      const ax = A.x + (dx / l) * cut, ay = A.y + (dy / l) * cut;
      const bx = ax + (dx - (2 * dx * cut) / l) * f, by = ay + (dy - (2 * dy * cut) / l) * f;
      d += `M${n2(ax)} ${n2(ay)}L${n2(bx)} ${n2(by)}`;
    });
    setA(hair, "d", d || "M-9999 -9999h0.01");
    op(hair, after ? 0.5 : 1);

    // dust: the rest of the sentence scatters and vanishes; afterwards, the knot's points.
    if (dust) {
      let dd = "";
      if (!after) {
        const k = range(q, 0.02, 0.7);
        for (let i = 0; i < DUST; i++) {
          const sx = L.origin.x + (L.left + L.W * rnd(i, 1)) / z, sy = L.origin.y + (L.top + (rnd(i, 2) - 0.5) * 10) / z;
          const ang = rnd(i, 3) * Math.PI * 2, r = (20 + 60 * rnd(i, 4)) / z;
          if (k < 0.98 && rnd(i, 5) > k) dd += `M${n2(sx + Math.cos(ang) * r * k)} ${n2(sy + Math.sin(ang) * r * k)}h0.01`;
        }
      } else {
        for (let i = 1; i < pos.length; i++) dd += `M${n2(pos[i].x)} ${n2(pos[i].y)}h0.01`;
      }
      setA(dust, "d", dd || "M-9999 -9999h0.01");
    }
  };
};

export function understandingTimeline(T: Tw) {
  T.fromTo('[data-es-part="und"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, M0 - 0.004);
  T.fromTo('[data-es-und="label"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, M0 + 0.008);
  T.fromTo('[data-es-und="label2"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, M0 + 0.04);
  T.to('[data-es-und="label"], [data-es-und="label2"]', { opacity: 0, duration: 0.012 }, M1);
  T.to('[data-es-part="und"]', { opacity: 0.55, duration: 0.02 }, M1 + 0.02);
  T.to('[data-es-part="und"]', { opacity: 0.8, duration: 0.03 }, 0.72);
}
