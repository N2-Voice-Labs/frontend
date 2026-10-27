"use client";

import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { fadeIn, fadeOut, revealWords } from "@/lib/cinematic/gsap";
import { ENGINE_NODES } from "./visual";

const PRINCIPLES = [
  { k: "Real time", v: "Streaming end to end — audio in, audio out, no waiting for whole sentences." },
  { k: "Turn-taking", v: "Voice activity and turn detection decide when to listen, answer, or yield." },
  { k: "Measured", v: "Every stage is timed, T0 → T5, so latency is a number, not a feeling." },
  { k: "Provider-independent", v: "STT, LLM and TTS are slots. Swap a provider without rebuilding the agent." },
  { k: "Multilingual", v: "Languages and code-switching are handled in the runtime, not bolted on." },
  { k: "Reusable", v: "One runtime. Each agent brings its own instructions, tools, knowledge and voice." },
];

const timeline: SceneTimeline = (tl, q) => {
  revealWords(tl, q(".engine-pre .ct-i"), 0.03, 0.06);
  fadeOut(tl, q(".engine-pre"), 0.2, 0.04);
  revealWords(tl, q(".engine-title .ct-i"), 0.42, 0.08);
  q(".principles li").forEach((el, i) => fadeIn(tl, el, 0.56 + i * 0.05, 0.04, { x: -14, y: 0 }));
};

/** 05 — under the conversation: the runtime, alive. */
export function EngineScene() {
  return (
    <Scene index={4} timeline={timeline}>
      <div className="frame frame-bottom">
        <CinematicText className="title-md engine-pre" lines={[{ em: "Look closer." }]} />
      </div>
      <div className="frame frame-top engine-head">
        <CinematicText as="h2" className="title-md engine-title" lines={["Serious engineering,", { em: "out of sight." }]} />
      </div>
      <ol className="sr-only">
        {ENGINE_NODES.map((n) => <li key={n.name}>{n.name.toLowerCase()}</li>)}
        <li>tools, knowledge and integrations, called by the voice agent</li>
      </ol>
      <ul className="principles">
        {PRINCIPLES.map((p) => (
          <li key={p.k}><b>{p.k}</b><span>{p.v}</span></li>
        ))}
      </ul>
    </Scene>
  );
}
