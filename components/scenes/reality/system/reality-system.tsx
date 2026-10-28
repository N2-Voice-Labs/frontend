"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import { C, GLOW, makeTw, s } from "@/components/scenes/engine/system/shared";
import { director, isCinematic, subscribeDirector } from "@/lib/cinematic/director";
import { gsap } from "@/lib/cinematic/gsap";
import { endSpan } from "@/components/scenes/world/system/geometry";
import { lerp, range } from "@/lib/cinematic/visual";
import { BEATS, PIPELINE, REVEAL_AT, clockAt } from "../beats";
import { stateAt, ticks, type State } from "../conversation-engine";
import { DURATION, SCRIPT, type Speaker } from "../conversation-events";
import { LANE, n2, realityLayout, type Layout } from "./layout";
import { blinkAt, portraitPaths } from "./portrait";
import rs from "./reality-system.module.css";

/**
 * Chapter 07's stage: two graphite portraits facing each other, one signal from mouth to mouth.
 *
 * - Everything conversational (waveforms, lips, graphite, packets, markers, the timeline, and the DOM
 *   lines and labels of the scene) is drawn from ONE engine state per frame: stateAt(clock), where the
 *   clock is the scroll mapped onto the conversation, or, during a live session, the real audio levels.
 * - The scroll timeline only does the macro moves (opacity, the brief pull toward the centre, the bridge).
 * - Time (gsap.ticker) runs only while chapter 07 is on screen and never under reduced motion; the still
 *   figure (plain document / reduced motion) is Minji's first question, portraits at rest.
 */

const CHAPTER = 6;
const STILL_T = 2.4;
const TICKS = ticks();
const PK = 7;
const WN = 70;

/** Live session levels (your microphone on the left, the agent on the right), set by the scene. */
export const liveLevels = { on: false };

type Els = Record<string, Element | null>;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const setA = (el: Element | null | undefined, k: string, v: string) => { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };
const op = (el: Element | null | undefined, v: number) => setA(el, "opacity", v <= 0.003 ? "0" : v.toFixed(3));

/**
 * Where the signal is at s. On entry (pre < 1) it still lies on chapter 06's last line (straight, screen
 * centre, endSpan) and eases onto the stage's mouth-to-mouth signal.
 */
function sigAt(L: Layout, s: number, pre: number) {
  const q = L.at(s);
  if (pre >= 1) return q;
  const { x0, x1 } = endSpan(L.w);
  return { x: lerp(x0 + (x1 - x0) * s, q.x, pre), y: lerp(L.h / 2, q.y, pre), nx: lerp(0, q.nx, pre), ny: lerp(-1, q.ny, pre) };
}

function laneWave(L: Layout, s0: number, s1: number, amp: number, t: number, seed: number, toward: 1 | -1, pre: number) {
  let d = "";
  for (let i = 0; i <= WN; i++) {
    const x = i / WN, q = sigAt(L, s0 + (s1 - s0) * x, pre);
    // Strongest near the mouth it leaves, thinning toward the middle.
    const env = Math.sin(Math.PI * x) ** 0.8 * (toward > 0 ? 1 - 0.55 * x : 0.45 + 0.55 * x);
    const v = amp * env * (0.6 * Math.sin(x * 46 - t * 9 + seed) + 0.4 * Math.sin(x * 97 + t * 13 + seed * 2));
    d += (i ? "L" : "M") + n2(q.x + q.nx * v) + " " + n2(q.y + q.ny * v);
  }
  return d;
}

export function RealitySystem({ live = false }: { live?: boolean }): JSX.Element {
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const L = useMemo(() => realityLayout(size.w, size.h), [size.w, size.h]);
  const svgRef = useRef<SVGSVGElement>(null);
  const LRef = useRef(L);
  const filmRef = useRef(false);
  const els = useRef<Els>({});
  const dom = useRef<{ lines: HTMLElement[]; parts: Map<string, HTMLElement[]>; langs: Record<Speaker, HTMLElement | null>; names: Record<Speaker, HTMLElement | null> }>({ lines: [], parts: new Map(), langs: { minji: null, daniel: null }, names: { minji: null, daniel: null } });
  const cache = useRef<Record<string, string>>({});
  liveLevels.on = live;

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

  /** One frame: p = chapter progress, tw = wall seconds (oscillation), still = the plain figure. */
  const paint = (p: number, tw: number, still: boolean) => {
    const L = LRef.current, E = els.current, D = dom.current;
    const t = still ? STILL_T : clockAt(p);
    let S: State = stateAt(t);
    if (liveLevels.on) {
      // A live session: your voice on the left, the agent's on the right; the rest of the script is quiet.
      const you = director.level.you, agent = director.level.agent;
      S = { ...stateAt(-1), minji: { ...S.minji, speak: you, hear: 0 }, daniel: { ...S.daniel, speak: agent, hear: 0 }, presence: 0.4,
        flows: you > 0.05 ? [{ from: "minji", phase: "in", k: (tw * 0.6) % 1, strength: you }] : agent > 0.05 ? [{ from: "daniel", phase: "in", k: (tw * 0.6) % 1, strength: agent }] : [] };
    }
    const merge = still ? 0 : range(p, BEATS.exit[0], BEATS.exit[0] + 0.045);
    // After the thesis the two voices move together, connected, until they meet.
    const together = still || liveLevels.on ? 0 : range(p, BEATS.brand[0], BEATS.brand[0] + 0.03);
    if (together > 0) {
      const v = together * (0.35 + 0.15 * Math.sin(tw * 1.3));
      S = { ...S, minji: { ...S.minji, hear: Math.max(S.minji.hear, v) }, daniel: { ...S.daniel, hear: Math.max(S.daniel.hear, v) } };
    }
    const ttw = still ? 1 : tw;
    const pre = still ? 1 : range(p, 0.004, 0.05);
    if (pre < 1 || cache.current.base !== "1") {
      let d = "";
      for (let i = 0; i <= 120; i++) { const q = sigAt(L, i / 120, pre); d += (i ? "L" : "M") + n2(q.x) + " " + n2(q.y); }
      setA(E.base, "d", d);
      const c = sigAt(L, 0.5, pre);
      setA(E["mid-dot"], "cx", n2(c.x)); setA(E["mid-dot"], "cy", n2(c.y));
      cache.current.base = pre < 1 ? "0" : "1";
    }

    // Portraits: lips with the voice, graphite boiling faster while speaking, eyes blinking, a slow drift.
    for (const who of ["minji", "daniel"] as const) {
      const st = S[who];
      const open = clamp01(st.speak * 1.25);
      const epoch = still ? 1 : Math.floor(tw * (st.speak > 0.08 ? 9 : 1.1));
      const blink = still ? 0 : blinkAt(who, tw);
      const key = `${who}:${epoch}:${open.toFixed(2)}:${blink.toFixed(2)}`;
      if (cache.current[who] !== key) {
        cache.current[who] = key;
        const P = portraitPaths(who, { open, blink, epoch });
        setA(E[`${who}-main`], "d", P.main);
        setA(E[`${who}-soft`], "d", P.soft);
        setA(E[`${who}-hatch`], "d", P.hatch);
        setA(E[`${who}-eye`], "d", P.eye);
        setA(E[`${who}-mouth`], "d", P.mouth);
      }
      const h = L[who];
      const drift = still ? 0 : Math.sin(tw * 0.35 + (who === "minji" ? 0 : 2)) * L.H * 0.004;
      // Listening leans in a touch; being cut off pulls back.
      const lean = (st.hear * 0.012 - st.cut * 0.01) * L.H * h.dir;
      setA(E[`${who}-head`], "transform", `translate(${n2(h.c.x + lean)} ${n2(h.c.y + drift)}) scale(${n2(h.dir * L.H)} ${n2(L.H)})`);
      op(E[`${who}-head`], 0.55 + 0.45 * Math.max(st.speak, st.hear * 0.7, 0.5) * (1 - 0.35 * st.cut));
    }

    // Voices: each lane carries its person's speech (strong) and Voice Labs speaking to them (finer).
    const lane = (who: Speaker) => {
      const st = S[who];
      const [a, b] = who === "minji" ? LANE.minji : LANE.daniel;
      // A cut voice contracts back toward the mouth; at the end both lanes draw into the centre.
      const shrink = 1 - 0.6 * st.cut;
      let s0 = who === "minji" ? a : b - (b - a) * shrink, s1 = who === "minji" ? a + (b - a) * shrink : b;
      s0 += (0.5 - s0) * merge; s1 += (0.5 - s1) * merge;
      const idle = L.H * 0.008;
      const toward = who === "minji" ? 1 : -1;
      setA(E[`${who}-speak`], "d", laneWave(L, s0, s1, idle + L.H * 0.11 * st.speak, ttw, who === "minji" ? 0 : 3, toward, pre));
      setA(E[`${who}-hear`], "d", laneWave(L, s0, s1, idle * 0.5 + L.H * 0.065 * st.hear, ttw * 1.1 + 0.6, who === "minji" ? 5 : 1, toward, pre));
      op(E[`${who}-speak`], 0.35 + 0.65 * Math.max(st.speak, 0.15) * (1 - 0.6 * st.cut));
      op(E[`${who}-hear`], 0.2 + 0.7 * st.hear);
    };
    lane("minji");
    lane("daniel");

    // The middle: meaning travelling through, quieter as the conversation becomes natural.
    op(E.mid, S.presence);
    let pd = "";
    const pkt = (sv: number) => { const q = L.at(sv); pd += `M${n2(q.x)} ${n2(q.y)}h0.01`; };
    for (const f of S.flows) {
      const fromMinji = f.from === "minji";
      for (let k = 0; k < PK; k++) {
        const u = ((f.k * 3 + k / PK) % 1);
        if (f.phase === "in") { const a = fromMinji ? 0.12 : 0.88; pkt(a + (0.5 - a) * u); }
        else if (f.phase === "out") { const b = fromMinji ? 0.9 : 0.1; pkt(0.5 + (b - 0.5) * u); }
        else if (k < 3) pkt(0.5 + Math.sin((ttw * 3 + k * 2.1)) * 0.04);
      }
    }
    setA(E.pk, "d", pd || "M-9999 -9999h0.01");
    setA(E.pk, "stroke", S.flows[0]?.from === "daniel" ? C.en : C.ko);

    // Exchange 01 only: VOICE → UNDERSTAND → RESPONSE, glimpsed.
    ["voice", "understand", "response"].forEach((k, i) => op(E[`pipe-${i}`], S.pipe < 0 ? 0 : range(S.pipe, i * 0.28, i * 0.28 + 0.12) * (1 - range(S.pipe, 0.92, 1))));
    for (const k of ["INTERRUPTION", "CODE-SWITCH", "CONTEXT"] as const) op(E[`marker-${k}`], S.markers.find((m) => m.kind === k)?.alpha ?? 0);

    // The timeline: the whole call along one line, speech above/below, marks without numbers.
    const { x0, x1, y } = L.strip;
    const X = (tt: number) => x0 + (x1 - x0) * (tt / DURATION);
    let sm = "", sd = "", vm = "", vd = "";
    for (const u of SCRIPT) {
      if (u.start > t) continue;
      const e = Math.min(u.end, t);
      const seg = `M${n2(X(u.start))} ${n2(y + (u.side === "minji" ? -4 : 4) * (u.source === "human" ? 1 : 2))}H${n2(X(e))}`;
      if (u.source === "human") { if (u.side === "minji") sm += seg; else sd += seg; }
      else if (u.side === "minji") vm += seg; else vd += seg;
    }
    setA(E["strip-m"], "d", sm || "M0 0"); setA(E["strip-d"], "d", sd || "M0 0");
    setA(E["strip-vm"], "d", vm || "M0 0"); setA(E["strip-vd"], "d", vd || "M0 0");
    setA(E["strip-now"], "transform", `translate(${n2(X(t))} 0)`);
    let tk = "";
    const last: Partial<Record<string, number>> = {};
    for (const k of TICKS) { if (k.t > t) break; tk += `M${n2(X(k.t))} ${n2(y - 7)}v14`; last[k.kind] = k.t; }
    setA(E["strip-ticks"], "d", tk || "M0 0");
    for (const kind of ["turn", "first", "end"] as const) {
      const at = last[kind];
      const el = E[`strip-${kind}`];
      if (at === undefined) { op(el, 0); continue; }
      setA(el, "x", n2(X(at)));
      op(el, 1 - range(t - at, 1.6, 2.4));
    }
    // CONTEXT: an arc on the timeline from what was said earlier to the reply that relies on it.
    if (S.context) {
      const from = SCRIPT.find((u) => u.id === S.context!.from)!, to = SCRIPT.find((u) => u.id === S.context!.to)!;
      const a = X((from.start + from.end) / 2), b = X(to.start);
      setA(E["strip-ctx"], "d", `M${n2(a)} ${n2(y - 6)}Q${n2((a + b) / 2)} ${n2(y - 6 - Math.min(80, (b - a) * 0.3))} ${n2(b)} ${n2(y - 6)}`);
      op(E["strip-ctx"], S.context.alpha);
    } else op(E["strip-ctx"], 0);

    // The exit: one point of light where the two voices meet.
    op(E.merge, range(p, BEATS.exit[0] + 0.02, BEATS.exit[0] + 0.05) * (1 - range(p, 0.975, 1)));

    // DOM: what was said (and heard), the language indicators, who is active.
    if (!liveLevels.on) {
      const shown = new Map(S.lines.map((l) => [l.u.id, l]));
      for (const el of D.lines) {
        const l = shown.get(el.dataset.id!);
        el.style.opacity = l ? l.alpha.toFixed(3) : "0";
        if (l && l.part >= 0) D.parts.get(l.u.id)?.forEach((sp, k) => sp.toggleAttribute("data-on", k === l.part));
        if (l?.u.cut) el.toggleAttribute("data-cut", t >= l.u.end);
      }
    }
    for (const who of ["minji", "daniel"] as const) {
      const langEl = D.langs[who];
      const txt = liveLevels.on ? "" : S[who].langs;
      if (langEl && langEl.textContent !== txt) langEl.textContent = txt;
      D.names[who]?.toggleAttribute("data-active", S[who].speak > 0.05 || S[who].hear > 0.05);
    }
  };

  // Bind elements and DOM whenever the geometry re-renders; draw once.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    LRef.current = L;
    cache.current = {};
    const E: Els = {};
    svg.querySelectorAll("[data-rs-el]").forEach((el) => { E[(el as HTMLElement).dataset.rsEl!] = el; });
    els.current = E;
    const root = svg.closest(".scene-layer") ?? document;
    const lines = Array.from(root.querySelectorAll<HTMLElement>(".rl-line"));
    const parts = new Map<string, HTMLElement[]>();
    lines.forEach((el) => parts.set(el.dataset.id!, Array.from(el.querySelectorAll<HTMLElement>(".rl-part"))));
    dom.current = {
      lines, parts,
      langs: { minji: root.querySelector(".rl-lang-minji"), daniel: root.querySelector(".rl-lang-daniel") },
      names: { minji: root.querySelector('.rl-person[data-who="minji"]'), daniel: root.querySelector('.rl-person[data-who="daniel"]') },
    };
    const film = filmRef.current;
    paint(film ? clamp01(director.position - CHAPTER) : 0, gsap.ticker.time, !film);
    // paint only reads refs.
  }, [L]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const film = isCinematic() && !reduced;
    filmRef.current = film;
    if (!film) { paint(0, 1, true); return; }
    let running = false;
    const tick = (time: number) => paint(clamp01(director.position - CHAPTER), time, false);
    const unsubscribe = subscribeDirector((_, chapter) => {
      const on = chapter === CHAPTER;
      if (on && !running) { gsap.ticker.add(tick); running = true; }
      else if (!on && running) { gsap.ticker.remove(tick); running = false; }
    });
    return () => { unsubscribe(); if (running) gsap.ticker.remove(tick); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pipeAt = [0.42, 0.5, 0.58];
  const pipeline = PIPELINE.map((label, i) => ({ label, q: L.at(0.2 + (0.6 * i) / (PIPELINE.length - 1)), up: i % 2 === 0 }));
  const bridgeD = (() => {
    const a = L.at(LANE.mid[0]), b = L.at(LANE.mid[1]), c = L.C;
    const lift = L.portrait ? 0 : -L.H * 0.55;
    const k = L.portrait ? { x: c.x + L.w * 0.18, y: c.y } : { x: c.x, y: c.y + lift };
    return `M${n2(a.x)} ${n2(a.y)}Q${n2(k.x)} ${n2(k.y)} ${n2(b.x)} ${n2(b.y)}`;
  })();
  const head = (who: Speaker) => (
    <g data-rs="person" data-who={who}>
      {/* Its own layer, so the phone-only dimming (CSS) never fights the scroll tween or the painter. */}
      <g className={rs.person}>
      <g data-rs-el={`${who}-head`}>
        <path data-rs-el={`${who}-soft`} className={s.stroke} d="M0 0" stroke={C.ink} strokeOpacity={0.2} strokeWidth={0.8} />
        <path data-rs-el={`${who}-hatch`} className={s.stroke} d="M0 0" stroke={C.ink} strokeOpacity={0.14} strokeWidth={0.7} />
        <path data-rs-el={`${who}-main`} className={s.stroke} d="M0 0" stroke={C.ink} strokeOpacity={0.62} strokeWidth={1.05} />
        <path data-rs-el={`${who}-eye`} className={s.stroke} d="M0 0" stroke={C.ink} strokeOpacity={0.7} strokeWidth={1} />
        <path data-rs-el={`${who}-mouth`} className={s.stroke} d="M0 0" stroke={C.ink} strokeOpacity={0.5} strokeWidth={0.9} />
      </g>
      </g>
    </g>
  );

  return (
    <svg
      ref={svgRef}
      data-rs="svg"
      className={`${s.svg} ${rs.figure}`}
      viewBox={`0 0 ${L.w} ${L.h}`}
      aria-hidden="true"
      focusable="false"
      data-portrait={L.portrait || undefined}
      style={{ "--z": 1, "--r": 0, "--cx-px": `${L.C.x}px`, "--cy-px": `${L.C.y}px` } as CSSProperties}
    >
      <g data-rs="stage" className={rs.stage}>
        {head("minji")}
        {head("daniel")}

        <g data-rs="signal">
          <path data-rs-el="base" className={s.stroke} d="M0 0" stroke={C.ink} strokeOpacity={0.14} strokeWidth={0.8} />
          <path data-rs-el="minji-hear" className={s.stroke} d="M0 0" stroke={C.ko} strokeWidth={0.9} />
          <path data-rs-el="daniel-hear" className={s.stroke} d="M0 0" stroke={C.en} strokeWidth={0.9} />
          <path data-rs-el="minji-speak" className={s.stroke} d="M0 0" stroke={C.ko} strokeWidth={1.5} />
          <path data-rs-el="daniel-speak" className={s.stroke} d="M0 0" stroke={C.en} strokeWidth={1.5} />
        </g>

        <g data-rs="mid">
          <g data-rs-el="mid">
            <circle data-rs-el="mid-dot" cx={L.C.x} cy={L.C.y} r={3} fill={C.gold} filter={GLOW} opacity={0.8} />
            <path data-rs-el="pk" className={s.dots} d="M-9999 -9999h0.01" stroke={C.ko} strokeWidth={2.4} />
            {["VOICE", "UNDERSTAND", "RESPONSE"].map((label, i) => {
              const q = L.at(pipeAt[i]);
              return (
                <text key={label} data-rs-el={`pipe-${i}`} className={s.tiny} x={q.x + q.nx * 22} y={q.y + q.ny * 22} textAnchor="middle" dominantBaseline="middle" opacity={0} style={{ fill: C.gold, fillOpacity: 0.9 }}>
                  {label}{i < 2 ? " →" : ""}
                </text>
              );
            })}
          </g>
          {(["INTERRUPTION", "CODE-SWITCH", "CONTEXT"] as const).map((k) => (
            <text key={k} data-rs-el={`marker-${k}`} className={s.tiny} x={L.portrait ? L.C.x + L.w * 0.2 : L.C.x} y={L.portrait ? L.C.y : L.C.y - 30} textAnchor="middle" dominantBaseline="middle" opacity={0} style={{ fill: k === "CONTEXT" ? C.gold : C.ink, fillOpacity: 0.85 }}>
              {k}
            </text>
          ))}
        </g>

        {/* The machinery, glimpsed for a moment (scroll timeline). */}
        <g data-rs="reveal" opacity={0} className={s.filmOnly}>
          {pipeline.map(({ label, q, up }, i) => (
            <g key={label}>
              <circle cx={q.x} cy={q.y} r={2.4} fill={i === 0 ? C.ko : i === PIPELINE.length - 1 ? C.en : C.gold} />
              <text className={s.tiny} x={q.x + q.nx * (up ? 18 : -18)} y={q.y + q.ny * (up ? 18 : -18)} textAnchor="middle" dominantBaseline="middle" style={{ fill: C.ink, fillOpacity: 0.85 }}>{label}</text>
            </g>
          ))}
        </g>

        {/* The bridge: the two voices connected (chapter 03's gold arc). */}
        <path data-rs="bridge" className={`${s.stroke} ${s.filmOnly}`} d={bridgeD} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} stroke={C.gold} strokeWidth={1.2} />

        <g data-rs="strip">
          <path className={s.stroke} d={`M${n2(L.strip.x0)} ${n2(L.strip.y)}H${n2(L.strip.x1)}`} stroke={C.ink} strokeOpacity={0.14} strokeWidth={1} />
          <path data-rs-el="strip-vm" className={s.stroke} d="M0 0" stroke={C.ko} strokeOpacity={0.45} strokeWidth={1} />
          <path data-rs-el="strip-vd" className={s.stroke} d="M0 0" stroke={C.en} strokeOpacity={0.45} strokeWidth={1} />
          <path data-rs-el="strip-m" className={s.stroke} d="M0 0" stroke={C.ko} strokeWidth={2} />
          <path data-rs-el="strip-d" className={s.stroke} d="M0 0" stroke={C.en} strokeWidth={2} />
          <path data-rs-el="strip-ticks" className={s.stroke} d="M0 0" stroke={C.ink} strokeOpacity={0.35} strokeWidth={1} />
          <path data-rs-el="strip-ctx" className={s.stroke} d="M0 0" stroke={C.gold} strokeOpacity={0.8} strokeWidth={1} opacity={0} />
          <g data-rs-el="strip-now"><path className={s.stroke} d={`M0 ${n2(L.strip.y - 10)}v20`} stroke={C.gold} strokeWidth={1} /></g>
          <text data-rs-el="strip-turn" className={s.tiny} y={L.strip.y + 20} textAnchor="middle" opacity={0}>TURN</text>
          <text data-rs-el="strip-first" className={s.tiny} y={L.strip.y - 16} textAnchor="middle" opacity={0}>FIRST AUDIO</text>
          <text data-rs-el="strip-end" className={s.tiny} y={L.strip.y + 32} textAnchor="middle" opacity={0}>END OF TURN</text>
        </g>
      </g>

      <circle data-rs-el="merge" className={s.filmOnly} cx={L.C.x} cy={L.C.y} r={4} fill={C.ink} filter={GLOW} opacity={0} />
    </svg>
  );
}

/** Scroll-scrubbed macro moves of the stage (positions = chapter progress). */
export function realitySystemTimeline(tl: gsap.core.Timeline, q: (selector: string) => Element[]) {
  const T = makeTw(tl, q);
  const [p0, p1] = BEATS.portraits;
  T.fromTo('[data-rs="person"]', { opacity: 0 }, { opacity: 1, duration: p1 - p0, stagger: 0.012, ease: "power1.out" }, p0);
  T.fromTo('[data-rs="strip"]', { opacity: 0 }, { opacity: 1, duration: 0.02 }, BEATS.talk[0] + 0.01);
  T.to('[data-rs="strip"]', { opacity: 0, duration: 0.03 }, BEATS.silence[0]);
  // The brief look at the machinery: a slight pull toward the centre, the stages named, then back to the people.
  T.fromTo('[data-rs="stage"]', { "--cam": 1 }, { "--cam": 1.07, duration: 0.008, ease: "power2.out" }, REVEAL_AT - 0.006);
  T.to('[data-rs="stage"]', { "--cam": 1, duration: 0.01, ease: "power2.inOut" }, REVEAL_AT + 0.008);
  T.fromTo('[data-rs="reveal"]', { opacity: 0 }, { opacity: 1, duration: 0.004 }, REVEAL_AT - 0.004);
  T.to('[data-rs="reveal"]', { opacity: 0, duration: 0.005 }, REVEAL_AT + 0.008);
  // The voices connect.
  const [b0] = BEATS.brand;
  T.fromTo('[data-rs="bridge"]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.04, ease: "power2.out" }, b0);
  // Phones: the brand sits where Daniel is, so the people step back for it (CSS applies --pd in portrait only).
  T.fromTo('[data-rs="svg"]', { "--pd": 0 }, { "--pd": 1, duration: 0.03 }, b0);
  // The exit: the people step back; the voices meet in one point (drawn by the painter).
  const [e0] = BEATS.exit;
  T.to('[data-rs="person"], [data-rs="strip"]', { opacity: 0, duration: 0.03 }, e0);
  T.to('[data-rs="bridge"]', { opacity: 0, duration: 0.03 }, e0 + 0.01);
  T.to('[data-rs="signal"], [data-rs="mid"]', { opacity: 0, duration: 0.02 }, e0 + 0.05);
}
