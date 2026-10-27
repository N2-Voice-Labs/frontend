"use client";

import type { MouseEvent } from "react";
import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { director } from "@/lib/cinematic/director";
import { fadeIn, fadeOut, revealWords } from "@/lib/cinematic/gsap";
import { ROUTES } from "@/lib/landing/config";

const timeline: SceneTimeline = (tl, q) => {
  revealWords(tl, q(".future-pre .ct-i"), 0.18, 0.1);
  fadeOut(tl, q(".future-pre"), 0.42, 0.05);
  revealWords(tl, q(".future-line .ct-i"), 0.56, 0.12);
  fadeOut(tl, q(".future-line"), 0.74, 0.05, { y: 0, opacity: 0, filter: "blur(6px)" });
  revealWords(tl, q(".future-brand .ct-i"), 0.8, 0.06);
  fadeIn(tl, q(".future-tag"), 0.85, 0.04);
  fadeIn(tl, q(".future-ctas"), 0.88, 0.04);
  fadeIn(tl, q(".future-foot"), 0.92, 0.04, { y: 0 });
};

/** Anchor clicks go through the film's scroller (smooth with Lenis). */
function go(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  director.scrollTo(target);
}

/** 08 — a planet of voices, then darkness, then the promise. */
export function FutureScene() {
  return (
    <Scene index={7} timeline={timeline}>
      <div className="frame frame-bottom">
        <CinematicText className="title-md future-pre" lines={[{ em: "Somewhere, right now, two people" }, { em: "are trying to understand each other." }]} />
      </div>
      <div className="frame frame-center">
        <CinematicText className="title-lg future-line" lines={["A voice should never need", { em: "a translation to be heard." }]} />
      </div>
      <div className="frame frame-center future-end">
        <CinematicText as="h2" className="title-brand future-brand" lines={["Voice Labs"]} />
        <p className="future-tag lede">Real-time voice infrastructure for a multilingual world.</p>
        <div className="future-ctas">
          <a href="#reality" className="cta cta-primary" onClick={(e) => go(e, "reality")}>Experience Voice Labs</a>
          <a href="#engine" className="cta cta-ghost" onClick={(e) => go(e, "engine")}>Explore the stack</a>
        </div>
      </div>
      <footer className="future-foot mono">
        <span>© {new Date().getFullYear()} Voice Labs</span>
        <span>Conversation examples are illustrative.</span>
        <a href={ROUTES.agents}>Open workspace</a>
      </footer>
    </Scene>
  );
}
