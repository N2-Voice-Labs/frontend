"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import { gsap } from "@/lib/cinematic/gsap";
import { director, isCinematic, subscribeDirector } from "@/lib/cinematic/director";
import { CAMERA, cameraAt, engineGeometry, type Cam, type Geo } from "./geometry";
import { makeTw, s, type Bind, type Painter } from "./shared";
import { SignalOpen, SignalWorld, bindSignal, signalTimeline } from "./signal";
import { TurnDetection, bindTurnDetection, turnDetectionTimeline } from "./turn-detection";
import { SpeechToText, bindSpeechToText, speechToTextTimeline } from "./speech-to-text";
import { Understanding, bindUnderstanding, understandingTimeline } from "./understanding";
import { ReasoningField, bindReasoningField, reasoningFieldTimeline } from "./reasoning-field";
import { ContextBranches, bindContextBranches, contextBranchesTimeline } from "./context-branches";
import { TextToSpeech, bindTextToSpeech, textToSpeechTimeline } from "./text-to-speech";
import { RuntimeBase, RuntimeTop, bindRuntime, runtimeTimeline } from "./runtime-pipeline";
import { ExitMultiply, bindExitMultiply, exitMultiplyTimeline } from "./exit-multiply";

/**
 * The engine of chapter 05 as ONE world-space runtime seen through ONE camera.
 *
 * - World (geometry.ts): the runtime laid out as one continuous path; at zoom 1 it is exactly the
 *   pulled-back runtime. Every beat is a close-up of a region of that same world.
 * - Camera: one <g> whose CSS transform reads unitless vars (--cx/--cy as fractions of the viewport,
 *   --z, --r), tweened by engineTimeline for both orientations at once (…L / …P), so the scroll
 *   timeline survives resizes and orientation changes. Labels, packets and nodes are counter-scaled.
 * - Time (gsap.ticker, only while chapter 05 is on screen, never under reduced motion): each part's
 *   painter writes its living elements through the DOM (no React state per frame).
 * - Without the film (plain document / reduced motion): the pulled-back runtime as a still figure,
 *   re-drawn on director updates (packets advance with the scroll instead of time).
 */

const CHAPTER = 4;
/** Plain document: the runtime beat, seen whole. */
const PLAIN_P = 0.79;
const PLAIN_CAM: Cam = { cx: 0.5, cy: 0.5, z: 1, r: 0 };

const BINDERS: Bind[] = [bindSignal, bindTurnDetection, bindSpeechToText, bindUnderstanding, bindReasoningField, bindContextBranches, bindTextToSpeech, bindRuntime, bindExitMultiply];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function paint(painters: Painter[], p: number, t: number, cam: Cam) {
  for (const fn of painters) fn(p, t, cam);
}
/** Film: the chapter progress, real time, and the camera exactly where the scroll tweens put it. */
function frame(painters: Painter[], G: Geo, t: number) {
  const p = clamp01(director.position - CHAPTER);
  paint(painters, p, t, cameraAt(p, G.portrait));
}
/** Plain document / reduced motion: the runtime still; the scroll position stands in for time. */
function still(painters: Painter[]) {
  paint(painters, PLAIN_P, Math.max(0, director.position - CHAPTER) * 24, PLAIN_CAM);
}

/** The engine SVG: absolute, inset 0, pointer-events none, aria-hidden (plain document: a static figure in flow). */
export function EngineSystem(): JSX.Element {
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const G: Geo = useMemo(() => engineGeometry(size.w, size.h), [size.w, size.h]);
  const svgRef = useRef<SVGSVGElement>(null);
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

  // Re-collect the living elements whenever the geometry re-renders, and draw once.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    geoRef.current = G;
    painters.current = BINDERS.map((b) => b(svg, G));
    if (filmRef.current) frame(painters.current, G, gsap.ticker.time);
    else still(painters.current);
  }, [G]);

  // Life: only while chapter 05 is on screen, never under reduced motion. Otherwise: stills on scroll.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const film = isCinematic() && !reduced;
    filmRef.current = film;
    if (!film) return subscribeDirector(() => still(painters.current));
    let running = false;
    const tick = (time: number) => frame(painters.current, geoRef.current, time);
    const unsubscribe = subscribeDirector((_, chapter) => {
      const on = chapter === CHAPTER;
      if (on && !running) { gsap.ticker.add(tick); running = true; }
      else if (!on && running) { gsap.ticker.remove(tick); running = false; }
    });
    return () => { unsubscribe(); if (running) gsap.ticker.remove(tick); };
  }, []);

  return (
    <svg
      ref={svgRef}
      data-es="svg"
      className={s.svg}
      viewBox={`0 0 ${G.w} ${G.h}`}
      aria-hidden="true"
      focusable="false"
      data-portrait={G.portrait || undefined}
      style={G.vars as CSSProperties}
    >
      <defs>
        <filter id="es-glow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* enter: chapter 04's four layers, in screen space, becoming one wave. */}
      <SignalOpen G={G} />

      {/* the world, through the camera. */}
      <g data-es="world">
        <g className={s.cam}>
          <RuntimeBase G={G} />
          <SignalWorld G={G} />
          <TurnDetection G={G} />
          <SpeechToText G={G} />
          <Understanding G={G} />
          <ContextBranches G={G} />
          <ReasoningField G={G} />
          <TextToSpeech G={G} />
          <RuntimeTop G={G} />
        </g>
      </g>

      {/* exit → multiply, in screen space. */}
      <ExitMultiply G={G} />
    </svg>
  );
}

// ---------------------------------------------------------------- scroll timeline

/** Adds every scroll-scrubbed tween of the engine system to the chapter timeline (positions = chapter progress). */
export function engineTimeline(tl: gsap.core.Timeline, q: (selector: string) => Element[]): void {
  const T = makeTw(tl, q);

  // The camera: both orientations' keys tweened together; CSS picks one via [data-portrait].
  const key = (c: { L: Cam; P: Cam }) => ({
    "--cxL": c.L.cx, "--cyL": c.L.cy, "--zL": c.L.z, "--rL": c.L.r,
    "--cxP": c.P.cx, "--cyP": c.P.cy, "--zP": c.P.z, "--rP": c.P.r,
  });
  const svg = q('[data-es="svg"]');
  if (svg.length) {
    let prev = { L: CAMERA.L.start, P: CAMERA.P.start };
    tl.set(svg, key(prev), 0);
    CAMERA.moves.forEach((m, i) => {
      const next = { L: CAMERA.L.moves[i], P: CAMERA.P.moves[i] };
      tl.fromTo(svg, key(prev), { ...key(next), duration: m.dur, ease: m.ease, immediateRender: i === 0 }, m.at);
      prev = next;
    });
  }

  signalTimeline(T);
  turnDetectionTimeline(T);
  speechToTextTimeline(T);
  understandingTimeline(T);
  reasoningFieldTimeline(T);
  contextBranchesTimeline(T);
  textToSpeechTimeline(T);
  runtimeTimeline(T);

  // statement / capabilities: the running system steps back a little under the typography.
  T.fromTo('[data-es="world"]', { opacity: 1 }, { opacity: 0.62, duration: 0.025 }, 0.8);
  // exit: the runtime recedes behind the outgoing signal.
  T.to('[data-es="world"]', { opacity: 0.3, duration: 0.04 }, 0.9);
  T.to('[data-es="world"]', { opacity: 0, duration: 0.02 }, 0.95);

  exitMultiplyTimeline(T);
}
