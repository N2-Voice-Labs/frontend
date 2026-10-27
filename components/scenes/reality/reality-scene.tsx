"use client";

import { useEffect, useState } from "react";
import { CinematicText } from "@/components/cinematic/cinematic-text";
import { Scene, type SceneTimeline } from "@/components/cinematic/scene";
import { useDemoSession, useDemoSnapshot } from "@/components/landing/demo-session";
import { director, isCinematic, subscribeDirector } from "@/lib/cinematic/director";
import { fadeIn, revealWords } from "@/lib/cinematic/gsap";
import { syllables } from "@/lib/cinematic/visual";
import { HISTORY, speakNote } from "@/lib/demo/config";
import { BEATS, BEAT_SECONDS, PEOPLE, SPEAK_END, phaseAt, type Beat, type Phase } from "./reality-script";

const INDEX = 6;

const timeline: SceneTimeline = (tl, q) => {
  revealWords(tl, q(".reality-title .ct-i"), 0.02, 0.1);
  fadeIn(tl, q(".call-wrap"), 0.12, 0.06, { y: 24 });
  fadeIn(tl, q(".reality-actions"), 0.18, 0.05);
};

type Sim = { beat: number; phase: Phase; chars: number };

/** Plays the scripted call while chapter 07 is on screen, and feeds its voices to the canvas horizon. */
function useSimulation(enabled: boolean): Sim | null {
  const [sim, setSim] = useState<Sim>({ beat: 0, phase: "speaking", chars: 0 });
  useEffect(() => {
    if (!enabled) return;
    let raf = 0, start = 0, playing = false;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      // rAF timestamps can be a little older than performance.now() at start.
      const t = Math.max(0, now - start) / 1000;
      const beat = Math.floor(t / BEAT_SECONDS) % BEATS.length;
      const f = (t % BEAT_SECONDS) / BEAT_SECONDS;
      const b = BEATS[beat];
      const phase = phaseAt(f);
      const chars = Math.min(b.said.length, Math.ceil((f / SPEAK_END) * b.said.length));
      // Left half of the horizon is the guest, right half the desk; whoever hears the voice lights up.
      const speakerLevel = phase === "speaking" ? syllables(t, 1) : 0;
      const voiceLevel = phase === "voice" ? syllables(t, 3) * 0.8 : 0;
      director.level.you = b.who === "ko" ? speakerLevel : voiceLevel;
      director.level.agent = b.who === "en" ? speakerLevel : voiceLevel;
      setSim((prev) => (prev.beat === beat && prev.phase === phase && prev.chars === chars ? prev : { beat, phase, chars }));
    };
    const unsubscribe = subscribeDirector((_, chapter) => {
      const on = chapter === INDEX;
      if (on === playing) return;
      playing = on;
      if (on) { start = performance.now(); raf = requestAnimationFrame(step); }
      else { cancelAnimationFrame(raf); director.level.you = director.level.agent = 0; }
    });
    return () => { unsubscribe(); cancelAnimationFrame(raf); };
  }, [enabled]);
  return enabled ? sim : null;
}

/** While a live session runs, the canvas follows the real microphone and agent levels. */
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

const STAGES: { phase: Phase; label: string }[] = [
  { phase: "speaking", label: "Listening" },
  { phase: "turn", label: "End of turn" },
  { phase: "voice", label: "Speaking" },
];

function Person({ side, beat, sim }: { side: "ko" | "en"; beat: Beat; sim: Sim }) {
  const p = PEOPLE[side];
  const speaking = beat.who === side && sim.phase === "speaking";
  const hearing = beat.who !== side && sim.phase === "voice";
  const switched = beat.tag === "CODE-SWITCH" && beat.who === side && speaking;
  return (
    <div className="person" data-side={side} data-active={speaking || hearing}>
      <p className="person-name">{p.name}<span>{p.place}</span></p>
      <p className="person-lang mono">{switched ? `${p.lang} + EN` : p.lang} · {speaking ? "speaking" : hearing ? "hearing Voice Labs" : "listening"}</p>
      <p className="person-line" lang={beat.who === side ? beat.saidLang : beat.heardLang}>
        {beat.who === side ? beat.said.slice(0, sim.chars) : sim.phase === "voice" ? beat.heard : " "}
      </p>
    </div>
  );
}

/** The scripted call, playing. */
function SimulatedCall({ sim }: { sim: Sim }) {
  const beat = BEATS[sim.beat];
  return (
    <div className="call" data-mode="sim">
      <Person side="ko" beat={beat} sim={sim} />
      <div className="call-core">
        <p className="mono">Voice Labs</p>
        <ol className="call-stages">
          {STAGES.map((s) => <li key={s.phase} data-on={s.phase === sim.phase}>{s.label}</li>)}
        </ol>
        <p className="call-tag mono" data-on={Boolean(beat.tag) && sim.phase !== "speaking"}>{beat.tag ?? " "}</p>
        <p className="call-note mono">Simulated call · timing illustrative</p>
      </div>
      <Person side="en" beat={beat} sim={sim} />
    </div>
  );
}

/** The scripted call as a transcript, for reduced motion and the plain-document layout. */
function Transcript() {
  return (
    <ol className="call transcript" data-mode="static">
      {BEATS.map((b, i) => (
        <li key={i}>
          <p className="mono">{PEOPLE[b.who].name} · {PEOPLE[b.who].lang}{b.tag ? ` · ${b.tag.toLowerCase()}` : ""}</p>
          <p lang={b.saidLang}>{b.said}</p>
          <p className="transcript-heard" lang={b.heardLang}>→ {b.heard}</p>
        </li>
      ))}
    </ol>
  );
}

/** A real session with the demo agent (or mic preview), through the page's DemoSession. */
function LiveCall() {
  const { state, captions, stats, message } = useDemoSnapshot();
  return (
    <div className="call" data-mode="live" aria-live="polite">
      <div className="person" data-side="ko" data-active={state === "listening" || state === "preview"}>
        <p className="person-name">You<span>your microphone</span></p>
        <p className="person-line">{captions.you || " "}</p>
      </div>
      <div className="call-core">
        <p className="mono">{state === "connecting" ? "Connecting…" : stats.label}</p>
        <p className="call-value">{state === "connecting" ? "—" : stats.value}</p>
        <p className="call-note mono">{message || stats.note}</p>
      </div>
      <div className="person" data-side="en" data-active={state === "speaking"}>
        <p className="person-name">Voice Labs<span>demo agent</span></p>
        <p className="person-line">{captions.agent || " "}</p>
      </div>
    </div>
  );
}

/** 07 — enough talking: a call playing, and the real thing one click away. */
export function RealityScene() {
  const session = useDemoSession();
  const { state, message } = useDemoSnapshot();
  const [film, setFilm] = useState(false);
  useEffect(() => setFilm(isCinematic()), []);
  const live = state !== "idle";
  const sim = useSimulation(film && !live);
  useLiveLevels(live);

  return (
    <Scene index={INDEX} timeline={timeline}>
      <div className="frame frame-top reality-head">
        <CinematicText as="h2" className="title-md reality-title" lines={["Enough talking.", { em: "Listen." }]} />
      </div>
      <div className="frame reality-body">
        <div className="call-wrap">{live ? <LiveCall /> : sim ? <SimulatedCall sim={sim} /> : <Transcript />}</div>
        <div className="reality-actions">
          <button type="button" className="cta cta-primary" onClick={session.toggle} aria-pressed={live}>
            {state === "connecting" ? "Connecting…" : live ? "End conversation" : "Speak to it"}
          </button>
          <p className="reality-note">{!live && message ? message : speakNote(session.hasAgent)}</p>
        </div>
      </div>
    </Scene>
  );
}
