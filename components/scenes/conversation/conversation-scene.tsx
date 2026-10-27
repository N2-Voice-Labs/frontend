"use client";

import type { CSSProperties } from "react";
import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { fadeIn, fadeOut, revealWords } from "@/lib/cinematic/gsap";
import { EVENTS, RAIL_WORDS, SEGMENTS, wordAt } from "./script";
import { LANE_Y } from "./visual";

const NAMES = { ko: "Minji", en: "Daniel" } as const;

const timeline: SceneTimeline = (tl, q) => {
  revealWords(tl, q(".conv-title .ct-i"), 0.0, 0.05);
  fadeOut(tl, q(".conv-title"), 0.085, 0.03, { y: -30, scale: 0.9 });
  fadeIn(tl, q(".conv-head"), 0.1, 0.03);
  const caps = q(".cap");
  SEGMENTS.forEach((s, i) => {
    const nextOnLane = SEGMENTS.slice(i + 1).find((n) => n.lane === s.lane);
    const out = Math.min(s.end + 0.06, nextOnLane ? nextOnLane.start - 0.01 : 1, 0.9);
    fadeIn(tl, caps[i], s.start, 0.02, { y: 10 });
    fadeOut(tl, caps[i], out, 0.02, { y: -6 });
  });
  fadeIn(tl, q(".conv-rail"), 0.12, 0.03);
  q(".conv-rail .rail-w").forEach((el) => {
    const at = wordAt((el as HTMLElement).dataset.word as (typeof RAIL_WORDS)[number]);
    tl.fromTo(el, { opacity: 0.22 }, { opacity: 1, duration: 0.02 }, at);
    tl.fromTo(el.querySelector(".rail-dot"), { scale: 0 }, { scale: 1, duration: 0.02 }, at);
  });
  fadeOut(tl, q(".conv-rail, .conv-head"), 0.9, 0.03);
  fadeIn(tl, q(".conv-scrim"), 0.9, 0.03, {});
  revealWords(tl, q(".conv-final .ct-i"), 0.91, 0.05);
};

/** 04 — not translation: timing, a barge-in, a language switch mid-sentence, context carried forward. */
export function ConversationScene() {
  return (
    <Scene index={3} timeline={timeline}>
      <div className="frame frame-center">
        <CinematicText as="h2" className="title-lg conv-title" lines={["Conversation is", { em: "more than translation." }]} />
      </div>
      <p className="conv-head kicker" aria-hidden="true">Conversation is more than translation</p>
      <div className="caps">
        {SEGMENTS.map((s, i) => (
          <p
            key={i}
            className="cap"
            data-lane={s.lane}
            data-kind={s.kind}
            data-cut={s.cut ? "" : undefined}
            style={{ "--lane-y": LANE_Y[s.lane] } as CSSProperties}
          >
            <span className="cap-who">
              {s.kind === "human" ? `${NAMES[s.lane]} speaks` : `Voice Labs → ${NAMES[s.lane]}`} · {s.lane.toUpperCase()}
              {s.cut && <span className="cap-flag"> · yields</span>}
            </span>
            <span className="cap-text" lang={s.lang}>{s.text}</span>
          </p>
        ))}
      </div>
      <ul className="sr-only">
        {EVENTS.map((e) => <li key={e.label}>{e.label.toLowerCase()}</li>)}
      </ul>
      <p className="conv-rail" aria-hidden="true">
        <span className="rail-it">It is</span>
        {RAIL_WORDS.map((w) => (
          <span key={w} className="rail-w" data-word={w}><span className="rail-dot" />{w}</span>
        ))}
      </p>
      <div className="conv-scrim" aria-hidden="true" />
      <div className="frame frame-center">
        <CinematicText className="title-lg conv-final" lines={["It is timing. Context.", "Interruption. Intent.", { em: "Voice." }]} />
      </div>
    </Scene>
  );
}
