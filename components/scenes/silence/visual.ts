import { EN, INK, KO, PALETTE, label, lerp, range, rnd, syllables, waveY, window01, type Frame, type SceneVisual } from "@/lib/cinematic/visual";

/** Where the two voices sit at progress p: centre and half-width of each side. */
function layout(f: Frame) {
  const { w, h, p, portrait } = f;
  const grow = range(p, 0.04, 0.3);
  const meet = range(p, 0.72, 1);
  if (portrait) {
    return {
      // Above and below the title, closing in on it at the end.
      ko: { x: w / 2, y: lerp(lerp(h * 0.5, h * 0.18, grow), h * 0.26, meet), half: lerp(w * 0.04, w * 0.36, grow) },
      en: { x: w / 2, y: lerp(h * 0.76, h * 0.68, meet), half: w * 0.36 },
    };
  }
  const y = h * 0.74;
  return {
    ko: { x: lerp(lerp(w / 2, w * 0.27, grow), w * 0.4, meet), y, half: lerp(w * 0.02, w * 0.13, grow) },
    en: { x: lerp(w * 0.73, w * 0.6, meet), y, half: lerp(w * 0.13, w * 0.1, meet) },
  };
}

/** Who is speaking: Korean first, then English, then both quiet while they drift together. */
const koSpeaks = (p: number) => window01(p, 0.06, 0.42, 0.05);
const enSpeaks = (p: number) => window01(p, 0.38, 0.7, 0.05);

/** 01 — two lone voices in the dark. */
export const silenceVisual: SceneVisual = {
  place(i, f, o) {
    const side = i & 1;
    const k = (i >> 1) / (f.n / 2);
    const L = layout(f);
    const s = side ? L.en : L.ko;
    const amp = (side ? enSpeaks(f.p) * syllables(f.t, 4) : koSpeaks(f.p) * syllables(f.t, 1)) * f.u * 0.06 + f.u * 0.002;
    const along = (k - 0.5) * 2 * s.half;
    const jitter = (rnd(i, 3) - 0.5) * 1.6;
    o.x = s.x + along;
    o.y = s.y + waveY(k, f.t, amp, side * 2) + jitter;
    o.c = side ? EN : KO;
    // English is not there yet at the start; a few particles of the Korean voice stay dim at the edges.
    o.a = (side ? range(f.p, 0.3, 0.42) : 1) * (0.35 + 0.65 * Math.sin(Math.PI * k));
    o.s = 1;
  },
  draw(ctx, f, alpha) {
    const L = layout(f);
    // Words and places sit under the voices, clear of the titles above.
    const off = f.u * 0.085;
    label(ctx, "KO · SEOUL 09:41", L.ko.x, L.ko.y + off + 24, alpha * range(f.p, 0.1, 0.2) * (1 - range(f.p, 0.75, 0.9)) * 0.7, PALETTE[KO]);
    label(ctx, "EN · TORONTO 20:41", L.en.x, L.en.y + off + 24, alpha * range(f.p, 0.34, 0.44) * (1 - range(f.p, 0.75, 0.9)) * 0.7, PALETTE[EN]);
    label(ctx, "안녕하세요", L.ko.x, L.ko.y + off, alpha * window01(f.p, 0.12, 0.34) * 0.9, PALETTE[INK], "center", 15);
    label(ctx, "Hello?", L.en.x, L.en.y + off, alpha * window01(f.p, 0.44, 0.64) * 0.9, PALETTE[INK], "center", 15);
    ctx.globalAlpha = 1;
  },
};
