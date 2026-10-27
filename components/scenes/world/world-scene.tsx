"use client";

import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { fadeIn, revealWords } from "@/lib/cinematic/gsap";
import { WORLDS } from "./visual";

const timeline: SceneTimeline = (tl, q) => {
  revealWords(tl, q(".world-a .ct-i"), 0.04, 0.1);
  tl.to(q(".world-a"), { y: () => -window.innerHeight * 0.4, scale: 0.42, duration: 0.14 }, 0.2);
  revealWords(tl, q(".world-b .ct-i"), 0.66, 0.1);
  fadeIn(tl, q(".world-note"), 0.78, 0.05);
};

/** 06 — the engine pulls back: one runtime under every kind of conversation. */
export function WorldScene() {
  return (
    <Scene index={5} timeline={timeline}>
      <div className="frame frame-center">
        <CinematicText as="h2" className="title-lg world-a" lines={["One voice", "infrastructure."]} />
      </div>
      <ul className="sr-only">
        {WORLDS.map((w) => <li key={w.name}>{w.name.toLowerCase()}</li>)}
      </ul>
      <div className="frame frame-bottom world-foot">
        <CinematicText className="title-md world-b" lines={[{ em: "Many conversations." }]} />
        <p className="world-note kicker">Same runtime underneath · each agent with its own instructions, tools, knowledge and voice</p>
      </div>
    </Scene>
  );
}
