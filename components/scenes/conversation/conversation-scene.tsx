"use client";

import { useEffect, useRef } from "react";
import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { isCinematic } from "@/lib/cinematic/director";
import { BEATS } from "./beats";
import { ConversationSignals, signalsTimeline } from "./conversation-signals";
import { PEOPLE, UTTERANCES, WORDS, wordAt, type Speaker, type Utterance } from "./conversation-data";
import { conversationLayout } from "./layout";

/*
 * 04 — a live conversation captured inside the system. The SVG signals (waves, turn markers, the bridge,
 * memories, the handoff) are the main actor; this file adds the human layer on top of them: who speaks,
 * what was said, the five words the system hears, and the headline.
 *
 * Every positioned element gets its position from CSS vars written on resize (from conversationLayout);
 * the timeline only tweens opacity, filters and unitless CSS vars, so it survives resizes.
 */

const SPEAKERS: readonly Speaker[] = ["minji", "daniel"];
const meta = (s: Speaker, langs: readonly string[] = [PEOPLE[s].lang]) => `${langs.join(" / ")} · ${PEOPLE[s].place.toUpperCase()}`;
const who = (u: Utterance) => `${u.source === "voice" ? "Voice Labs → " : ""}${PEOPLE[u.speaker].name} · ${u.langs.join(" / ")}`;
/** Minji's code-switch: the utterance that speaks more than one language. */
const SWITCH = UTTERANCES.find((u) => u.langs.length > 1)!;
const DANIEL_IN = UTTERANCES.find((u) => u.speaker === "daniel")!.start - 0.005;

const timeline: SceneTimeline = (tl, q) => {
  // The signals are the main actor; the type follows them.
  signalsTimeline(tl, q);

  const [h0, h1] = BEATS.headline;

  // Who is speaking: Minji as her wave settles, Daniel the first time his side is heard.
  const people = q(".conv-person-in");
  tl.fromTo(people[0], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.02, ease: "power2.out" }, BEATS.enter[1] - 0.01);
  tl.fromTo(people[1], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.02, ease: "power2.out" }, DANIEL_IN);
  // KO · SEOUL → KO / EN · SEOUL while she switches languages mid-sentence, then back.
  tl.to(q(".conv-meta-a"), { opacity: 0, duration: 0.01 }, SWITCH.start);
  tl.to(q(".conv-meta-b"), { opacity: 1, duration: 0.01 }, SWITCH.start);
  tl.to(q(".conv-meta-a"), { opacity: 1, duration: 0.012 }, SWITCH.end + 0.01);
  tl.to(q(".conv-meta-b"), { opacity: 0, duration: 0.012 }, SWITCH.end + 0.01);

  // What was said: bright while spoken, then memory (dim, drifting away); only the latest two per side.
  const lines = q(".conv-line");
  for (const s of SPEAKERS) {
    const side = UTTERANCES.map((u, i) => ({ u, el: lines[i] })).filter(({ u }) => u.speaker === s);
    side.forEach(({ u, el }, j) => {
      const next = side[j + 1]?.u, after = side[j + 2]?.u;
      tl.fromTo(el, { opacity: 0, "--drift": -0.4 }, { opacity: 1, "--drift": 0, duration: 0.012, ease: "power2.out" }, u.start);
      if (u.interrupted) {
        // Cut where the barge-in happens: a strike through what was left, then gone.
        tl.fromTo(el.querySelector(".conv-strike"), { scaleX: 0 }, { scaleX: 1, duration: 0.005, ease: "power2.out" }, u.end);
        tl.to(el, { opacity: 0, "--drift": 0.3, duration: 0.01, ease: "power1.in" }, u.end + 0.004);
      } else {
        const at = u.end + 0.003;
        const dur = Math.max(0.004, Math.min(0.02, (next?.start ?? h0) - at));
        tl.to(el, { opacity: 0.35, "--drift": 0.25, duration: dur, ease: "power1.out" }, at);
      }
      if (next) tl.to(el, { "--push": 1, duration: 0.014, ease: "power2.out" }, next.start);
      // Gone just before the newest line arrives, so it never crosses the line pushed down after it.
      if (after) tl.to(el, { opacity: 0, duration: 0.006, ease: "power1.in" }, after.start - 0.008);
    });
  }

  // The five words: dim until the system hears each one, a brief flare, then lit.
  tl.fromTo(q(".conv-words-in"), { opacity: 0 }, { opacity: 1, duration: 0.02 }, BEATS.enter[1]);
  q(".conv-word").forEach((el) => {
    const at = wordAt((el as HTMLElement).dataset.word as (typeof WORDS)[number]);
    tl.fromTo(el, { opacity: 0.22 }, { opacity: 1, duration: 0.006, ease: "power2.out" }, at);
    tl.fromTo(el.querySelector(".conv-dot"), { scale: 0 }, { scale: 1, duration: 0.008, ease: "back.out(2)" }, at);
    tl.to(el, { opacity: 0.7, duration: 0.02, ease: "power1.out" }, at + 0.02);
  });

  // CONVERSATION → IS MORE THAN → TRANSLATION. The speakers step back; the words become its continuation.
  const h = h1 - h0;
  tl.to(q(".conv-line"), { opacity: 0, duration: 0.012, ease: "power1.in" }, h0);
  tl.to(people, { opacity: 0, duration: 0.012, ease: "power1.in" }, h0);
  const words = q(".conv-title .ct-i");
  const step = (targets: Element[], at: number, stagger = 0) =>
    tl.fromTo(
      targets,
      { opacity: 0, y: "0.15em", filter: "blur(6px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: h * 0.16, ease: "power2.out", stagger },
      at,
    );
  step(words.slice(0, 1), h0 + h * 0.02);
  step(words.slice(1, -1), h0 + h * 0.22, h * 0.04);
  step(words.slice(-1), h0 + h * 0.44);
  tl.to(q(".conv-words"), { "--lift": 1, duration: h * 0.32, ease: "power2.inOut" }, h0 + h * 0.08);
  tl.to(q(".conv-word"), { opacity: 1, duration: h * 0.1, stagger: h * 0.03, ease: "power1.out" }, h0 + h * 0.56);
  tl.to(q(".conv-stop"), { opacity: 1, duration: h * 0.1, stagger: h * 0.03 }, h0 + h * 0.56);

  // Everything lets go before the layer does; the signals carry the handoff into chapter 05.
  tl.to(q(".conv-head, .conv-words"), { opacity: 0, filter: "blur(4px)", duration: 0.01, ease: "power1.in" }, h1);
};

/** Writes the layout (px) as CSS vars on the layer; measures what the push and the lift depend on. */
function place(root: HTMLElement) {
  const w = window.innerWidth, h = window.innerHeight;
  const L = conversationLayout(w, h);
  const gap = L.portrait ? Math.max(30, h * 0.05) : Math.max(40, Math.min(76, h * 0.075));
  const vars: Record<string, string | number> = {
    "--lw": `${L.portrait ? w - 40 : Math.max(320, L.wave * 2 + 140)}px`,
    "--hy": `${L.headlineY}px`,
    "--ry": `${L.portrait ? h - 76 : h * 0.9}px`,
  };
  for (const [s, k] of [["minji", "m"], ["daniel", "d"]] as const) {
    const p = L[s];
    // Text faces the system: in portrait Daniel (bottom) has his lines above his wave and his name below.
    const flip = L.portrait && s === "daniel";
    vars[`--${k}-x`] = `${p.x}px`;
    vars[`--${k}-py`] = `${flip ? p.y + gap : p.y - gap}px`;
    vars[`--${k}-pa`] = flip ? 0 : 1;
    vars[`--${k}-ly`] = `${flip ? p.y - gap : p.y + gap}px`;
    vars[`--${k}-a`] = flip ? 1 : 0;
    vars[`--${k}-dir`] = flip ? -1 : 1;
  }
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, String(v));

  // A line is pushed out of the way by exactly the height of the next line on its side.
  const lines = [...root.querySelectorAll<HTMLElement>(".conv-line")];
  const heights = lines.map((el) => el.offsetHeight);
  UTTERANCES.forEach((u, i) => {
    const n = UTTERANCES.findIndex((v, j) => j > i && v.speaker === u.speaker);
    lines[i]?.style.setProperty("--hn", `${n < 0 ? 0 : heights[n]}px`);
  });

  // During the headline the rail rises to sit just under it.
  const head = root.querySelector<HTMLElement>(".conv-head .ct");
  const rail = root.querySelector<HTMLElement>(".conv-words");
  if (head && rail) {
    const target = L.headlineY + head.offsetHeight / 2 + Math.max(18, h * 0.035) + rail.offsetHeight / 2;
    rail.style.setProperty("--rail-lift", `${target - parseFloat(String(vars["--ry"]))}px`);
  }
  root.dataset.portrait = String(L.portrait);
}

/** 04 — conversation is more than translation: timing, context, interruption, intent, voice. */
export function ConversationScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !isCinematic()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const run = () => alive && place(root);
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 120);
    };
    run();
    document.fonts?.ready.then(run).catch(() => {});
    window.addEventListener("resize", onResize);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <Scene index={3} timeline={timeline} fadeOutAt={0.99}>
      <ConversationSignals />
      <div ref={rootRef} className="conv">
        <div className="frame frame-center conv-head">
          <CinematicText as="h2" className="conv-title" lines={["Conversation is", { em: "more than translation." }]} />
        </div>

        <div className="conv-people" aria-hidden="true">
          {SPEAKERS.map((s) => (
            <div key={s} className="conv-person" data-speaker={s}>
              <div className="conv-person-in">
                <span className="conv-name">{PEOPLE[s].name}</span>
                <span className="conv-meta">
                  <span className="conv-meta-a">{meta(s)}</span>
                  {s === SWITCH.speaker && <span className="conv-meta-b">{meta(s, SWITCH.langs)}</span>}
                </span>
              </div>
            </div>
          ))}
        </div>

        <ol className="conv-lines" aria-label="The conversation">
          {UTTERANCES.map((u) => (
            <li key={u.id} className="conv-line" data-speaker={u.speaker} data-source={u.source} data-cut={u.interrupted ? "" : undefined}>
              <span className="conv-who">{who(u)}</span>
              {u.source === "voice" && <span className="conv-via" aria-hidden="true">Voice Labs →</span>}
              <span className="conv-text" lang={u.lang}>
                {u.text}
                {u.interrupted && <span className="conv-strike" aria-hidden="true" />}
              </span>
            </li>
          ))}
        </ol>

        <p className="conv-words">
          <span className="conv-words-in">
            <span className="conv-it">It is </span>
            {WORDS.map((w, i) => (
              <span key={w} className="conv-word" data-word={w}>
                <span className="conv-dot" aria-hidden="true" />
                {i === 0 ? w.toLowerCase() : w}
                <span className="conv-stop">.</span>
                {i < WORDS.length - 1 ? " " : null}
              </span>
            ))}
          </span>
        </p>
      </div>
    </Scene>
  );
}
