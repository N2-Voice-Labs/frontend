"use client";

import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { BEATS, CODE_SWITCH, LANG_TAG, SELECTED, WORLDS } from "./beats";
import { WorldSystem, worldTimeline } from "./system/world-system";

type Span = readonly [number, number];
const span = ([a, b]: Span) => b - a;

/** Word-by-word realization: opacity with a tiny settle of y, scale and blur. No bounce. */
const realize = (tl: Parameters<SceneTimeline>[0], words: Element[], at: number, dur: number, stagger: number) =>
  tl.fromTo(
    words,
    { opacity: 0, y: "0.15em", scale: 0.985, filter: "blur(6px)" },
    { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: dur, ease: "power2.out", stagger },
    at,
  );

const timeline: SceneTimeline = (tl, q) => {
  // The network is the main actor; the type follows it.
  worldTimeline(tl, q);

  // ONE VOICE INFRASTRUCTURE. / Many conversations. — over the moving network.
  const [s0, s1] = BEATS.statement;
  const s = span(BEATS.statement);
  q(".world-title .ct-line").forEach((line, i) => realize(tl, [...line.querySelectorAll(".ct-i")], s0 + i * s * 0.14, s * 0.2, s * 0.04));
  realize(tl, q(".world-many .ct-i"), s0 + s * 0.42, s * 0.22, s * 0.05);
  tl.to(q(".world-head"), { opacity: 0, y: -10, filter: "blur(4px)", duration: s * 0.16, ease: "power1.in" }, s1 - s * 0.14);

  // SAME RUNTIME UNDERNEATH. + each agent with its own…, while the camera drifts through the network.
  const [u0, u1] = BEATS.underneath;
  const u = span(BEATS.underneath);
  realize(tl, q(".world-same .ct-i"), u0 + u * 0.06, u * 0.22, u * 0.05);
  tl.fromTo(q(".world-note"), { opacity: 0, y: 8, filter: "blur(3px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: u * 0.2, ease: "power2.out" }, u0 + u * 0.36);
  tl.to(q(".world-under"), { opacity: 0, filter: "blur(4px)", duration: u * 0.14, ease: "power1.in" }, u1 - u * 0.1);

  // The selected conversation: who is on either end, the moment before it begins.
  const [e0] = BEATS.setup;
  tl.fromTo(q(".world-end"), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.02, ease: "power2.out", stagger: 0.01 }, e0 + 0.03);
};

/** 06 — one runtime powers a world of conversations; then one of them becomes real. */
export function WorldScene() {
  return (
    <Scene index={5} timeline={timeline} fadeIn={0.001} fadeOutAt={0.999}>
      <WorldSystem />

      <div className="frame frame-center world-head">
        <CinematicText as="h2" className="world-title" lines={["One voice", "infrastructure."]} />
        <CinematicText className="world-many" lines={[{ em: "Many conversations." }]} />
      </div>

      <div className="frame frame-center world-under">
        <CinematicText className="world-same" lines={["Same runtime underneath."]} />
        <p className="world-note lede">Each agent with its own instructions, tools, knowledge and voice.</p>
      </div>

      <ul className="sr-only" aria-label="Conversations one runtime serves">
        {WORLDS.map((wd) => (
          <li key={wd.id}>{wd.name.toLowerCase()}: {wd.verbs.toLowerCase()} ({wd.meta.join(", ").toLowerCase()})</li>
        ))}
      </ul>
      <p className="sr-only">
        Many languages:{" "}
        {WORLDS.filter((wd) => wd.hello).map((wd, i) => (
          <span key={wd.id}>{i ? ", " : ""}<span lang={wd.lang}>{wd.hello}</span> ({LANG_TAG[wd.lang]})</span>
        ))}
        . One caller switches mid-sentence:{" "}
        {CODE_SWITCH.parts.map((part, k) => <span key={k} lang={part.lang}>{k ? " " : ""}{part.text}</span>)}
      </p>

      <div className="world-ends" aria-label="The next conversation">
        <span className="world-end world-end-a mono">{SELECTED.a}</span>
        <span className="world-end world-end-b mono">{SELECTED.b}</span>
      </div>
    </Scene>
  );
}
