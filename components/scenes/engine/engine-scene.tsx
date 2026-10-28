"use client";

import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { BEATS, CAPABILITIES, STAGES } from "./beats";
import { EngineSystem, engineTimeline } from "./system/engine-system";

type Span = readonly [number, number];
const span = ([a, b]: Span) => b - a;

/** One quiet caption per transformation, each living only inside its beat. */
const CAPTIONS: readonly { beat: Span; text: string }[] = [
  { beat: BEATS.vad, text: "When the speaker stops, the system knows." },
  { beat: BEATS.stt, text: "Speech becomes language." },
  { beat: BEATS.understand, text: "Language becomes meaning." },
  { beat: BEATS.reason, text: "Meaning meets context." },
  { beat: BEATS.act, text: "It can act before it answers." },
  { beat: [BEATS.respond[0], BEATS.tts[1]], text: "The answer becomes a voice again." },
];

/** Word-by-word realization: opacity with a tiny settle of y, scale and blur. No bounce. */
const realize = (tl: Parameters<SceneTimeline>[0], words: Element[], at: number, dur: number, stagger: number) =>
  tl.fromTo(
    words,
    { opacity: 0, y: "0.15em", scale: 0.985, filter: "blur(6px)" },
    { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: dur, ease: "power2.out", stagger },
    at,
  );

const timeline: SceneTimeline = (tl, q) => {
  // The runtime is the main actor; the type follows it.
  engineTimeline(tl, q);

  // Captions: in shortly after the beat opens, hold, out before it closes.
  q(".engine-caption").forEach((el, i) => {
    const [b0, b1] = CAPTIONS[i].beat;
    const d = span(CAPTIONS[i].beat);
    tl.fromTo(el, { opacity: 0, y: 6, filter: "blur(3px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: d * 0.18, ease: "power2.out" }, b0 + d * 0.08);
    tl.to(el, { opacity: 0, y: -4, filter: "blur(3px)", duration: d * 0.14, ease: "power1.in" }, b1 - d * 0.2);
  });

  // SERIOUS ENGINEERING, / out of sight. — over the running system, one line after the other.
  const [s0, s1] = BEATS.statement;
  const s = span(BEATS.statement);
  const lines = q(".engine-title .ct-line");
  lines.forEach((line, i) => realize(tl, [...line.querySelectorAll(".ct-i")], s0 + i * s * 0.2, s * 0.22, s * 0.04));
  tl.fromTo(q(".engine-tag"), { opacity: 0, y: 10, filter: "blur(4px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: s * 0.25, ease: "power2.out" }, s0 + s * 0.42);
  // It recedes as the camera moves away.
  tl.to(q(".engine-head"), { opacity: 0, y: -12, filter: "blur(4px)", duration: s * 0.22, ease: "power1.in" }, s1 - s * 0.12);

  // Capabilities: metadata attaching to the system, one at a time, never all at once.
  const [c0, c1] = BEATS.capabilities;
  const caps = q(".engine-cap");
  const step = span(BEATS.capabilities) / caps.length;
  caps.forEach((el, i) => {
    const at = c0 + i * step;
    tl.fromTo(el, { opacity: 0, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.004, ease: "power2.out" }, at);
    tl.to(el, { opacity: 0, duration: 0.005, ease: "power1.in" }, Math.min(at + 0.0125, c1 - 0.005));
  });

  // ONE RUNTIME. / Many conversations. — in time with the signal multiplying.
  const [m0] = BEATS.many;
  const m = span(BEATS.many);
  q(".engine-many .ct-line").forEach((line, i) => realize(tl, [...line.querySelectorAll(".ct-i")], m0 + i * m * 0.3, m * 0.28, m * 0.06));
  tl.to(q(".engine-many"), { opacity: 0, filter: "blur(4px)", duration: 0.012, ease: "power1.in" }, 0.973);
};

/** 05 — under the conversation: one voice transformed, then the runtime seen whole. */
export function EngineScene() {
  return (
    <Scene index={4} timeline={timeline} fadeOutAt={0.999}>
      <EngineSystem />

      <div className="frame frame-top engine-head">
        <CinematicText as="h2" className="engine-title" lines={["Serious engineering,", { em: "out of sight." }]} />
        <p className="engine-tag lede">Real-time voice infrastructure for a multilingual world.</p>
      </div>

      <ol className="sr-only engine-stages" aria-label="The Voice Labs runtime, in order">
        {STAGES.map((st) => <li key={st.id}>{st.label.toLowerCase()}</li>)}
      </ol>
      <ol className="sr-only engine-sequence" aria-label="What happens to one voice">
        {CAPTIONS.map((c) => <li key={c.text}>{c.text}</li>)}
      </ol>

      <ol className="engine-captions" aria-hidden="true">
        {CAPTIONS.map((c) => <li key={c.text} className="engine-caption">{c.text}</li>)}
      </ol>

      <ul className="engine-caps" aria-label="Capabilities">
        {CAPABILITIES.map((c) => <li key={c} className="engine-cap mono">{c}</li>)}
      </ul>

      <div className="frame frame-center engine-end">
        <CinematicText className="engine-many" lines={["One runtime.", { em: "Many conversations." }]} />
      </div>
    </Scene>
  );
}
