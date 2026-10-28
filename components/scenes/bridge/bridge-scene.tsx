"use client";

import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { BEATS, MICRO_LABELS, STAGES, STATEMENT } from "./beats";
import { BridgeSystem, STATEMENT_ZONE, systemTimeline } from "./bridge-system";

type Span = readonly [number, number];
const span = ([a, b]: Span) => b - a;

const timeline: SceneTimeline = (tl, q) => {
  // The system (bridge → signal → runtime) is the main actor; the type follows it.
  systemTimeline(tl, q);

  // VOICE LABS rises out of the signal as it passes the centre: masked words, blur → sharp,
  // while a slight horizontal drift (the signal's direction) settles to 0. No bounce.
  const [t0] = BEATS.title;
  const t = span(BEATS.title);
  tl.fromTo(
    q(".bridge-title .ct-i"),
    { yPercent: 70, opacity: 0, filter: "blur(10px)" },
    { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: t * 0.38, ease: "power2.out", stagger: t * 0.14 },
    t0,
  );
  tl.fromTo(q(".bridge-title"), { x: () => -window.innerWidth * 0.05 }, { x: 0, duration: t * 0.7, ease: "power2.out" }, t0);

  // Real-time voice infrastructure for a multilingual world.
  const [g0] = BEATS.tagline;
  tl.fromTo(
    q(".bridge-tag"),
    { opacity: 0, y: 12, filter: "blur(4px)" },
    { opacity: 1, y: 0, filter: "blur(0px)", duration: span(BEATS.tagline) * 0.45, ease: "power2.out" },
    g0,
  );

  // concept: the lockup recedes to the top to make room for the signal's four states…
  const [c0] = BEATS.concept;
  const c = span(BEATS.concept);
  tl.to(q(".bridge-lockup"), { y: () => -window.innerHeight * 0.35, scale: 0.45, duration: c * 0.8, ease: "power2.inOut" }, c0);
  tl.to(q(".bridge-tag"), { opacity: 0, duration: c * 0.4, ease: "power1.in" }, c0);
  // …and is gone while the runtime assembles in the middle.
  const [r0] = BEATS.runtime;
  tl.to(q(".bridge-lockup"), { opacity: 0, filter: "blur(4px)", duration: span(BEATS.runtime) * 0.25, ease: "power1.in" }, r0);

  // flow: quiet metadata appears at the edges, one after another.
  const [f0] = BEATS.flow;
  const f = span(BEATS.flow);
  tl.fromTo(
    q(".bridge-micro li"),
    { opacity: 0 },
    { opacity: 1, duration: f * 0.2, ease: "power1.out", stagger: (f * 0.6) / Math.max(1, MICRO_LABELS.length - 1) },
    f0,
  );

  // statement: one line at a time; each earlier line dims as the next is processed.
  const [s0, s1] = BEATS.statement;
  const lines = q(".bridge-statement .ct-line");
  const step = (span(BEATS.statement) * 0.6) / lines.length;
  lines.forEach((line, i) => {
    const at = s0 + i * step;
    tl.fromTo(
      line.querySelectorAll(".ct-i"),
      { opacity: 0, y: "0.15em", filter: "blur(6px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: step * 0.7, ease: "power2.out", stagger: step * 0.1 },
      at,
    );
    if (i > 0) tl.to(lines[i - 1], { opacity: 0.35, duration: step * 0.6, ease: "power1.out" }, at);
  });

  // Everything lets go before the layer does; VOICE OUT's waveform carries on into chapter 04.
  const out = 0.02;
  tl.to(q(".bridge-statement, .bridge-micro"), { opacity: 0, filter: "blur(4px)", duration: out, ease: "power1.in" }, s1 - 0.005 - out);
};

/** 03 — THE BRIDGE: the connections become one signal, the signal has a name, and the name is a runtime. */
export function BridgeScene() {
  return (
    <Scene index={2} timeline={timeline}>
      <BridgeSystem />
      <div className="frame frame-center bridge-head">
        <div className="bridge-lockup">
          <CinematicText as="h2" className="title-brand bridge-title" lines={["Voice Labs"]} />
          <p className="bridge-tag lede">Real-time voice infrastructure for a multilingual world.</p>
        </div>
      </div>
      <ol className="sr-only" aria-label="The Voice Labs runtime, in order">
        {STAGES.map((s) => <li key={s.id}>{s.label.toLowerCase()}</li>)}
      </ol>
      <ul className="bridge-micro" data-zone={STATEMENT_ZONE} aria-label="Properties">
        {MICRO_LABELS.map((l) => <li key={l} className="mono">{l}</li>)}
      </ul>
      <div className={`frame frame-${STATEMENT_ZONE} bridge-say`}>
        <CinematicText className="bridge-statement" lines={[...STATEMENT.slice(0, -1), { em: STATEMENT[STATEMENT.length - 1] }]} />
      </div>
    </Scene>
  );
}
