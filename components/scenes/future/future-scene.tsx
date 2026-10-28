"use client";

import type { MouseEvent } from "react";
import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { director } from "@/lib/cinematic/director";
import { ROUTES } from "@/lib/landing/config";
import { BEATS } from "./beats";
import { FutureSystem, futureSystemTimeline } from "./system/future-system";

type Span = readonly [number, number];
const span = ([a, b]: Span) => b - a;

/** A whole element emerges as one (never word by word): opacity, a little blur → clear. */
const emerge = (tl: Parameters<SceneTimeline>[0], el: Element[], at: number, dur: number, blur = 8) =>
  tl.fromTo(el, { opacity: 0, filter: `blur(${blur}px)` }, { opacity: 1, filter: "blur(0px)", duration: dur, ease: "power1.out" }, at);
const fade = (tl: Parameters<SceneTimeline>[0], el: Element[], at: number, dur: number) =>
  tl.to(el, { opacity: 0, filter: "blur(4px)", duration: dur, ease: "power1.in" }, at);

const timeline: SceneTimeline = (tl, q) => {
  // The network speaks first; the type only arrives once the world is small in the dark.
  futureSystemTimeline(tl, q);

  // THE WORLD IS FULL OF VOICES. — then gone before the next statement.
  const [w0, w1] = BEATS.world;
  const w = span(BEATS.world);
  emerge(tl, q(".future-world"), w0, w * 0.38);
  fade(tl, q(".future-world"), w1 - w * 0.3, w * 0.25);

  // WE SHOULD ALL BE ABLE TO HEAR EACH OTHER.
  const [h0, h1] = BEATS.hear;
  const h = span(BEATS.hear);
  emerge(tl, q(".future-hear"), h0 + h * 0.06, h * 0.38);
  fade(tl, q(".future-hear"), h1 - h * 0.3, h * 0.25);

  // (focus, silence: nothing at all.)

  // A VOICE SHOULD NEVER NEED / A TRANSLATION TO BE HEARD. — the whole sentence, slowly, as one.
  const [l0, l1] = BEATS.line;
  const l = span(BEATS.line);
  emerge(tl, q(".future-line"), l0, l * 0.45, 10);
  fade(tl, q(".future-line"), l1 - l * 0.22, l * 0.2);

  // Black, then the name and the tagline. Nothing around them.
  const [b0] = BEATS.brand;
  const b = span(BEATS.brand);
  emerge(tl, q(".future-brand"), b0 + b * 0.15, b * 0.35, 6);
  emerge(tl, q(".future-tag"), b0 + b * 0.4, b * 0.35, 3);

  // The doorway, then the footer, last.
  const [c0] = BEATS.cta;
  const c = span(BEATS.cta);
  emerge(tl, q(".future-ctas"), c0 + c * 0.07, c * 0.28, 2);
  emerge(tl, q(".future-foot"), c0 + c * 0.36, c * 0.28, 0);
};

/** Anchor clicks go through the film's scroller (smooth with Lenis). */
function go(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  director.scrollTo(target);
}

/** 08 — a world of voices, small in the dark; one voice; silence; the promise; the name; the door. */
export function FutureScene() {
  return (
    <Scene index={7} timeline={timeline}>
      <FutureSystem />

      <div className="frame frame-center">
        <CinematicText className="future-say future-world" lines={[{ em: "The world is full of voices." }]} />
      </div>
      <div className="frame frame-center">
        <CinematicText className="future-say future-hear" lines={[{ em: "We should all be able to hear each other." }]} />
      </div>

      <div className="frame frame-center">
        <CinematicText className="future-say future-line" lines={[{ em: "A voice should never need" }, { em: "a translation to be heard." }]} />
      </div>

      <div className="frame frame-center future-end">
        <CinematicText as="h2" className="title-brand future-say future-brand" lines={["Voice Labs"]} />
        <p className="future-tag lede">Real-time voice infrastructure for a multilingual world.</p>
        <nav className="future-ctas" aria-label="Where to go next">
          <a href={ROUTES.agents} className="future-door mono">Enter the workspace<span aria-hidden="true"> →</span></a>
          <span className="future-links">
            <a href="#reality" className="future-link mono" onClick={(e) => go(e, "reality")}>Experience Voice Labs</a>
            <a href="#engine" className="future-link mono" onClick={(e) => go(e, "engine")}>Explore the stack</a>
          </span>
        </nav>
      </div>

      <footer className="future-foot mono">
        <span className="future-foot-name">Voice Labs</span>
        <span>Built for conversations that shouldn&apos;t need translation.</span>
        <span>© {new Date().getFullYear()} Voice Labs</span>
        <span>Conversation examples are illustrative.</span>
      </footer>
    </Scene>
  );
}
