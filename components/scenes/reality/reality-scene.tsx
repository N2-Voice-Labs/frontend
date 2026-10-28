"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { useDemoSession, useDemoSnapshot } from "@/components/landing/demo-session";
import { director } from "@/lib/cinematic/director";
import { HISTORY, speakNote } from "@/lib/demo/config";
import { BEATS, WORDS } from "./beats";
import { PEOPLE, SCRIPT, type Speaker, type Utterance } from "./conversation-events";
import { RealitySystem, realitySystemTimeline } from "./system/reality-system";
import { realityLayout } from "./system/layout";

const INDEX = 6;
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
const fade = (tl: Parameters<SceneTimeline>[0], el: Element[], at: number, dur: number, to = 0) =>
  tl.to(el, { opacity: to, filter: to ? "blur(0px)" : "blur(4px)", duration: dur, ease: "power1.in" }, at);

const timeline: SceneTimeline = (tl, q) => {
  // The people and the signal between them are the main actor; the type follows.
  realitySystemTimeline(tl, q);

  // TWO LANGUAGES. / One conversation. — over almost nothing.
  const [t0, t1] = BEATS.title;
  const t = span(BEATS.title);
  q(".rl-title .ct-line").forEach((line, i) => realize(tl, [...line.querySelectorAll(".ct-i")], t0 + i * t * 0.3, t * 0.3, t * 0.05));
  fade(tl, q(".rl-open"), t1 - t * 0.12, t * 0.14);

  // Who they are, as the portraits draw in; gone in the silence after the goodbye.
  const [p0, p1] = BEATS.portraits;
  tl.fromTo(q(".rl-person"), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: p1 - p0, stagger: 0.012, ease: "power2.out" }, p0 + 0.02);
  tl.fromTo(q(".rl-lines"), { opacity: 0 }, { opacity: 1, duration: 0.01 }, BEATS.talk[0]);
  fade(tl, q(".rl-lines"), BEATS.silence[0] + 0.01, 0.02);
  fade(tl, q(".rl-person"), BEATS.silence[0] + 0.015, 0.025);

  // CONVERSATION IS MORE THAN TRANSLATION.
  const [h0, h1] = BEATS.thesis;
  const h = span(BEATS.thesis);
  q(".rl-thesis .ct-line").forEach((line, i) => realize(tl, [...line.querySelectorAll(".ct-i")], h0 + i * h * 0.3, h * 0.3, h * 0.04));
  fade(tl, q(".rl-head"), h1 - h * 0.05, h * 0.2);

  // TIMING. CONTEXT. INTERRUPTION. INTENT. VOICE. — one at a time, around the signal.
  const [w0, w1] = BEATS.words;
  const ws = (w1 - w0) / WORDS.length;
  q(".rl-word").forEach((el, i) => {
    tl.fromTo(el, { opacity: 0, filter: "blur(4px)" }, { opacity: 1, filter: "blur(0px)", duration: ws * 0.4, ease: "power2.out" }, w0 + i * ws);
    tl.to(el, { opacity: 0, filter: "blur(4px)", duration: ws * 0.4, ease: "power1.in" }, w0 + i * ws + ws * 0.9);
  });
  const [n0, n1] = BEATS.natural;
  realize(tl, q(".rl-natural .ct-i"), n0, (n1 - n0) * 0.4, (n1 - n0) * 0.08);
  fade(tl, q(".rl-natural"), n1 - 0.005, 0.015);

  // VOICE LABS — the voices connect; the real thing is one click away.
  const [b0, b1] = BEATS.brand;
  const b = span(BEATS.brand);
  realize(tl, q(".rl-brand-name .ct-i"), b0 + b * 0.15, b * 0.25, b * 0.05);
  tl.fromTo(q(".rl-brand .lede, .rl-actions"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: b * 0.25, stagger: b * 0.15, ease: "power2.out" }, b0 + b * 0.4);
  fade(tl, q(".rl-brand"), b1 + 0.02, 0.03);
};

/** While a live session runs, the stage follows the real microphone and agent levels. */
function useLiveLevels(live: boolean) {
  const session = useDemoSession();
  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      director.level.you = session.histYou[HISTORY - 1];
      director.level.agent = session.histAgent[HISTORY - 1];
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); director.level.you = director.level.agent = 0; };
  }, [live, session]);
}

const who = (u: Utterance) => (u.source === "voice" ? `Voice Labs → ${PEOPLE[u.side].name}` : PEOPLE[u.side].name);

/** One line of the call, near its speaker's voice: what they said, or what they heard. */
function Line({ u }: { u: Utterance }) {
  return (
    <p className="rl-line" data-id={u.id} data-side={u.side} data-source={u.source} lang={u.lang}>
      {u.parts
        ? u.parts.map((p, k) => <span key={k} className="rl-part" lang={p.lang}>{p.text}</span>)
        : u.text}
    </p>
  );
}

/** The call as a transcript: the plain-document and reduced-motion version. */
function Transcript() {
  return (
    <ol className="transcript rl-transcript" aria-label="The conversation">
      {SCRIPT.map((u) => (
        <li key={u.id} data-source={u.source}>
          <p className="mono">{who(u)} · {u.lang.toUpperCase()}{u.parts ? " · code-switch" : ""}{u.cut ? " · interrupted" : ""}{u.context ? " · context" : ""}</p>
          <p lang={u.lang}>{u.text}</p>
        </li>
      ))}
    </ol>
  );
}

const PERSON: Record<Speaker, { label: string; lang: string }> = {
  minji: { label: "MINJI", lang: "KO" },
  daniel: { label: "DANIEL", lang: "EN" },
};

/** 07 — the proof: two languages, one conversation. */
export function RealityScene() {
  const session = useDemoSession();
  const { state, message, captions } = useDemoSnapshot();
  const live = state !== "idle";
  useLiveLevels(live);
  const [vars, setVars] = useState<Record<string, string>>({});

  useEffect(() => {
    const place = () => setVars(realityLayout(window.innerWidth, window.innerHeight).vars);
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  return (
    <Scene index={INDEX} timeline={timeline} fadeIn={0.001} fadeOutAt={0.97}>
      <div className="rl" style={vars as CSSProperties} data-live={live || undefined}>
        <RealitySystem live={live} />

        <div className="frame frame-center rl-open">
          <CinematicText as="h2" className="rl-title" lines={["Two languages.", { em: "One conversation." }]} />
        </div>

        <div className="rl-people">
          {(["minji", "daniel"] as const).map((s) => (
            <div key={s} className="rl-person" data-who={s}>
              <span className="rl-name mono">
                {live ? (s === "minji" ? "YOU" : "VOICE LABS") : `${PERSON[s].label} · `}
                {!live && <span className={`rl-lang rl-lang-${s}`}>{PERSON[s].lang}</span>}
              </span>
              <span className="rl-place mono">{live ? (s === "minji" ? "your microphone" : "demo agent") : PEOPLE[s].place}</span>
            </div>
          ))}
        </div>

        {/* Film only (hidden in the plain document, where the transcript reads instead). */}
        <div className="rl-lines" aria-hidden="true">
          {SCRIPT.map((u) => <Line key={u.id} u={u} />)}
          {live && (
            <>
              <p className="rl-live" data-side="minji">{captions.you}</p>
              <p className="rl-live" data-side="daniel">{captions.agent}</p>
            </>
          )}
        </div>
        <Transcript />

        <div className="frame frame-center rl-head">
          <CinematicText as="h2" className="rl-thesis" lines={["Conversation is more", { em: "than translation." }]} />
        </div>
        <ul className="rl-words" aria-label="What a conversation is made of">
          {WORDS.map((w, i) => <li key={w} className="rl-word mono" data-i={i}>{w}</li>)}
        </ul>
        <div className="frame frame-center rl-end">
          <CinematicText className="rl-natural" lines={[{ em: "Natural conversation." }]} />
        </div>

        <div className="frame frame-bottom rl-brand">
          <CinematicText as="h2" className="rl-brand-name" lines={["Voice Labs"]} />
          <p className="lede">Real-time voice infrastructure for a multilingual world.</p>
          <div className="reality-actions rl-actions">
            <button type="button" className="cta cta-primary" onClick={session.toggle} aria-pressed={live}>
              {state === "connecting" ? "Connecting…" : live ? "End conversation" : "Speak to it"}
            </button>
            <p className="reality-note">{!live && message ? message : speakNote(session.hasAgent)}</p>
          </div>
        </div>
      </div>
    </Scene>
  );
}
