"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import { gsap } from "@/lib/cinematic/gsap";
import { director, isCinematic, subscribeDirector } from "@/lib/cinematic/director";
import { BRIDGE, EN, INK, KO, PALETTE, range, rnd, syllables, window01 } from "@/lib/cinematic/visual";
import { EVENTS, MEMORIES, UTTERANCES, type Speaker } from "./conversation-data";
import { BEATS } from "./beats";
import { conversationLayout, HANDOFF_Y } from "./layout";
import s from "./conversation-signals.module.css";

/**
 * The conversation's signal system (chapter 04) as one quiet SVG: two living waveforms, the nearly
 * invisible bridge between them through the system, and a few mono markers when the system does
 * something (turn end, first audio, interruption, code-switch, context, intent).
 *
 * - Scroll (signalsTimeline) only owns group visibility and the unitless CSS vars of the opening and
 *   handoff (--ok, --hk, --sp); it never touches the elements the time loop writes.
 * - `draw(p, time)` derives everything else from the chapter progress and the shared data
 *   (conversation-data.ts, beats.ts, layout.ts). In film mode a gsap.ticker loop calls it while
 *   chapter 04 is on screen; under reduced motion it is called on scroll with time frozen (a still).
 */

const CHAPTER = 3;
const SPEAKERS: readonly Speaker[] = ["minji", "daniel"];
const C = { ink: PALETTE[INK], ko: PALETTE[KO], en: PALETTE[EN], gold: PALETTE[BRIDGE] };
const SIDE: Record<Speaker, string> = { minji: C.ko, daniel: C.en };
const GLOW = "url(#cs-glow)";
const TAU = Math.PI * 2;
const N_WAVE = 128;
const N_LOCAL = 140;
/** Plain document (no time loop): the still shown when the chapter is not being scrolled. */
const PLAIN: [number, number] = [0.12, 0.93];

// ---------------------------------------------------------------- data-derived moments

const ev = (type: (typeof EVENTS)[number]["type"]) => EVENTS.find((e) => e.type === type)!;
const TURNS = EVENTS.filter((e) => e.type === "turn-end");
const TURN = TURNS[0];
const FIRST = ev("first-audio");
const INTR = ev("interruption");
const CS = ev("code-switch");
const CS_END = (UTTERANCES.find((u) => u.langs.length > 1 && u.start <= CS.at && u.end >= CS.at) ?? { end: CS.at + 0.03 }).end;
const CTX = ev("context");
const CTX_MEM = Math.max(0, MEMORIES.findIndex((m) => m.id === CTX.ref));
const CTX_END = Math.max(CTX.at + 0.03, ...UTTERANCES.filter((u) => u.uses?.includes(CTX.ref ?? "")).map((u) => u.end));
const INTENT = ev("intent");
const INTENT_UTT = UTTERANCES.find((u) => u.source === "human" && u.start <= INTENT.at && u.end + 0.02 >= INTENT.at) ?? UTTERANCES[0];
const INTENT_WORDS = ["오늘은", "어려울", "것 같아요"];
const SEED: Record<string, number> = Object.fromEntries(UTTERANCES.map((u, i) => [u.id, i + 1]));
const H_IN = ["VAD", "STT", "AGENT", "TTS"] as const;

/** One packet per exchange: a person's turn ends → (system) → the voice speaks on the other side. */
type Pair = { from: Speaker; to: Speaker; a: number; c0: number; c1: number; b: number };
const PAIRS: Pair[] = UTTERANCES.filter((v) => v.source === "voice").flatMap((v) => {
  const hu = [...UTTERANCES].reverse().find((u) => u.source === "human" && u.speaker !== v.speaker && u.end <= v.start);
  if (!hu) return [];
  const a = hu.end, b = v.start;
  // The intent moment holds the packet at the centre while the meaning forms above it.
  const intent = INTENT.at >= a && INTENT.at <= b;
  return [{ from: hu.speaker, to: v.speaker, a, b, c0: intent ? INTENT.at : a + 0.4 * (b - a), c1: intent ? b - 0.005 : a + 0.62 * (b - a) }];
});

// ---------------------------------------------------------------- small helpers

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const frac = (x: number) => x - Math.floor(x);
const n1 = (v: number) => (Math.round(v * 10) / 10).toString();
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
type RGB = [number, number, number];
const hex = (c: string): RGB => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as RGB;
const RGBS = { ink: hex(C.ink), ko: hex(C.ko), en: hex(C.en), gold: hex(C.gold) };
const SIDE_RGB: Record<Speaker, RGB> = { minji: RGBS.ko, daniel: RGBS.en };
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

/** Deterministic smooth value noise in [-1, 1]. */
function noise(x: number, seed: number) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(rnd(i, seed), rnd(i + 1, seed), u) * 2 - 1;
}

const env = (x: number) => Math.pow(Math.sin(Math.PI * clamp01(x)), 1.1);

/** A person speaking: a carrier, grain, and syllable-like groups travelling along the line. */
function speechShape(x: number, T: number, seed: number) {
  const ph = seed * 1.93, f1 = 6 + (seed % 3) * 1.5;
  const carrier = 0.6 * Math.sin(TAU * f1 * x - T * 7 + ph) + 0.4 * Math.sin(TAU * f1 * 2.3 * x + T * 10.3 + ph * 1.7);
  const grain = 0.3 * noise(x * 26 - T * 5, seed + 7);
  const groups = 0.3 + 0.7 * (0.5 + 0.5 * noise(x * 4.5 - T * 1.6, seed + 3));
  return (carrier * 0.8 + grain) * groups;
}
/** Voice Labs speaking: smoother, fewer harmonics. */
function voiceShape(x: number, T: number, seed: number) {
  const ph = seed * 1.31;
  return 0.75 * Math.sin(TAU * 4.5 * x - T * 4.6 + ph) + 0.25 * Math.sin(TAU * 8 * x + T * 3.1 + ph);
}
/** Silence: nearly flat, a slow breath. */
const breathShape = (x: number, T: number) => Math.sin(TAU * 2 * x - T * 0.9) * (0.6 + 0.4 * Math.sin(TAU * x + T * 0.5));

type Side = { hw: number; vw: number; hl: number; vl: number; hs: number; vs: number };

/** What each side hears at p: human / voice weights (attack, release, the dead stop of an interruption) and levels. */
function sideState(sp: Speaker, p: number, T: number): Side {
  const o: Side = { hw: 0, vw: 0, hl: 0, vl: 0, hs: 1, vs: 1 };
  for (const u of UTTERANCES) {
    if (u.speaker !== sp || p < u.start || p > u.end + 0.006) continue;
    const att = range(p, u.start, u.start + 0.005);
    const rel = u.interrupted ? 1 - range(p, u.end, u.end + 0.004) : 1 - range(p, u.end - 0.006, u.end + 0.002);
    const w = att * rel, seed = SEED[u.id];
    if (u.source === "human" && w > o.hw) {
      o.hw = w; o.hs = seed;
      o.hl = w * (0.22 + 0.78 * syllables(T * 0.8 + u.start * 50, seed));
    } else if (u.source === "voice" && w > o.vw) {
      o.vw = w; o.vs = seed;
      o.vl = w * (0.62 + 0.38 * (0.5 + 0.5 * Math.sin(T * 2.2 + seed)));
    }
  }
  return o;
}

function waveAt(x: number, S: Side, amp: number, T: number) {
  const breath = (1.6 + 0.6 * Math.sin(T * 1.3)) * (1 - Math.min(1, S.hw + S.vw));
  let y = breath * breathShape(x, T);
  if (S.hl > 0.001) y += amp * S.hl * speechShape(x, T, S.hs);
  if (S.vl > 0.001) y += amp * 0.68 * S.vl * voiceShape(x, T, S.vs);
  return y * env(x);
}

function pathD(x0: number, x1: number, y0: number, n: number, fy: (x: number) => number) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    d += (i ? "L" : "M") + n1(lerp(x0, x1, x)) + " " + n1(y0 + fy(x));
  }
  return d;
}

// ---------------------------------------------------------------- composition

type Pt = { x: number; y: number };
type Anchor = "start" | "middle" | "end";

function compose(w: number, h: number) {
  const L = conversationLayout(w, h);
  const P = L.portrait;
  const amp = P ? Math.min(h * 0.032, 26) : Math.min(h * 0.048, 42);
  const gap = 12;
  const c = L.centre;
  const ends = {
    minji: { x0: L.minji.x - L.wave, x1: L.minji.x + L.wave, y: L.minji.y },
    daniel: { x0: L.daniel.x - L.wave, x1: L.daniel.x + L.wave, y: L.daniel.y },
  };
  const mIn: Pt = P ? { x: L.minji.x, y: L.minji.y + amp + gap } : { x: L.minji.x + L.wave + gap, y: L.minji.y };
  const dIn: Pt = P ? { x: L.daniel.x, y: L.daniel.y - amp - gap } : { x: L.daniel.x - L.wave - gap, y: L.daniel.y };

  const tick = (sp: Speaker) => {
    const x = P || sp === "minji" ? ends[sp].x1 : ends[sp].x0;
    return { x, y: ends[sp].y, anchor: (P || sp === "minji" ? "end" : "start") as Anchor };
  };

  const bw = P ? Math.min(w * 0.2, 70) : 84;
  const bracket = { x0: c.x - bw, x1: c.x + bw, y: c.y + (P ? 64 : 36) };
  const mem = MEMORIES.map((_, i) =>
    P ? { x: c.x + 14, y: c.y - 18 + i * 15, anchor: "start" as Anchor } : { x: c.x, y: c.y + 72 + i * 16, anchor: "middle" as Anchor },
  );
  const m = mem[CTX_MEM] ?? { x: c.x, y: c.y };
  const memAt: Pt = P ? { x: m.x - 4, y: m.y - 3 } : { x: m.x, y: m.y - 11 };

  const iy = c.y - (P ? 62 : 74);
  const fdx = P ? Math.min(w * 0.17, 64) : 66;
  const frags: Pt[] = [-1, 0, 1].map((k) => ({ x: c.x + k * fdx, y: iy }));
  const itop: Pt = { x: c.x, y: iy - 8 };

  const vars = {
    "--ox1": `${n1(ends.minji.x0)}px`,
    "--oy0": `${n1(HANDOFF_Y * h)}px`,
    "--oy1": `${n1(ends.minji.y)}px`,
    "--os1": (2 * L.wave) / w,
    "--hx0": `${n1(ends.daniel.x0)}px`,
    "--hy0": `${n1(ends.daniel.y)}px`,
    "--hy1": `${n1(h / 2)}px`,
    "--hs0": (2 * L.wave) / w,
  } as CSSProperties;

  return {
    w, h, P, amp, c, ends, mIn, dIn, tick, bracket, mem, memAt, frags, itop, vars,
    layerY: P ? [-21, -7, 7, 21] : [-30, -10, 10, 30],
    ctxLabel: P ? { x: c.x - 14, y: c.y + 4, anchor: "end" as Anchor } : { x: c.x, y: c.y + 52, anchor: "middle" as Anchor },
    cutLabel: P ? { x: mIn.x + 12, y: mIn.y + 3 } : { x: mIn.x + 4, y: mIn.y - 16 },
    csLabel: P ? { x: ends.minji.x0, y: ends.minji.y + amp + 18, anchor: "start" as Anchor } : { x: L.minji.x, y: ends.minji.y + amp + 22, anchor: "middle" as Anchor },
  };
}

type Layout = ReturnType<typeof compose>;

const bridgeAt = (G: Layout, sPos: number): Pt => {
  if (sPos <= 0.5) { const t = sPos * 2; return { x: lerp(G.mIn.x, G.c.x, t), y: lerp(G.mIn.y, G.c.y, t) }; }
  const t = (sPos - 0.5) * 2;
  return { x: lerp(G.c.x, G.dIn.x, t), y: lerp(G.c.y, G.dIn.y, t) };
};
const SPOS: Record<Speaker, number> = { minji: 0, daniel: 1 };

// ---------------------------------------------------------------- live elements

type El = SVGElement | null;
type Live = {
  wave: Record<Speaker, El>;
  stops: Record<Speaker, SVGElement[]>;
  streak: SVGElement[];
  pk: El; pkCore: El; ring: El;
  dots: SVGElement[];
  ticks: SVGElement[];
  bracket: El; bracketPath: El; bracketL: El; bracketR: El;
  cut: El; csLabel: El;
  mem: SVGElement[]; ctx: SVGElement[]; ctxLabel: El;
  frag: SVGElement[]; ipt: SVGElement[]; iline: SVGElement[]; ione: El; ilabel: El;
  open: El; hand: SVGElement[];
};

const setA = (el: Element | null | undefined, k: string, v: string) => { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };
const op = (el: Element | null | undefined, v: number) => setA(el, "opacity", v < 0.004 ? "0" : v.toFixed(3));
const at = (el: Element | null | undefined, q: Pt) => setA(el, "transform", `translate(${n1(q.x)} ${n1(q.y)})`);

/** Writes one frame: everything that depends on chapter progress p and (film only) time. */
function draw(E: Live, G: Layout, p: number, time: number) {
  const T = time + p * 60;
  const side = { minji: sideState("minji", p, T), daniel: sideState("daniel", p, T) };

  // 1 · the two waveforms, voice tinted gold, the code-switch blend inside Minji's.
  for (const sp of SPEAKERS) {
    const S = side[sp], e = G.ends[sp];
    setA(E.wave[sp], "d", pathD(e.x0, e.x1, e.y, N_WAVE, (x) => waveAt(x, S, G.amp, T)));
    setA(E.wave[sp], "stroke-opacity", (0.55 + 0.45 * Math.max(S.hw, S.vw)).toFixed(2));
    setA(E.wave[sp], "stroke-width", S.vw > S.hw ? "1.2" : "1.4");
    const base = mixRGB(SIDE_RGB[sp], RGBS.gold, 0.45 * S.vw);
    let mid = base, cc = 0.5;
    if (sp === "minji") {
      const k = window01(p, CS.at - 0.003, CS_END, 0.006) * S.hw;
      mid = mixRGB(base, RGBS.en, 0.85 * k);
      cc = 0.28 + 0.44 * range(p, CS.at - 0.01, CS_END);
    }
    const offs = [0, Math.max(0, cc - 0.2), cc, Math.min(1, cc + 0.2), 1];
    E.stops[sp].forEach((st, i) => {
      setA(st, "offset", offs[i].toFixed(3));
      setA(st, "stop-color", css(i === 2 ? mid : base));
    });
  }

  // 2 · the bridge: one packet per exchange, a pause (gold pulse) at the centre; the interruption reverses it.
  let ps = -1, pdir = 0, pop = 0, pcol: RGB = RGBS.gold, ring = -1;
  for (const pr of PAIRS) {
    if (p < pr.a || p > pr.b) continue;
    const o = SPOS[pr.from], d = SPOS[pr.to];
    pop = range(p, pr.a, pr.a + 0.002) * (1 - range(p, pr.b - 0.002, pr.b));
    if (p < pr.c0) {
      const k = easeInOut(clamp01((p - pr.a) / (pr.c0 - pr.a)));
      ps = lerp(o, 0.5, k); pdir = Math.sign(0.5 - o); pcol = mixRGB(SIDE_RGB[pr.from], RGBS.gold, k);
    } else if (p < pr.c1) {
      ps = 0.5; pcol = RGBS.gold;
      const n = Math.max(1, Math.round((pr.c1 - pr.c0) / 0.007));
      ring = frac(((p - pr.c0) / (pr.c1 - pr.c0)) * n);
      // While the intent forms above the centre the packet waits, dim.
      if (pr.c1 - pr.c0 > 0.008) pop *= 0.35 + 0.65 * range(p, pr.c1 - 0.003, pr.c1);
    } else {
      const k = easeInOut(clamp01((p - pr.c1) / (pr.b - pr.c1)));
      ps = lerp(0.5, d, k); pdir = Math.sign(d - 0.5); pcol = mixRGB(RGBS.gold, SIDE_RGB[pr.to], k);
    }
    break;
  }
  const r0 = INTR.at, r1 = INTR.at + 0.016;
  if (p >= r0 && p < r1 + 0.01) {
    if (p < r1) {
      const k = easeInOut((p - r0) / (r1 - r0));
      ps = lerp(0.12, 0.5, k); pdir = 1; pcol = mixRGB(mixRGB(RGBS.ko, RGBS.gold, 0.5), RGBS.ko, k); pop = 1;
    } else {
      ps = 0.5; pdir = 0; pcol = RGBS.gold; pop = 1 - range(p, r1 + 0.006, r1 + 0.01); ring = (p - r1) / 0.01;
    }
  }
  if (ps >= 0 && pop > 0.004) {
    at(E.pk, bridgeAt(G, ps));
    setA(E.pkCore, "fill", css(pcol));
  }
  op(E.pk, ps >= 0 ? pop : 0);
  op(E.ring, ring >= 0 ? (1 - ring) * 0.7 * Math.max(pop, 0.5) : 0);
  if (ring >= 0) setA(E.ring, "r", (3 + 9 * ring).toFixed(2));

  // the lit streak behind the packet
  const SL = 0.28;
  E.streak.forEach((el, i) => {
    const on = ps >= 0 && pdir !== 0 && (i === 0 ? ps < 0.5 : ps > 0.5);
    if (!on) return op(el, 0);
    const t = i === 0 ? ps * 2 : (ps - 0.5) * 2;
    setA(el, "stroke-dashoffset", (pdir > 0 ? SL - t : -t).toFixed(3));
    setA(el, "stroke", css(pcol));
    op(el, pop * 0.55);
  });

  // a faint stream from the centre to whoever is hearing the voice
  const vSide = side.minji.vw > side.daniel.vw ? "minji" : "daniel";
  const vw = side[vSide].vw;
  const ts = time * 0.55 + p * 40;
  E.dots.forEach((el, i) => {
    if (vw < 0.01) return op(el, 0);
    const k = frac(ts + i / E.dots.length);
    at(el, bridgeAt(G, lerp(0.5, SPOS[vSide], k)));
    setA(el, "fill", css(mixRGB(RGBS.gold, SIDE_RGB[vSide], 0.6)));
    op(el, vw * Math.sin(Math.PI * k) * 0.5);
  });

  // 3 · turn markers
  TURNS.forEach((e, i) => op(E.ticks[i], range(p, e.at, e.at + 0.004) * (1 - range(p, e.at + 0.03, e.at + 0.04))));

  // 4 · timing: TURN DETECTED … FIRST AUDIO
  op(E.bracket, range(p, TURN.at - 0.002, TURN.at + 0.002) * (1 - range(p, FIRST.at + 0.03, FIRST.at + 0.05)));
  setA(E.bracketPath, "stroke-dashoffset", (1 - clamp01((p - TURN.at) / (FIRST.at - TURN.at))).toFixed(3));
  op(E.bracketL, range(p, TURN.at, TURN.at + 0.004));
  op(E.bracketR, range(p, FIRST.at - 0.001, FIRST.at + 0.003));

  // 5 · interruption: × where the voice was cut, the marker
  op(E.cut, range(p, INTR.at, INTR.at + 0.002) * (1 - range(p, INTR.at + 0.04, INTR.at + 0.05)));

  // 6 · code-switch
  op(E.csLabel, window01(p, CS.at, CS_END, 0.005));

  // 7 · context / memory
  const lit = window01(p, CTX.at - 0.005, CTX_END, 0.008);
  MEMORIES.forEach((mm, i) => {
    const el = E.mem[i];
    const seen = range(p, mm.at, mm.at + 0.01);
    let o = seen * (0.28 + 0.2 * (1 - range(p, mm.at + 0.02, mm.at + 0.04)));
    if (i === CTX_MEM) o = lerp(o, 0.95, lit);
    else if (p > CTX.at && mm.at < CTX.at) o *= 1 - 0.45 * range(p, CTX.at, CTX.at + 0.01);
    op(el, o);
    setA(el, "fill", css(i === CTX_MEM ? mixRGB(RGBS.ink, RGBS.gold, lit) : RGBS.ink));
  });
  const ctxDraw = [range(p, CTX.at - 0.007, CTX.at + 0.005), range(p, CTX.at + 0.005, CTX_END - 0.03)];
  E.ctx.forEach((el, i) => {
    setA(el, "stroke-dashoffset", (1 - ctxDraw[i]).toFixed(3));
    op(el, (i === 0 ? 0.55 : 0.3) * lit);
  });
  op(E.ctxLabel, window01(p, CTX.at, CTX_END, 0.006) * 0.9);

  // 8 · intent: words → linked points → one point → the outgoing packet
  if (p > INTENT_UTT.start - 0.01 && p < INTENT.at + 0.04) {
    const gone = range(p, INTENT.at, INTENT.at + 0.004);
    const col = range(p, INTENT.at + 0.004, INTENT.at + 0.008);
    const pts = G.frags.map((f) => ({ x: lerp(f.x, G.itop.x, col), y: lerp(f.y + 10, G.itop.y, col) }));
    E.frag.forEach((el, i) => op(el, range(p, INTENT_UTT.start + 0.005 + i * 0.008, INTENT_UTT.start + 0.011 + i * 0.008) * (1 - gone)));
    const ptO = gone * (1 - range(p, INTENT.at + 0.007, INTENT.at + 0.009));
    E.ipt.forEach((el, i) => { at(el, pts[i]); op(el, ptO); });
    E.iline.forEach((el, i) => {
      const a = pts[i], b = pts[(i + 1) % 3];
      setA(el, "d", `M${n1(a.x)} ${n1(a.y)}L${n1(b.x)} ${n1(b.y)}`);
      op(el, ptO * (1 - col) * 0.5);
    });
    const drop = range(p, INTENT.at + 0.008, INTENT.at + 0.011);
    at(E.ione, { x: lerp(G.itop.x, G.c.x, drop), y: lerp(G.itop.y, G.c.y, drop) });
    op(E.ione, range(p, INTENT.at + 0.006, INTENT.at + 0.008) * (1 - range(p, INTENT.at + 0.01, INTENT.at + 0.012)));
    op(E.ilabel, window01(p, INTENT.at + 0.002, INTENT.at + 0.035, 0.005));
  } else {
    [...E.frag, ...E.ipt, ...E.iline, E.ione, E.ilabel].forEach((el) => op(el, 0));
  }

  // 10 · opening: chapter 03's full-width wave, organic as it contracts into Minji's line, magenta → cyan.
  const [, e1] = BEATS.enter;
  if (p < e1 + 0.01 && E.open) {
    const grow = Math.sin(Math.PI * range(p, 0, e1 * 0.9));
    const S = side.minji;
    setA(E.open, "d", pathD(0, G.w, 0, N_LOCAL, (x) => waveAt(x, S, G.amp, T) + env(x) * 5 * grow * voiceShape(x, T, 2)));
    setA(E.open, "stroke", css(mixRGB(RGBS.en, RGBS.ko, range(p, e1 * 0.12, e1 * 0.88))));
  }

  // 11 · handoff: Daniel's line becomes one signal across the screen, then four layers (VAD · STT · AGENT · TTS).
  const h0 = BEATS.handoff[0];
  if (p > h0 - 0.01 && E.hand.length) {
    const lift = Math.sin(Math.PI * range(p, h0, 0.99)) * 0.55 + 0.15;
    const S = side.daniel;
    const d = pathD(0, G.w, 0, N_LOCAL, (x) => waveAt(x, S, G.amp, T) + env(x) * G.amp * 0.22 * lift * voiceShape(x, T, 5));
    E.hand.forEach((el) => setA(el, "d", d));
  }
}

// ---------------------------------------------------------------- component

/** The conversation's signal SVG: absolute, inset 0, pointer-events none, aria-hidden (plain document: a static figure in flow). */
export function ConversationSignals(): JSX.Element {
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const G = useMemo(() => compose(size.w, size.h), [size.w, size.h]);
  const svgRef = useRef<SVGSVGElement>(null);
  const layoutRef = useRef<Layout>(G);
  const live = useRef<Live | null>(null);
  const filmRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      setSize((o) => (o.w === window.innerWidth && o.h === window.innerHeight ? o : { w: window.innerWidth, h: window.innerHeight }));
    };
    const onResize = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const still = () => {
    const E = live.current;
    if (!E) return;
    const p = director.position - CHAPTER;
    draw(E, layoutRef.current, filmRef.current ? clamp01(p) : Math.min(PLAIN[1], Math.max(PLAIN[0], p)), 0);
  };

  // Re-collect the live elements whenever the geometry re-renders, and draw once.
  useEffect(() => {
    layoutRef.current = G;
    const svg = svgRef.current;
    if (!svg) return;
    const one = (k: string) => svg.querySelector<SVGElement>(`[data-cs-live="${k}"]`);
    const all = (k: string) => Array.from(svg.querySelectorAll<SVGElement>(`[data-cs-live="${k}"]`));
    live.current = {
      wave: { minji: one("wave-minji"), daniel: one("wave-daniel") },
      stops: { minji: all("stop-minji"), daniel: all("stop-daniel") },
      streak: all("streak"),
      pk: one("pk"), pkCore: one("pk-core"), ring: one("ring"),
      dots: all("dot"),
      ticks: all("tick"),
      bracket: one("bracket"), bracketPath: one("bracket-path"), bracketL: one("bracket-l"), bracketR: one("bracket-r"),
      cut: one("cut"), csLabel: one("cs"),
      mem: all("mem"), ctx: all("ctx"), ctxLabel: one("ctx-label"),
      frag: all("frag"), ipt: all("ipt"), iline: all("iline"), ione: one("ione"), ilabel: one("ilabel"),
      open: one("open"), hand: all("hand"),
    };
    still();
  }, [G]);

  // Life: only while chapter 04 is on screen, never under reduced motion. Reduced motion: a still per scroll update.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const film = isCinematic() && !reduced;
    filmRef.current = film;
    if (!film) return subscribeDirector(() => still());
    let running = false;
    const tick = (time: number) => {
      const E = live.current;
      if (E) draw(E, layoutRef.current, clamp01(director.position - CHAPTER), time);
    };
    const unsubscribe = subscribeDirector((_, chapter) => {
      const on = chapter === CHAPTER;
      if (on && !running) { gsap.ticker.add(tick); running = true; }
      else if (!on && running) { gsap.ticker.remove(tick); running = false; }
    });
    return () => { unsubscribe(); if (running) gsap.ticker.remove(tick); };
  }, []);

  const { w, h, c, ends, mIn, dIn, bracket, mem, memAt, frags, itop, vars } = G;
  const initial = useMemo(() => {
    const p = 0.12, T = p * 60;
    return Object.fromEntries(SPEAKERS.map((sp) => {
      const e = G.ends[sp], S = sideState(sp, p, T);
      return [sp, pathD(e.x0, e.x1, e.y, N_WAVE, (x) => waveAt(x, S, G.amp, T))];
    })) as Record<Speaker, string>;
  }, [G]);
  const segA = `M${n1(mIn.x)} ${n1(mIn.y)}L${n1(c.x)} ${n1(c.y)}`;
  const segB = `M${n1(c.x)} ${n1(c.y)}L${n1(dIn.x)} ${n1(dIn.y)}`;
  const flat = `M0 0L${w} 0`;

  return (
    <svg ref={svgRef} className={s.svg} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false" data-portrait={G.P || undefined} style={vars}>
      <defs>
        <filter id="cs-glow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {SPEAKERS.map((sp) => (
          <linearGradient key={sp} id={`cs-g-${sp}`} gradientUnits="userSpaceOnUse" x1={ends[sp].x0} y1={ends[sp].y} x2={ends[sp].x1} y2={ends[sp].y}>
            {[0, 0.3, 0.5, 0.7, 1].map((o, i) => <stop key={i} data-cs-live={`stop-${sp}`} offset={o} stopColor={SIDE[sp]} />)}
          </linearGradient>
        ))}
      </defs>

      {/* 10 · opening: chapter 03's last frame (full width at HANDOFF_Y) contracts into Minji's wave. */}
      <g data-cs="open" className={`${s.filmOnly} ${s.open}`}>
        <path data-cs-live="open" className={s.stroke} d={flat} stroke={C.en} strokeWidth={1.2} />
      </g>

      <g data-cs="conv">
        {/* 2 · the invisible bridge */}
        <g data-cs="bridge">
          <path data-cs-draw="" className={s.stroke} d={segA} stroke={C.ink} strokeOpacity={0.1} strokeWidth={1} pathLength={1} strokeDasharray="1 1" />
          <path data-cs-draw="" className={s.stroke} d={segB} stroke={C.ink} strokeOpacity={0.1} strokeWidth={1} pathLength={1} strokeDasharray="1 1" />
          <circle cx={c.x} cy={c.y} r={1.6} fill={C.gold} opacity={0.3} />
          {[segA, segB].map((d, i) => (
            <path key={i} data-cs-live="streak" className={s.stroke} d={d} stroke={C.gold} strokeWidth={1.2} pathLength={1} strokeDasharray="0.28 3" opacity={0} />
          ))}
          <path data-cs-live="ctx" className={s.stroke} d={`M${n1(memAt.x)} ${n1(memAt.y)}L${n1(c.x)} ${n1(c.y)}L${n1(mIn.x)} ${n1(mIn.y)}`} stroke={C.gold} strokeWidth={1} pathLength={1} strokeDasharray="1 1" opacity={0} />
          <path data-cs-live="ctx" className={s.stroke} d={segB} stroke={C.gold} strokeWidth={1} pathLength={1} strokeDasharray="1 1" opacity={0} />
          <circle data-cs-live="ring" className={s.stroke} cx={c.x} cy={c.y} r={3} stroke={C.gold} strokeWidth={1} opacity={0} />
          {[0, 1].map((i) => <circle key={i} data-cs-live="dot" r={1.6} fill={C.gold} filter={GLOW} transform="translate(-40 -40)" opacity={0} />)}
          <g data-cs-live="pk" transform="translate(-40 -40)" opacity={0}>
            <circle data-cs-live="pk-core" r={2.8} fill={C.gold} filter={GLOW} />
          </g>
        </g>

        {/* 1 · the two waveforms */}
        {SPEAKERS.map((sp) => (
          <g key={sp} data-cs={sp}>
            <path data-cs-live={`wave-${sp}`} className={s.stroke} d={initial[sp]} stroke={`url(#cs-g-${sp})`} strokeWidth={1.4} />
          </g>
        ))}

        {/* 3 · turn markers */}
        {TURNS.map((e, i) => {
          const t = G.tick(e.speaker ?? "minji");
          return (
            <g key={i} data-cs-live="tick" opacity={0}>
              <path className={s.stroke} d={`M${n1(t.x)} ${n1(t.y - 9)}L${n1(t.x)} ${n1(t.y + 9)}`} stroke={C.gold} strokeWidth={1.2} />
              <text className={s.label} x={t.x} y={t.y + 22} textAnchor={t.anchor} dominantBaseline="hanging">{e.label}</text>
            </g>
          );
        })}

        {/* 4 · timing bracket (no numbers) */}
        <g data-cs-live="bracket" opacity={0}>
          <path
            data-cs-live="bracket-path"
            className={s.stroke}
            d={`M${n1(bracket.x0)} ${n1(bracket.y - 4)}L${n1(bracket.x0)} ${n1(bracket.y)}L${n1(bracket.x1)} ${n1(bracket.y)}L${n1(bracket.x1)} ${n1(bracket.y - 4)}`}
            stroke={C.ink}
            strokeOpacity={0.5}
            strokeWidth={1}
            pathLength={1}
            strokeDasharray="1 1"
          />
          <text data-cs-live="bracket-l" className={s.label} x={bracket.x0} y={bracket.y - 10} textAnchor="start" opacity={0}>TURN DETECTED</text>
          <text data-cs-live="bracket-r" className={s.label} x={bracket.x1} y={bracket.y + 8} textAnchor="end" dominantBaseline="hanging" opacity={0}>{FIRST.label}</text>
        </g>

        {/* 5 · interruption */}
        <g data-cs-live="cut" opacity={0}>
          <path className={s.stroke} d={`M${n1(mIn.x - 3.5)} ${n1(mIn.y - 3.5)}L${n1(mIn.x + 3.5)} ${n1(mIn.y + 3.5)}M${n1(mIn.x + 3.5)} ${n1(mIn.y - 3.5)}L${n1(mIn.x - 3.5)} ${n1(mIn.y + 3.5)}`} stroke={C.gold} strokeWidth={1.3} />
          <text className={s.label} x={G.cutLabel.x} y={G.cutLabel.y} textAnchor="start" dominantBaseline="middle">{INTR.label}</text>
        </g>

        {/* 6 · code-switch */}
        <text data-cs-live="cs" className={s.label} x={G.csLabel.x} y={G.csLabel.y} textAnchor={G.csLabel.anchor} dominantBaseline="hanging" opacity={0}>{CS.label}</text>

        {/* 7 · memory */}
        {MEMORIES.map((m, i) => (
          <text key={m.id} data-cs-live="mem" className={s.mem} x={mem[i].x} y={mem[i].y} textAnchor={mem[i].anchor} dominantBaseline="middle" fill={C.ink} opacity={0}>{m.text}</text>
        ))}
        <text data-cs-live="ctx-label" className={s.label} x={G.ctxLabel.x} y={G.ctxLabel.y} textAnchor={G.ctxLabel.anchor} dominantBaseline="middle" opacity={0}>{CTX.label}</text>

        {/* 8 · intent */}
        {INTENT_WORDS.map((t, i) => (
          <text key={t} data-cs-live="frag" className={s.token} x={frags[i].x} y={frags[i].y} textAnchor="middle" opacity={0}>{t}</text>
        ))}
        {[0, 1, 2].map((i) => <path key={i} data-cs-live="iline" className={s.stroke} d="M0 0L0 0" stroke={C.gold} strokeWidth={1} opacity={0} />)}
        {[0, 1, 2].map((i) => <circle key={i} data-cs-live="ipt" r={1.9} fill={C.gold} transform="translate(-40 -40)" opacity={0} />)}
        <circle data-cs-live="ione" r={2.6} fill={C.gold} filter={GLOW} transform="translate(-40 -40)" opacity={0} />
        <text data-cs-live="ilabel" className={s.label} x={itop.x} y={itop.y - 16} textAnchor="middle" opacity={0}>{INTENT.label}</text>
      </g>

      {/* 11 · handoff: one signal → four layers; chapter 05 takes over. */}
      <g data-cs="handoff" className={`${s.filmOnly} ${s.handoff}`}>
        <path data-cs-live="hand" data-cs-h="base" className={s.stroke} d={flat} stroke={C.en} strokeWidth={1.3} />
        {H_IN.map((name, i) => (
          <g key={name} className={s.layer} style={{ "--ly": `${G.layerY[i]}px` } as CSSProperties}>
            <path data-cs-live="hand" data-cs-h="layer" className={s.stroke} d={flat} stroke={[C.ink, C.ko, C.gold, C.en][i]} strokeOpacity={0.7} strokeWidth={1} />
            <text data-cs-h="label" className={s.faint} x={w * 0.04} y={-5}>{name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------- scroll timeline

/** Adds the scroll-scrubbed SVG tweens to the chapter timeline (positions = chapter progress). */
export function signalsTimeline(tl: gsap.core.Timeline, q: (s: string) => Element[]): void {
  const fromTo = (sel: string, from: gsap.TweenVars, to: gsap.TweenVars, pos: number) => {
    const t = q(sel);
    if (t.length) tl.fromTo(t, from, to, pos);
  };
  const to = (sel: string, vars: gsap.TweenVars, pos: number) => {
    const t = q(sel);
    if (t.length) tl.to(t, vars, pos);
  };
  const ease = "power2.inOut";
  const [, e1] = BEATS.enter;
  const [hl0] = BEATS.headline;
  const [h0] = BEATS.handoff;

  // opening (0–0.08): the full-width magenta wave contracts into Minji's line; Daniel and the bridge appear.
  fromTo('[data-cs="open"]', { "--ok": 0 }, { "--ok": 1, duration: e1 * 0.82, ease }, 0);
  fromTo('[data-cs="open"]', { opacity: 1 }, { opacity: 0, duration: 0.012 }, e1 - 0.012);
  fromTo('[data-cs="minji"]', { opacity: 0 }, { opacity: 1, duration: 0.014 }, e1 - 0.016);
  fromTo('[data-cs="daniel"]', { opacity: 0 }, { opacity: 1, duration: 0.04 }, e1 * 0.4);
  fromTo("[data-cs-draw]", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.04, stagger: 0.01 }, e1 * 0.5);

  // headline: everything dims under the typography; the waves keep breathing.
  to('[data-cs="conv"]', { opacity: 0.4, duration: 0.018 }, hl0);

  // handoff: Daniel's line → one full-width signal at mid-height (chapter 05's VOICE IN) → four layers → gone by ~0.995.
  to('[data-cs="conv"]', { opacity: 0, duration: 0.012 }, h0);
  fromTo('[data-cs="handoff"]', { opacity: 0 }, { opacity: 1, duration: 0.004 }, h0);
  fromTo('[data-cs="handoff"]', { "--hk": 0 }, { "--hk": 1, duration: 0.02, ease }, h0 + 0.002);
  fromTo('[data-cs="handoff"]', { "--sp": 0 }, { "--sp": 1, duration: 0.02, ease }, h0 + 0.022);
  to('[data-cs-h="base"]', { opacity: 0.25, duration: 0.014 }, h0 + 0.022);
  fromTo('[data-cs-h="layer"]', { opacity: 0 }, { opacity: 1, duration: 0.012, stagger: 0.002 }, h0 + 0.02);
  fromTo('[data-cs-h="label"]', { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: 0.002 }, h0 + 0.03);
  to('[data-cs="handoff"]', { opacity: 0, duration: 0.01 }, 0.985);
}
