import { clamp, frac } from "@/lib/landing/math";
import { EN, INK, KO, PALETTE, label, lerp, range, rnd, syllables, waveY, window01, type Frame, type SceneVisual } from "@/lib/cinematic/visual";
import { BEATS, thesisPoints } from "./beats";

/**
 * 01 — THE SIGNAL. Darkness; a tiny Korean signal; it speaks; a far, dim English answer; they drift
 * together and lose coherence; a question that never arrives; silence; the signals return in one shared
 * rhythm; the thesis letters become particles that spread into chapter 02's field.
 *
 * Even particles are the KO signal, odd ones EN. Particles a beat does not need stay on their line with
 * alpha 0, so every beat can call on them later.
 */

const B = BEATS;
/** Edge (in progress) for speaking windows. */
const EDGE = 0.015;

type Signal = { x: number; y: number; half: number; share: number; vis: number; amp: number; tShift: number; seed: number };

/** Per-frame layout, computed once per frame and reused by every place() call (no allocations). */
const S = {
  key: NaN, w: 0, h: 0, t: NaN, n: 0,
  ko: { x: 0, y: 0, half: 1, share: 1, vis: 0, amp: 0, tShift: 0, seed: 0 } as Signal,
  en: { x: 0, y: 0, half: 1, share: 1, vis: 0, amp: 0, tShift: 0, seed: 2 } as Signal,
  /** Loss of coherence near the centre (approach → silence2). */
  decoh: 0,
  /** KO's question travelling across (koAsk). */
  ask: 0,
  /** EN receives a broken bit (enLost). */
  lost: 0,
  /** How far the signals have returned in sync. */
  sync: 0,
  /** Glyph jump (0–1) and spread into the field (0–1) during dissolve. */
  q: 0, spread: 0, tint: 0,
  tremor: 0,
};

function update(f: Frame) {
  const { w, h, p, t, n, portrait, u } = f;
  if (S.key === p && S.w === w && S.h === h && S.t === t && S.n === n) return;
  S.key = p; S.w = w; S.h = h; S.t = t; S.n = n;

  const grow = range(p, B.koSignal[0], B.koHello[1]);
  const enGrow = range(p, B.enSignal[0], B.enHello[1]);
  const drift = range(p, B.approach[0], B.approach[1]);
  const quiet = range(p, B.silence2[0], B.silence2[0] + 0.035);
  const darker = range(p, B.statement[0], B.statement[0] + 0.04);
  const sync = range(p, B.sync[0], B.sync[0] + 0.045);
  S.sync = sync;
  S.decoh = drift * (1 - quiet) * (1 - sync);
  S.ask = window01(p, B.koAsk[0], B.koAsk[1], EDGE);
  S.lost = window01(p, B.enLost[0], B.enLost[1], EDGE);
  // Particles gather onto the glyphs behind the still-visible title, so the swap at dissolve[0] is exact.
  S.q = range(p, B.dissolve[0] - 0.016, B.dissolve[0] - 0.002);
  S.spread = range(p, B.dissolve[0] + 0.012, 1);
  S.tint = range(p, B.dissolve[0] + 0.008, B.dissolve[0] + 0.035);
  S.tremor = u * 0.0022 * (1 - quiet * 0.75) + u * 0.0012 * sync;

  // Presence: dims to ~0.08 in silence2, ~0.05 during the statement, returns with the sync.
  const hush = lerp(lerp(1, 0.09, quiet), 0.05 / 0.85, darker);
  const ko = S.ko, en = S.en;

  // Places: alone → approach → (held through silence) → sync positions.
  if (portrait) {
    ko.x = w / 2; en.x = w / 2;
    ko.y = lerp(lerp(h * 0.3, h * 0.42, drift), h * 0.16, sync);
    en.y = lerp(lerp(h * 0.72, h * 0.58, drift), h * 0.86, sync);
    ko.half = lerp(lerp(0.03, 0.24, grow), 0.3, sync) * w;
    en.half = lerp(lerp(0.025, 0.17, enGrow), 0.3, sync) * w;
  } else {
    ko.x = lerp(lerp(w * 0.24, w * 0.38, drift), w * 0.3, sync);
    en.x = lerp(lerp(w * 0.8, w * 0.62, drift), w * 0.7, sync);
    ko.y = en.y = lerp(h * 0.5, h * 0.78, sync);
    ko.half = lerp(lerp(0.01, 0.1, grow), 0.1, sync) * w;
    en.half = lerp(lerp(0.008, 0.07, enGrow), 0.1, sync) * w;
  }
  ko.share = lerp(0.25, 1, grow);
  en.share = lerp(lerp(0.2, 0.7, enGrow), 1, sync);
  ko.vis = lerp(range(p, B.koSignal[0], B.koSignal[1]) * hush, 0.85, sync);
  en.vis = lerp(range(p, B.enSignal[0], B.enSignal[1]) * lerp(0.5, 0.68, drift) * hush, 0.85, sync);

  // Voices: separate envelopes, then one shared rhythm in sync.
  const shared = syllables(t, 7) * sync;
  const koTalk = (window01(p, B.koHello[0], B.koHello[1], EDGE) + S.ask) * syllables(t, 1) * (1 - sync);
  const enTalk = window01(p, B.enHello[0], B.enHello[1], EDGE) * syllables(t, 4) * 0.75 * (1 - sync);
  // EN's broken bit: a flickering, half-there burst.
  const flick = Math.abs(Math.sin(t * 23)) > 0.45 ? 1 : 0.15;
  const enBroken = S.lost * flick * (0.4 + 0.6 * syllables(t, 9)) * 0.6;
  ko.amp = (koTalk + shared * 0.85) * u * 0.05;
  en.amp = (enTalk + enBroken + shared * 0.85) * u * 0.05;
  // Out of phase while decoherent; one phase and one wave shape when synced.
  ko.tShift = 0;
  en.tShift = 0.7 * S.decoh + 1.3 * (1 - sync);
  ko.seed = 0;
  en.seed = 2 * (1 - sync);
}

/** Inner end of a signal (the end facing the other one). */
const innerX = (s: Signal, dir: number, f: Frame) => (f.portrait ? s.x : s.x + dir * s.half);
const innerY = (s: Signal, dir: number, f: Frame) => (f.portrait ? s.y + dir * f.u * 0.02 : s.y);

/** A particle on its signal line (with decoherence, the question stream and the sync connection). */
function placeSignal(i: number, f: Frame, o: { x: number; y: number; a: number; c: number; s: number }) {
  const side = i & 1;
  const k = (i >> 1) / (f.n / 2);
  const sg = side ? S.en : S.ko;
  const other = side ? S.ko : S.en;
  const dir = side ? -1 : 1; // toward the other signal
  const t = f.t;

  // Only the central `share` of the particles are lit; they spread over the line's full half-width.
  const centred = Math.abs(k - 0.5) * 2;
  const lit = 1 - range(centred, sg.share - 0.04, sg.share);
  const along = clamp(0.5 + (k - 0.5) / Math.max(sg.share, 0.01)) * 2 - 1; // -1..1
  const kk = along * 0.5 + 0.5;

  let x = sg.x + along * sg.half;
  let y = sg.y + waveY(kk, t + sg.tShift, sg.amp, sg.seed);
  // Organic idle tremor: slow, uneven, per position.
  y += (Math.sin(t * 1.3 + kk * 6.1 + side * 2) * 0.6 + Math.sin(t * 2.9 - kk * 11 + side) * 0.4) * S.tremor * Math.sin(Math.PI * kk);
  y += (rnd(i, 3) - 0.5) * 1.2;
  let a = sg.vis * (0.35 + 0.65 * Math.sin(Math.PI * kk)) * lit;

  // Lost coherence near the centre: inner-end particles detach, scatter and fade; the line jitters.
  const dec = S.decoh;
  if (dec > 0.001) {
    const inner = f.portrait ? centred : side ? 1 - kk : kk;
    const lim = 1 - 0.45 * dec;
    const det = rnd(i, 4) < 0.6 ? clamp((inner - lim) / (1 - lim + 1e-4)) * dec : 0;
    const ang = rnd(i, 5) * Math.PI * 2 + t * 0.15;
    const dist = det * f.u * 0.07 * (0.4 + rnd(i, 6));
    x += Math.cos(ang) * dist + (f.portrait ? 0 : dir * det * f.u * 0.03);
    y += Math.sin(ang) * dist + (f.portrait ? dir * det * f.u * 0.03 : 0);
    y += (rnd(i, 12) - 0.5) * dec * f.u * 0.008 * Math.sin(t * 11 + i);
    a *= 1 - 0.85 * det;
  }

  // The broken bit at EN: half the line drops out while it flickers.
  if (side && S.lost > 0.001 && rnd(i, 13) < 0.5) a *= 1 - 0.85 * S.lost;

  // Travellers: KO's question (koAsk, scatters past the centre) and the sync connection (arrives).
  const r7 = rnd(i, 7);
  const asking = side === 0 && r7 < 0.08 ? S.ask : 0;
  const linking = r7 < 0.05 ? S.sync * (1 - S.q) : 0;
  const tw = Math.max(asking, linking);
  if (tw > 0.001) {
    const s = frac(t * (asking ? 0.3 : 0.2) + rnd(i, 8));
    const sx = innerX(sg, dir, f), sy = innerY(sg, dir, f);
    const ex = innerX(other, -dir, f), ey = innerY(other, -dir, f);
    let tx = lerp(sx, ex, s), ty = lerp(sy, ey, s);
    const wob = Math.sin(s * 19 + i) * f.u * 0.004;
    if (f.portrait) tx += wob; else ty += wob;
    let ta: number;
    if (asking) {
      // Past the centre the question loses coherence: it scatters and fades before reaching EN.
      const loss = range(s, 0.45, 0.8);
      const ang = rnd(i, 14) * Math.PI * 2;
      tx += Math.cos(ang) * loss * f.u * 0.08;
      ty += Math.sin(ang) * loss * f.u * 0.08;
      ta = 0.85 * range(s, 0, 0.08) * (1 - loss) * sg.vis;
    } else {
      ta = 0.75 * Math.sin(Math.PI * s);
    }
    x = lerp(x, tx, tw); y = lerp(y, ty, tw); a = lerp(a, ta, tw);
  }

  o.x = x; o.y = y; o.a = a; o.c = side ? EN : KO; o.s = 1;
}

export const silenceVisual: SceneVisual = {
  place(i, f, o) {
    update(f);
    if (S.q <= 0) { placeSignal(i, f, o); return; }

    // Dissolve: particles take the thesis glyphs, inherit KO/EN colours, then separate into a field.
    const qi = range(S.q * 1.5 - rnd(i, 10) * 0.5, 0, 1);
    const { w, h, u } = f;
    const tp = thesisPoints.current;
    let gx: number, gy: number, cx: number, cy: number, word: number;
    if (tp && tp.count > 0) {
      const j = i % tp.count;
      gx = tp.xy[j * 2]; gy = tp.xy[j * 2 + 1];
      word = tp.word[j];
      cx = tp.wordCentre[word * 2]; cy = tp.wordCentre[word * 2 + 1];
    } else {
      // Fallback: a horizontal band across the centre.
      gx = w * (0.12 + 0.76 * rnd(i, 11)); gy = h / 2 + (rnd(i, 12) - 0.5) * h * 0.06;
      word = gx < w / 2 ? 0 : 1;
      cx = word ? w * 0.69 : w * 0.31; cy = h / 2;
    }
    const sp = S.spread;
    const e1 = sp * (2 - sp);
    // Away from the word centre and outward from the screen centre, with growing noise.
    let x = gx + (gx - cx) * 0.9 * e1 + (gx - w / 2) * 0.3 * e1;
    let y = gy + (gy - cy) * 1.4 * e1 + (gy - h / 2) * 0.3 * e1;
    const nz = sp * u * 0.03;
    x += Math.sin(f.t * 0.7 + rnd(i, 15) * 40) * nz;
    y += Math.cos(f.t * 0.6 + rnd(i, 16) * 40) * nz;
    // …settling into a loose field over the whole viewport by p = 1.
    const e2 = range(sp, 0.25, 1);
    x = lerp(x, w * (0.03 + 0.94 * rnd(i, 17)), e2);
    y = lerp(y, h * (0.03 + 0.94 * rnd(i, 18)), e2);

    // Colours: ink → word parity → (near the end) the particle's own side, matching chapter 02.
    let c = S.tint > rnd(i, 19) ? (word & 1 ? EN : KO) : INK;
    if (range(sp, 0.5, 1) > rnd(i, 20)) c = i & 1 ? EN : KO;
    // Bright, dense letters at the swap, thinning out as they spread.
    const da = lerp(1, 0.6, range(sp, 0, 0.5));
    const ds = lerp(1.9, 1, range(sp, 0, 0.35)) * (1 + 0.3 * rnd(i, 21));

    if (qi < 1) {
      placeSignal(i, f, o);
      o.x = lerp(o.x, x, qi); o.y = lerp(o.y, y, qi);
      o.a = lerp(o.a, da, qi); o.s = lerp(o.s, ds, qi);
      if (qi >= 0.5) o.c = c;
      return;
    }
    o.x = x; o.y = y; o.a = da; o.c = c; o.s = ds;
  },

  draw(ctx, f, alpha) {
    update(f);
    const p = f.p, ko = S.ko, en = S.en;
    const off = f.u * 0.06 + 6;
    const gone = 1 - range(p, B.dissolve[0], B.dissolve[0] + 0.01);
    const quiet = 1 - range(p, B.silence2[0], B.silence2[0] + 0.03);
    const back = S.sync * 0.35 * gone;

    // Places, small mono, under each signal.
    const koMeta = Math.max(range(p, B.koSignal[0], B.koSignal[1]) * quiet * 0.7, back);
    const enMeta = Math.max(range(p, B.enSignal[0], B.enSignal[1]) * quiet * 0.55, back);
    label(ctx, "KO · SEOUL 09:41", ko.x, ko.y + off + 22, alpha * koMeta, PALETTE[KO]);
    label(ctx, "EN · TORONTO 20:41", en.x, en.y + off + 22, alpha * enMeta, PALETTE[EN]);

    // What is said (and what arrives).
    label(ctx, "안녕하세요…", ko.x, ko.y + off, alpha * window01(p, B.koHello[0], B.koHello[1], EDGE) * 0.85, PALETTE[INK], "center", 15);
    label(ctx, "Hello?", en.x, en.y + off, alpha * window01(p, B.enHello[0], B.enHello[1], EDGE) * 0.75, PALETTE[INK], "center", 15);
    label(ctx, "내일 오전에 회의 가능할까요?", ko.x, ko.y + off, alpha * S.ask * 0.85, PALETTE[INK], "center", 15);
    const flick = Math.abs(Math.sin(f.t * 17)) > 0.3 ? 1 : 0.4;
    label(ctx, "…?", en.x, en.y + off, alpha * S.lost * 0.45 * flick, PALETTE[INK], "center", 15);

    // In sync, a hairline through the centre carries the connection.
    const line = alpha * S.sync * gone * 0.08;
    if (line > 0.005) {
      ctx.globalAlpha = line;
      ctx.strokeStyle = PALETTE[INK];
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (f.portrait) { ctx.moveTo(f.w / 2 + 0.5, ko.y + f.u * 0.02); ctx.lineTo(f.w / 2 + 0.5, en.y - f.u * 0.02); }
      else { ctx.moveTo(ko.x + ko.half, ko.y + 0.5); ctx.lineTo(en.x - en.half, en.y + 0.5); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};
