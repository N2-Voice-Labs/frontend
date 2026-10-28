import { range } from "@/lib/cinematic/visual";
import { BEATS, UTTERANCE } from "../beats";
import { U, type Geo, type P2 } from "./geometry";
import { C, Label, all, n2, one, op, s, setA, speech, textWidth, type Bind, type Tw } from "./shared";

/**
 * STT · SPEECH → LANGUAGE — the fragments of the utterance rise out of the wave one by one, then slide
 * into their places in the sentence (lang="ko"), which keeps drifting forward towards understanding.
 * Text is screen-sized (counter-scaled); world positions move, screen offsets interpolate.
 */

const [S0, S1] = BEATS.stt;
const N = 90;
const FRAG = UTTERANCE.fragments;
const uAt = (x: number) => U.sttA + (U.sttB - U.sttA) * x;
const EMERGE = FRAG.map((_, i) => uAt(0.14 + 0.22 * i));

/** Sentence layout in screen px (font size differs per orientation): its width and each fragment's centre offset. */
function layout(G: Geo) {
  const size = G.portrait ? 11 : 12;
  const W = textWidth(UTTERANCE.text, size);
  const left = G.portrait ? 18 : -W / 2;
  const top = G.portrait ? 0 : -40;
  const frag = FRAG.map((f) => {
    const i = UTTERANCE.text.indexOf(f);
    const off = textWidth(UTTERANCE.text.slice(0, Math.max(0, i)), size);
    const w = textWidth(f, size);
    return { w, x: left + off + w / 2, y: top };
  });
  return { size, W, left, top, frag };
}

/** The sentence's world anchor: over the region, then drifting forward to U.sent. */
const anchorU = (p: number) => U.stt + 0.012 + (U.sent - U.stt - 0.012) * range(p, S0 + 0.08, S1 + 0.012);

export function SpeechToText({ G }: { G: Geo }) {
  const A = 20 / G.Z.stt;
  const L = layout(G);
  const wave = G.along(U.sttA, U.sttB, N, (x) => A * (1 - 0.7 * x) * speech(x, 0, 6, 2.2));
  const mark = 6 / G.Z.stt;
  const marks = EMERGE.map((u) => {
    const a = G.pt(u, -mark), b = G.pt(u, mark);
    return `M${n2(a.x)} ${n2(a.y)}L${n2(b.x)} ${n2(b.y)}`;
  }).join("");
  const a0 = G.pt(anchorU(S0));
  return (
    <g data-es-part="stt">
      <path data-es-live="stt-wave" className={s.stroke} d={wave} stroke={C.ko} strokeOpacity={0.8} strokeWidth={1.2} />
      <path data-es-stt="marks" className={s.stroke} d={marks} stroke={C.ink} strokeOpacity={0.55} strokeWidth={1.2} />
      <g className={s.filmOnly}>
        <path data-es-live="stt-hair" className={s.stroke} d="M-9999 -9999h0.01" stroke={C.ink} strokeOpacity={0.35} strokeWidth={1} />
        {FRAG.map((f, i) => (
          <Label key={f} at={G.pt(EMERGE[i])} cls="token" g={{ "data-es-live": "stt-frag", opacity: 0 }} text={{ lang: UTTERANCE.lang, textLength: L.frag[i].w, lengthAdjust: "spacing" }}>
            {f}
          </Label>
        ))}
        <Label
          at={a0}
          dx={L.left}
          dy={L.top}
          anchor="start"
          cls="token"
          g={{ "data-es-live": "stt-sent", opacity: 0 }}
          text={{ lang: UTTERANCE.lang, textLength: L.W, lengthAdjust: "spacing" }}
        >
          {UTTERANCE.text}
        </Label>
      </g>
      <Label at={G.pt(U.stt)} dx={G.portrait ? -16 : 0} dy={G.portrait ? 0 : 30} anchor={G.portrait ? "end" : "middle"} g={{ "data-es-stt": "label" }}>STT</Label>
      <Label at={G.pt(U.stt)} dx={G.portrait ? -16 : 0} dy={G.portrait ? 14 : 46} anchor={G.portrait ? "end" : "middle"} cls="tiny" g={{ "data-es-stt": "label2" }}>
        SPEECH → LANGUAGE
      </Label>
    </g>
  );
}

export const bindSpeechToText: Bind = (svg, G) => {
  const wave = one(svg, "stt-wave"), hair = one(svg, "stt-hair"), sent = one(svg, "stt-sent");
  const frags = all(svg, "stt-frag");
  const texts = frags.map((g) => g.querySelector("text"));
  const L = layout(G);
  const A = 20 / G.Z.stt;
  const E: P2[] = EMERGE.map((u) => G.pt(u));
  const at = Array.from({ length: N + 1 }, (_, i) => G.at(uAt(i / N)));

  return (p, t, cam) => {
    if (p < S0 - 0.04 || (p > S1 + 0.06 && p < 0.68)) return;
    const k = range(p, 0.7, 0.78);
    const amp = A * (1 - k) + 5 * k;
    let d = "";
    for (let i = 0; i <= N; i++) {
      const x = i / N, q = at[i], v = amp * (1 - 0.7 * x) * speech(x, t, 6, 2.2);
      d += (i ? "L" : "M") + n2(q.x + q.nx * v) + " " + n2(q.y + q.ny * v);
    }
    setA(wave, "d", d);

    if (p > S1 + 0.03) {
      frags.forEach((el) => op(el, 0));
      op(sent, 0);
      setA(hair, "d", "M-9999 -9999h0.01");
      return;
    }

    const q = (p - S0) / (S1 - S0);
    const a = range(q, 0.62, 0.8);
    const anchor = G.pt(anchorU(p));
    const z = cam.z || 1;
    let hd = "";
    frags.forEach((el, i) => {
      const r = range(q, 0.06 + 0.1 * i, 0.3 + 0.1 * i);
      const f = L.frag[i];
      // rise: straight out of the wave (desktop up, portrait right), with a little breathing.
      const breathe = Math.sin(t * 1.3 + i * 1.7) * 2 * (1 - a);
      const rx = G.portrait ? (14 + f.w / 2) * r : 0;
      const ry = G.portrait ? breathe : (-22 - 8 * (i % 2)) * r + breathe;
      const wx = E[i].x + (anchor.x - E[i].x) * a, wy = E[i].y + (anchor.y - E[i].y) * a;
      const sx = rx + (f.x - rx) * a, sy = ry + (f.y - ry) * a;
      setA(el, "transform", `translate(${n2(wx)} ${n2(wy)})`);
      setA(texts[i], "x", sx.toFixed(1));
      setA(texts[i], "y", sy.toFixed(1));
      op(el, r * (1 - range(q, 0.8, 0.88)));
      if (r > 0.02 && a < 0.98) {
        // hairline from the emergence point to the rising fragment (screen offset → world via the zoom).
        const tx = wx + (sx * 0.85) / z, ty = wy + (sy + (G.portrait ? 0 : 7)) / z;
        hd += `M${n2(E[i].x)} ${n2(E[i].y)}L${n2(tx)} ${n2(ty)}`;
      }
    });
    setA(hair, "d", hd || "M-9999 -9999h0.01");
    setA(hair, "opacity", (1 - a).toFixed(3));
    setA(sent, "transform", `translate(${n2(anchor.x)} ${n2(anchor.y)})`);
    op(sent, range(q, 0.74, 0.84) * (1 - range(p, S1 + 0.004, S1 + 0.022)));
  };
};

export function speechToTextTimeline(T: Tw) {
  T.fromTo('[data-es-part="stt"]', { opacity: 0 }, { opacity: 1, duration: 0.02 }, S0 - 0.012);
  T.fromTo('[data-es-stt="marks"]', { opacity: 0 }, { opacity: 1, duration: 0.03 }, S0 + 0.006);
  T.fromTo('[data-es-stt="label"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, S0 + 0.004);
  T.fromTo('[data-es-stt="label2"]', { opacity: 0 }, { opacity: 1, duration: 0.012 }, S0 + 0.03);
  T.to('[data-es-stt="label"], [data-es-stt="label2"]', { opacity: 0, duration: 0.012 }, S1);
  T.to('[data-es-part="stt"]', { opacity: 0.4, duration: 0.02 }, S1 + 0.01);
  T.to('[data-es-part="stt"]', { opacity: 0.8, duration: 0.03 }, 0.72);
}
