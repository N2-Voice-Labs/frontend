"use client";

import type { CSSProperties } from "react";
import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { fadeIn, fadeOut, revealWords } from "@/lib/cinematic/gsap";

/** Words drifting between the two worlds; `x`/`y` are % of the viewport. Each keeps its own `lang`. */
const FRAGMENTS = [
  { text: "안녕하세요", lang: "ko", x: 14, y: 22 },
  { text: "hello", lang: "en", x: 80, y: 30 },
  { text: "привет", lang: "ru", x: 30, y: 76 },
  { text: "bonjour", lang: "fr", x: 66, y: 16 },
  { text: "你好", lang: "zh", x: 88, y: 70 },
  { text: "hola", lang: "es", x: 8, y: 58 },
  { text: "こんにちは", lang: "ja", x: 58, y: 84 },
  { text: "сәлем", lang: "kk", x: 40, y: 12 },
  { text: "merhaba", lang: "tr", x: 74, y: 56 },
  { text: "नमस्ते", lang: "hi", x: 22, y: 40 },
  { text: "مرحبا", lang: "ar", x: 92, y: 44 },
  { text: "ciao", lang: "it", x: 50, y: 64 },
] as const;

const timeline: SceneTimeline = (tl, q) => {
  fadeIn(tl, q(".distance-kicker"), 0.06, 0.05);
  q(".frag").forEach((el, i) => {
    const x = Number((el as HTMLElement).dataset.x);
    fadeIn(tl, el, 0.1 + i * 0.018, 0.06, { y: 0, scale: 0.9 });
    // Drift toward the wall in the middle, then lose their way.
    tl.to(el, { x: () => (50 - x) * window.innerWidth * 0.005, duration: 0.4 }, 0.12 + i * 0.01);
  });
  fadeOut(tl, q(".frag"), 0.5, 0.08, { y: 0, scale: 0.94 });
  fadeOut(tl, q(".distance-kicker"), 0.5, 0.05);
  revealWords(tl, q(".distance-title .ct-i"), 0.56, 0.16);
  fadeIn(tl, q(".distance-sub"), 0.74, 0.06);
};

/** 02 — two worlds and the wall between them. */
export function DistanceScene() {
  return (
    <Scene index={1} timeline={timeline}>
      <div className="frags" aria-hidden="true">
        {FRAGMENTS.map((f) => (
          <span key={f.text} className="frag" lang={f.lang} data-x={f.x} style={{ "--x": `${f.x}%`, "--y": `${f.y}%` } as CSSProperties}>{f.text}</span>
        ))}
      </div>
      <p className="distance-kicker kicker">Two people · two languages · one conversation that never quite lands</p>
      <div className="frame frame-center">
        <CinematicText as="h2" className="title-lg distance-title" lines={["Language should not", { em: "become a wall." }]} />
        <p className="distance-sub lede">Too many conversations end at the first word nobody shares.</p>
      </div>
    </Scene>
  );
}
