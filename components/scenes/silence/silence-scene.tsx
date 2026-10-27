"use client";

import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { fadeOut, revealWords } from "@/lib/cinematic/gsap";

const timeline: SceneTimeline = (tl, q) => {
  fadeOut(tl, q(".silence-cue"), 0.03, 0.04, { y: 8 });
  revealWords(tl, q(".silence-a .ct-i"), 0.12, 0.12);
  fadeOut(tl, q(".silence-a"), 0.42, 0.06);
  revealWords(tl, q(".silence-b .ct-i"), 0.52, 0.16);
  fadeOut(tl, q(".silence-b"), 0.86, 0.08, { y: 0, scale: 0.96 });
};

/** 01 — almost nothing: one small voice, then another, far apart. */
export function SilenceScene() {
  return (
    <Scene index={0} timeline={timeline}>
      <div className="frame frame-center">
        <div className="stack">
          <CinematicText as="h1" className="title-xl silence-a" lines={["We speak", "differently."]} />
          <CinematicText className="title-xl silence-b" lines={["But conversation", { em: "should feel natural." }]} />
        </div>
      </div>
      <p className="silence-cue mono" aria-hidden="true">
        <span className="cue-line" />Scroll to begin
      </p>
    </Scene>
  );
}
