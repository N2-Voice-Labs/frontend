"use client";

import { useEffect, useRef } from "react";
import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { isCinematic } from "@/lib/cinematic/director";
import { fadeOut, revealWords } from "@/lib/cinematic/gsap";
import { sampleTextPoints } from "@/lib/cinematic/text-points";
import { BEATS, thesisPoints } from "./beats";

const span = ([a, b]: readonly [number, number]) => b - a;

const timeline: SceneTimeline = (tl, q) => {
  // The only thing on the black screen at load: a quiet cue that leaves as the first signal appears.
  fadeOut(tl, q(".silence-cue"), BEATS.koSignal[0] + 0.005, 0.03, { y: 8 });

  // WE … SPEAK … DIFFERENTLY. — placed like a realisation over the first ~55% of the beat, held, then let go.
  const [s0, s1] = BEATS.statement;
  const place = span(BEATS.statement) * 0.55;
  const word = place * 0.4;
  tl.fromTo(
    q(".silence-statement .ct-i"),
    { opacity: 0, y: "0.15em", scale: 1.04, filter: "blur(6px)" },
    { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: word, ease: "power2.out", stagger: (place - word) / 2 },
    s0,
  );
  const out = span(BEATS.statement) * 0.22;
  tl.to(q(".silence-statement"), { opacity: 0, filter: "blur(4px)", duration: out, ease: "power1.in" }, s1 - out);

  // BUT CONVERSATION / should feel natural. — only the words move, so nothing is transformed when it dissolves.
  const [t0] = BEATS.thesis;
  const t = span(BEATS.thesis);
  revealWords(tl, q(".silence-thesis .ct-line:first-child .ct-i"), t0, t * 0.32);
  revealWords(tl, q(".silence-thesis em .ct-i"), t0 + t * 0.3, t * 0.36);
  // The canvas draws particles on these exact glyphs from here on.
  tl.to(q(".silence-thesis"), { autoAlpha: 0, duration: 0.008 }, BEATS.dissolve[0]);
};

const pointTarget = () => (window.innerWidth < 720 ? 700 : window.innerWidth < 1200 ? 1200 : 1600);

/** 01 — THE SIGNAL: darkness, two voices that miss each other, then the statement and the thesis. */
export function SilenceScene() {
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCinematic()) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sample = () => {
      const el = stackRef.current?.querySelector<HTMLElement>(".silence-thesis");
      if (alive && el) thesisPoints.current = sampleTextPoints(el, pointTarget());
    };
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(sample, 150);
    };
    sample();
    document.fonts?.ready.then(sample).catch(() => {});
    window.addEventListener("resize", onResize);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <Scene index={0} timeline={timeline}>
      <div className="frame frame-center">
        <div ref={stackRef} className="stack">
          <CinematicText as="h1" className="silence-statement" lines={["We speak differently."]} />
          <CinematicText className="title-thesis silence-thesis" lines={["But conversation", { em: "should feel natural." }]} />
        </div>
      </div>
      <p className="silence-cue mono" aria-hidden="true">
        <span className="cue-line" />Scroll to begin
      </p>
    </Scene>
  );
}
