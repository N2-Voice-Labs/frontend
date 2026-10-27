"use client";

import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { fadeIn, fadeOut, revealWords } from "@/lib/cinematic/gsap";
import { STATIONS } from "./visual";

const timeline: SceneTimeline = (tl, q) => {
  revealWords(tl, q(".bridge-pre .ct-i"), 0.02, 0.08);
  fadeOut(tl, q(".bridge-pre"), 0.18, 0.04);
  revealWords(tl, q(".bridge-title .ct-i"), 0.24, 0.12);
  tl.fromTo(q(".bridge-title"), { letterSpacing: "0.4em" }, { letterSpacing: "0.04em", duration: 0.24 }, 0.22);
  fadeIn(tl, q(".bridge-tag"), 0.38, 0.06);
  fadeIn(tl, q(".bridge-foot"), 0.8, 0.06);
};

/** 03 — the signals meet; the meeting point has a name. */
export function BridgeScene() {
  return (
    <Scene index={2} timeline={timeline}>
      <div className="frame frame-center">
        <CinematicText className="title-md bridge-pre" lines={[{ em: "Then something in between" }, { em: "begins to listen." }]} />
      </div>
      <div className="frame frame-top bridge-head">
        <CinematicText as="h2" className="title-brand bridge-title" lines={["Voice Labs"]} />
        <p className="bridge-tag lede">Real-time voice infrastructure for a multilingual world.</p>
      </div>
      <ol className="sr-only">
        {STATIONS.map((s) => <li key={s.name}>{s.name.toLowerCase()}</li>)}
      </ol>
      <p className="bridge-foot kicker">Speech in one language · understood · reasoned over · answered naturally in another</p>
    </Scene>
  );
}
