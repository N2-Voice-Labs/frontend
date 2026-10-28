"use client";

import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { isPortrait } from "@/components/scenes/bridge/geometry";
import { director, isCinematic, subscribeDirector } from "@/lib/cinematic/director";
import { gsap } from "@/lib/cinematic/gsap";
import { Connections, StillNodes, TalkGradient, bindConnections, connectionsTimeline } from "./connections";
import { frameAt, type GlobeFrame } from "./globe";
import { Point, bindPoint, pointTimeline } from "./point";
import { clamp01, makeTw, s, type Bind, type Painter } from "./shared";
import { Voice, bindVoice, voiceTimeline } from "./voice";
import fs from "./future-system.module.css";

/**
 * Chapter 08's SVG foreground: only the few important things. The canvas draws the world made of voices
 * (thousands of distant points) from the same model, globe.ts; every element here sits where that model's
 * camera (frameAt) puts it.
 *
 * - point.tsx: chapter 07's two voices, receding into the point the network grows from.
 * - connections.tsx: ≤ 10 foreground connections (≤ 5 on phones) with pulse → response; quiet under the
 *   statements; then only Seoul ↔ Toronto, brightening, with one signal travelling down it to Seoul.
 * - voice.tsx: one tiny cyan waveform at the screen centre, then silence, then nothing (from 0.8 on the
 *   foreground is empty: the final line, the brand and the doorway sit on pure darkness).
 *
 * Scroll timeline: opacity and dash only. Time (gsap.ticker, only while chapter 08 is on screen, never
 * under reduced motion): the painters write the moving elements through the DOM. Without the film (plain
 * document / reduced motion): a still globe with its connections and the conversation named.
 */

const CHAPTER = 7;
/** Still figure: the globe formed, labels gone, before the pull-back; pulses frozen mid-flight. */
const PLAIN_P = 0.4;
const STILL_T = 4.2;
/** The canvas eases toward the scroll position by this much per frame (components/cinematic/stage.tsx); so do we. */
const EASE = 0.09;

const BINDERS: Bind[] = [bindPoint, bindConnections, bindVoice];

export function FutureSystem(): JSX.Element {
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const portrait = isPortrait(size.w, size.h);
  const [film, setFilm] = useState(true);
  const still: GlobeFrame | null = useMemo(() => (film ? null : frameAt(PLAIN_P, size.w, size.h, STILL_T)), [film, size.w, size.h]);
  const svgRef = useRef<SVGSVGElement>(null);
  const painters = useRef<Painter[]>([]);
  const sizeRef = useRef(size);
  const filmRef = useRef(false);
  /** Where the camera is (eased like the canvas's, so the arcs stay on its points while scrolling). */
  const shown = useRef(0);

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

  const paint = (p: number, t: number, still: boolean) => {
    const { w, h } = sizeRef.current;
    const F = frameAt(p, w, h, t);
    for (const fn of painters.current) fn(p, t, F, still);
  };
  const draw = (t: number) => {
    const target = clamp01(director.position - CHAPTER);
    shown.current = Math.abs(target - shown.current) < 1e-4 ? target : shown.current + (target - shown.current) * EASE;
    paint(shown.current, t, false);
  };
  const rest = () => paint(PLAIN_P, STILL_T, true);

  // Re-collect the living elements whenever the size (and so the layout) re-renders, and draw once.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    sizeRef.current = size;
    painters.current = BINDERS.map((b) => b(svg, portrait));
    if (filmRef.current) paint(shown.current, gsap.ticker.time, false);
    else rest();
  }, [size, portrait, film]);

  // Life runs only while chapter 08 is on screen; off screen the last pose is kept at the scroll position.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const on = isCinematic() && !reduced;
    filmRef.current = on;
    setFilm(on);
    if (!on) { rest(); return; }
    let running = false;
    const tick = (time: number) => draw(time);
    const unsubscribe = subscribeDirector((_, chapter) => {
      const here = chapter === CHAPTER;
      if (here && !running) { shown.current = clamp01(director.position - CHAPTER); gsap.ticker.add(tick); running = true; }
      else if (!here && running) { gsap.ticker.remove(tick); running = false; }
      if (!here) { shown.current = clamp01(director.position - CHAPTER); paint(shown.current, gsap.ticker.time, false); }
    });
    return () => { unsubscribe(); if (running) gsap.ticker.remove(tick); };
  }, []);

  return (
    <svg
      ref={svgRef}
      data-fs="svg"
      className={`${s.svg} ${fs.figure}`}
      viewBox={`0 0 ${size.w} ${size.h}`}
      aria-hidden="true"
      focusable="false"
      data-portrait={portrait || undefined}
    >
      {/* Glow: chapter 05's #es-glow filter, defined once in the document. */}
      <defs><TalkGradient /></defs>
      <StillNodes F={still} />
      <Point w={size.w} h={size.h} />
      <Connections portrait={portrait} />
      <Voice />
    </svg>
  );
}

// ---------------------------------------------------------------- scroll timeline

/** Adds every scroll-scrubbed tween of chapter 08's foreground to the chapter timeline (positions = chapter progress). */
export function futureSystemTimeline(tl: gsap.core.Timeline, q: (selector: string) => Element[]): void {
  const T = makeTw(tl, q);
  pointTimeline(T);
  connectionsTimeline(T);
  voiceTimeline(T);
}
