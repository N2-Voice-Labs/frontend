import { range } from "@/lib/cinematic/visual";
import { BEATS, RESPONSE } from "../beats";
import { U, type Geo, type P2 } from "./geometry";
import { C, Dot, Label, n2, one, op, quad, s, setA, speech, textWidth, type Bind, type Tw } from "./shared";

/**
 * RESPOND → TTS — the field's paths collapse into one decision point (INTENT → RESPONSE); the reply
 * (lang="ko") appears for a moment, then dissolves into points that travel along the path and settle
 * into a wave: language becomes voice again, the inverse of STT.
 */

const [P0, P1] = BEATS.respond;
const [T0, T1] = BEATS.tts;
const NDOT = 40;
const N = 90;
const uAt = (x: number) => U.ttsA + (U.ttsB - U.ttsA) * x;
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function layout(G: Geo) {
  const size = G.portrait ? 11 : 12;
  const natural = textWidth(RESPONSE.text, size);
  const W = G.portrait ? Math.min(natural, G.w * 0.5 - 22) : natural;
  const left = G.portrait ? 12 : -W / 2, top = G.portrait ? 10 : -48;
  const rp = G.pt(U.respond);
  const { c, R, tc } = G;
  const from = [-42, 0, 42].map((th) => {
    const a = (th * Math.PI) / 180;
    return { x: c.x + R * 0.95 * (Math.cos(a) * tc.tx + Math.sin(a) * tc.nx), y: c.y + R * 0.95 * (Math.cos(a) * tc.ty + Math.sin(a) * tc.ny) };
  });
  return { size, W, natural, left, top, rp, from };
}

const waveV = (x: number, amp: number, t: number) => amp * speech(x, t, 6, 0.9);

export function TextToSpeech({ G }: { G: Geo }) {
  const L = layout(G);
  const mid = G.pt((U.reason + U.respond) / 2 + 0.03);
  const intent = G.portrait ? { dx: 12, dy: -10, anchor: "start" as const } : { dx: 0, dy: -24, anchor: "middle" as const };
  const below = G.portrait ? { dx: -16, anchor: "end" as const, dy: 0 } : { dx: 0, anchor: "middle" as const, dy: 30 };
  return (
    <g data-es-part="tts">
      {L.from.map((f, i) => (
        <path
          key={i}
          data-es-tts="collapse"
          className={s.stroke}
          d={`M${n2(f.x)} ${n2(f.y)}Q${n2(mid.x)} ${n2(mid.y)} ${n2(L.rp.x)} ${n2(L.rp.y)}`}
          stroke={C.gold}
          strokeOpacity={i === 1 ? 0.7 : 0.4}
          strokeWidth={1}
          pathLength={1}
          strokeDasharray="1 1"
        />
      ))}
      <Dot at={L.rp} r={2.8} g={{ "data-es-tts": "decision" }} />
      <Label at={L.rp} {...intent} cls="tiny" g={{ "data-es-tts": "intent" }}>INTENT → RESPONSE</Label>
      <g className={s.filmOnly}>
        <Label
          at={L.rp}
          dx={L.left}
          dy={L.top}
          anchor="start"
          cls="token"
          g={{ "data-es-live": "tts-resp", opacity: 0 }}
          text={{ lang: RESPONSE.lang, textLength: L.W, lengthAdjust: L.W < L.natural ? "spacingAndGlyphs" : "spacing" }}
        >
          {RESPONSE.text}
        </Label>
        <path data-es-live="tts-dots" className={s.dots} d="M-9999 -9999h0.01" stroke={C.en} strokeWidth={1.8} opacity={0} />
      </g>
      <path data-es-live="tts-wave" className={s.stroke} d={G.along(U.ttsA, U.ttsB, N, (x) => waveV(x, 5, 0))} stroke={C.en} strokeWidth={1.25} />
      <Label at={G.pt(U.tts)} {...below} g={{ "data-es-tts": "label" }}>TTS</Label>
      <Label at={G.pt(U.tts)} {...below} dy={below.dy + 16} cls="tiny" g={{ "data-es-tts": "label2" }}>LANGUAGE → VOICE</Label>
    </g>
  );
}

export const bindTextToSpeech: Bind = (svg, G) => {
  const resp = one(svg, "tts-resp"), dots = one(svg, "tts-dots"), wave = one(svg, "tts-wave");
  const L = layout(G);
  const z = G.Z.respond;
  const A = 22 / G.Z.tts;
  const at = Array.from({ length: N + 1 }, (_, i) => G.at(uAt(i / N)));
  const start: P2[] = Array.from({ length: NDOT }, (_, k) => ({
    x: L.rp.x + (L.left + L.W * rnd(k, 1)) / z,
    y: L.rp.y + (L.top + (rnd(k, 2) - 0.5) * 9) / z,
  }));
  const ctrl = G.pt((U.respond + U.ttsA) / 2, -14 / z);
  const tmp = { x: 0, y: 0 }, end = { x: 0, y: 0 };

  return (p, t) => {
    if (p < P0 - 0.02 || (p > T1 + 0.03 && p < 0.7)) return;
    const k = range(p, 0.7, 0.78);
    const amp = (A * range(p, T0 + 0.012, T1 - 0.01)) * (1 - k) + 6 * k;

    let d = "";
    for (let i = 0; i <= N; i++) {
      const q = at[i], v = waveV(i / N, amp, t);
      d += (i ? "L" : "M") + n2(q.x + q.nx * v) + " " + n2(q.y + q.ny * v);
    }
    setA(wave, "d", d);

    op(resp, range(p, P0 + 0.012, P0 + 0.022) * (1 - range(p, P1 - 0.017, P1 - 0.008)));

    // dissolve: the reply's points travel along the path and land on the new wave.
    const show = range(p, P1 - 0.017, P1 - 0.01) * (1 - range(p, T0 + 0.03, T1 - 0.005));
    op(dots, show);
    if (dots && show > 0) {
      let dd = "";
      for (let j = 0; j < NDOT; j++) {
        const lam = easeInOut(range(p, P1 - 0.015 + 0.0004 * j, T0 + 0.022 + 0.0005 * j));
        const x = (j + 0.5) / NDOT, q = G.at(uAt(x)), v = waveV(x, amp, t);
        end.x = q.x + q.nx * v; end.y = q.y + q.ny * v;
        quad(start[j], ctrl, end, lam, tmp);
        const jit = (1 - lam) * 0.6 / z;
        dd += `M${n2(tmp.x + Math.sin(t * 3 + j) * jit)} ${n2(tmp.y + Math.cos(t * 2.6 + j * 1.3) * jit)}h0.01`;
      }
      setA(dots, "d", dd);
    }
  };
};

export function textToSpeechTimeline(T: Tw) {
  T.fromTo('[data-es-part="tts"]', { opacity: 0 }, { opacity: 1, duration: 0.008 }, P0 - 0.004);
  T.fromTo('[data-es-tts="collapse"]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.016, stagger: 0.003 }, P0);
  T.fromTo('[data-es-tts="decision"]', { opacity: 0 }, { opacity: 1, duration: 0.008 }, P0 + 0.012);
  T.fromTo('[data-es-tts="intent"]', { opacity: 0 }, { opacity: 1, duration: 0.008 }, P0 + 0.008);
  T.to('[data-es-tts="intent"]', { opacity: 0, duration: 0.01 }, P1);
  T.to('[data-es-tts="collapse"]', { opacity: 0.4, duration: 0.015 }, P1);
  T.fromTo('[data-es-tts="label"]', { opacity: 0 }, { opacity: 1, duration: 0.01 }, T0 + 0.004);
  T.fromTo('[data-es-tts="label2"]', { opacity: 0 }, { opacity: 1, duration: 0.01 }, T0 + 0.016);
  T.to('[data-es-tts="label"], [data-es-tts="label2"]', { opacity: 0, duration: 0.01 }, T1);
  T.to('[data-es-part="tts"]', { opacity: 0.85, duration: 0.03 }, 0.72);
}
