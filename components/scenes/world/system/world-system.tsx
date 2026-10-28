"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import { gsap } from "@/lib/cinematic/gsap";
import { director, isCinematic, subscribeDirector } from "@/lib/cinematic/director";
import { BEATS } from "../beats";
import { ConversationWorlds, bindConversationWorlds, conversationWorldsTimeline } from "./conversation-world";
import { camTransform, cameraAt, worldGeometry, type Cam, type Geo } from "./geometry";
import { GlobalNetwork, Selection, bindGlobalNetwork, globalNetworkTimeline } from "./global-network";
import { Closing, Opening, bindClosing, handoffTimeline } from "./handoff";
import { LanguageSignals, bindLanguageSignals, languageSignalsTimeline } from "./language-signals";
import { RuntimeCore, bindRuntimeCore, runtimeCoreTimeline } from "./runtime-core";
import { SignalPaths, bindSignalPaths, signalPathsTimeline } from "./signal-paths";
import { makeTw, s, type Bind, type Painter } from "./shared";
import w from "./world-system.module.css";

/**
 * Chapter 06 as ONE world-space network seen through ONE camera (same approach as chapter 05's engine).
 *
 * - World (geometry.ts): the runtime at the centre, seven worlds around it, regions of cities beyond.
 * - Camera: computed from chapter progress (cameraAt, shared with the canvas) and written on every
 *   director update: close on the runtime → pulled back past the worlds → the world-scale network → in
 *   again on one conversation. Labels, packets and points are counter-scaled (--z).
 * - Scroll timeline: only opacity, dash draws and unitless vars, so it survives resizes.
 * - Time (gsap.ticker, only while chapter 06 is on screen, never under reduced motion): each part's
 *   painter writes its living elements through the DOM.
 * - Without the film (plain document / reduced motion): the runtime and its worlds as a still figure.
 */

const CHAPTER = 5;
/** Plain document: the worlds with their agents and languages, seen whole. */
const PLAIN_P = 0.46;

const BINDERS: Bind[] = [bindRuntimeCore, bindSignalPaths, bindConversationWorlds, bindLanguageSignals, bindGlobalNetwork, bindClosing];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function WorldSystem(): JSX.Element {
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const G: Geo = useMemo(() => worldGeometry(size.w, size.h), [size.w, size.h]);
  const svgRef = useRef<SVGSVGElement>(null);
  const camRef = useRef<SVGGElement>(null);
  const painters = useRef<Painter[]>([]);
  const geoRef = useRef<Geo>(G);
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

  /** Points the camera; returns it for the painters. */
  const aim = (p: number, still: boolean): Cam => {
    const g = geoRef.current;
    const cam = still ? { cx: 0.5, cy: g.c.y / g.h, z: 1 } : cameraAt(p, g.portrait, { x: g.sel.x / g.w, y: g.sel.y / g.h });
    camRef.current?.setAttribute("transform", camTransform(cam, g.w, g.h));
    svgRef.current?.style.setProperty("--z", cam.z.toFixed(5));
    return cam;
  };
  const draw = (t: number) => {
    const p = clamp01(director.position - CHAPTER);
    const cam = aim(p, false);
    for (const fn of painters.current) fn(p, t, cam, false);
  };
  const still = () => {
    const cam = aim(PLAIN_P, true);
    for (const fn of painters.current) fn(PLAIN_P, 1 + Math.max(0, director.position - CHAPTER) * 24, cam, true);
  };

  // Re-collect the living elements whenever the geometry re-renders, and draw once.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    geoRef.current = G;
    painters.current = BINDERS.map((b) => b(svg, G));
    if (filmRef.current) draw(gsap.ticker.time);
    else still();
  }, [G]);

  // The camera follows every scroll update; life runs only while chapter 06 is on screen.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const film = isCinematic() && !reduced;
    filmRef.current = film;
    if (!film) return subscribeDirector(() => still());
    let running = false;
    const tick = (time: number) => draw(time);
    const unsubscribe = subscribeDirector((_, chapter) => {
      const on = chapter === CHAPTER;
      if (on && !running) { gsap.ticker.add(tick); running = true; }
      else if (!on && running) { gsap.ticker.remove(tick); running = false; }
      if (!on) aim(clamp01(director.position - CHAPTER), false);
    });
    return () => { unsubscribe(); if (running) gsap.ticker.remove(tick); };
  }, []);

  return (
    <svg
      ref={svgRef}
      data-ws="svg"
      className={`${s.svg} ${w.figure}`}
      viewBox={`0 0 ${G.w} ${G.h}`}
      aria-hidden="true"
      focusable="false"
      data-portrait={G.portrait || undefined}
      style={{ ...G.vars, "--z": 1, "--r": 0 } as CSSProperties}
    >
      {/* Glow: chapter 05's #es-glow filter, defined once in the document. */}
      {/* chapter 05's last frame, receding. */}
      <Opening G={G} />

      <g ref={camRef} data-ws="cam">
        <GlobalNetwork G={G} />
        <g data-ws="net">
          <SignalPaths G={G} />
          <RuntimeCore G={G} />
          <ConversationWorlds G={G} />
          <LanguageSignals G={G} />
        </g>
        <Selection G={G} />
      </g>

      {/* the selected conversation, opened up. */}
      <Closing G={G} />
    </svg>
  );
}

// ---------------------------------------------------------------- scroll timeline

/** Adds every scroll-scrubbed tween of the world system to the chapter timeline (positions = chapter progress). */
export function worldTimeline(tl: gsap.core.Timeline, q: (selector: string) => Element[]): void {
  const T = makeTw(tl, q);
  handoffTimeline(T);
  signalPathsTimeline(T);
  runtimeCoreTimeline(T);
  conversationWorldsTimeline(T);
  languageSignalsTimeline(T);
  // The statements sit over the moving network; it steps back, never stops.
  T.fromTo('[data-ws="net"]', { opacity: 1 }, { opacity: 0.5, duration: 0.03 }, BEATS.statement[0] - 0.01);
  T.to('[data-ws="net"]', { opacity: 0.75, duration: 0.04 }, BEATS.underneath[0] + 0.02);
  T.to('[data-ws="net"]', { opacity: 1, duration: 0.03 }, BEATS.global[0]);
  globalNetworkTimeline(T);
}
