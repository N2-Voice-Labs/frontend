"use client";

import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { BEATS, LANGUAGES } from "./beats";

type Span = readonly [number, number];
type Timeline = Parameters<SceneTimeline>[0];

const span = ([a, b]: Span) => b - a;

/** Words settle into place one after another over the first `frac` of the beat, like a realisation. */
function realize(tl: Timeline, words: Element[], beat: Span, frac = 0.45) {
  const place = span(beat) * frac;
  const word = place * 0.4;
  tl.fromTo(
    words,
    { opacity: 0, y: "0.15em", scale: 1.04, filter: "blur(6px)" },
    { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: word, ease: "power2.out", stagger: (place - word) / Math.max(1, words.length - 1) },
    beat[0],
  );
}

/** The whole title recedes (fades, shrinks slightly, blurs) over the last `frac` of the beat. */
function recede(tl: Timeline, el: Element[], beat: Span, frac = 0.22) {
  const out = span(beat) * frac;
  tl.to(el, { opacity: 0, scale: 0.96, filter: "blur(5px)", duration: out, ease: "power1.in" }, beat[1] - out);
}

const timeline: SceneTimeline = (tl, q) => {
  // Handoff → languages → attempts → slow belong to the canvas alone. Then three sentences, one at a time.
  realize(tl, q(".distance-voices .ct-i"), BEATS.statement1);
  recede(tl, q(".distance-voices"), BEATS.statement1);

  realize(tl, q(".distance-language .ct-i"), BEATS.statement2);
  recede(tl, q(".distance-language"), BEATS.statement2);

  realize(tl, q(".distance-thesis .ct-i"), BEATS.thesis, 0.4);
  recede(tl, q(".distance-thesis"), BEATS.thesis, 0.25);
  // firstLink → links → bridge: no text, the canvas speaks.
};

/** 02 — THE DISTANCE: the world fills with voices that cannot reach each other. */
export function DistanceScene() {
  return (
    <Scene index={1} timeline={timeline}>
      {/* The canvas draws these words; here they stay readable for assistive tech and the plain document. */}
      <ul className="sr-only">
        {LANGUAGES.map((l) => (
          <li key={l.id} lang={l.lang}>{l.word}</li>
        ))}
      </ul>
      <div className="frame frame-center">
        <div className="stack">
          <CinematicText className="distance-voices" lines={["The world is full of voices."]} />
          <CinematicText className="distance-language" lines={["But we don't all", { em: "speak the same language." }]} />
          <CinematicText as="h2" className="title-thesis distance-thesis" lines={["Language should not", { em: "become a wall." }]} />
        </div>
      </div>
    </Scene>
  );
}
