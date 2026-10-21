"use client";

import { useEffect, useRef, useState } from "react";
import { TickIcon } from "@/components/shared/tick-icon";
import type { AgentView } from "@/lib/agents/view";
import { frac } from "@/lib/landing/math";
import { ROUTES } from "@/lib/landing/config";

const P_N = 48;
const HEIGHTS = Array.from({ length: P_N }, (_, i) => {
  const r = frac(Math.sin(i * 7.31 + 1.7) * 43758.5453);
  return Math.round(6 + (0.25 + 0.75 * r) * Math.sin((Math.PI * (i + 0.5)) / P_N) * 34);
});

/** Sticky details panel for the selected agent, with its voice preview when a real sample exists. */
export function AgentInspector({ agent }: { agent: AgentView }) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(false);
    setProgress(0);
  };
  // A different agent stops the current preview.
  useEffect(() => stop, [agent.id]);

  const play = () => {
    if (!agent.sample) return;
    if (audio.current) { stop(); return; }
    const a = new Audio(agent.sample);
    audio.current = a;
    setPlaying(true);
    a.addEventListener("timeupdate", () => setProgress(a.currentTime / (a.duration || 1)));
    a.addEventListener("ended", stop);
    a.play().catch(stop);
  };

  const lit = Math.round(progress * P_N);

  return (
    <aside className="inspector" aria-label="Agent details">
      <div className="insp-head">
        <TickIcon letter={agent.name.charAt(0).toUpperCase()} size={52} />
        <div className="insp-title">
          <h2>{agent.name}</h2>
          <span className={agent.ready ? "status" : "status draft"}><i /><span>{agent.statusLabel}</span></span>
        </div>
      </div>
      <span className="mono sm">{agent.purpose} / {agent.langs.join(" · ")}</span>
      {agent.greeting && (
        <div className="greet">
          <span className="mono sm">First message</span>
          <p>“{agent.greeting}”</p>
        </div>
      )}
      <div className="player">
        <button
          type="button"
          className="play-btn"
          aria-label={playing ? "Pause voice preview" : "Play voice preview"}
          title={agent.sample ? "Play the first message" : "No voice preview yet"}
          disabled={!agent.sample}
          onClick={play}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={playing ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5v14l11-7z"} /></svg>
        </button>
        <div className="pbars" aria-hidden="true">
          {HEIGHTS.map((h, i) => <span key={i} className={i < lit ? "on" : undefined} style={{ height: h }} />)}
        </div>
      </div>
      <span className="mono sm">Voice / {agent.voice}</span>
      <div className="kv">
        <div><span className="mono sm">Speech</span><span className="pill">{agent.providers.speech}</span></div>
        <div><span className="mono sm">Language</span><span className="pill">{agent.providers.language}</span></div>
        <div><span className="mono sm">Voice</span><span className="pill">{agent.providers.voice}</span></div>
        <div><span className="mono sm">Mode</span><span className="pill">{agent.mode}</span></div>
        <div><span className="mono sm">Glossary</span><span className="pill">{agent.glossary ? `${agent.glossary} terms` : "None"}</span></div>
      </div>
      <div className="insp-actions">
        <a className="btn btn-primary" href={ROUTES.playgroundFor(agent.id)}>Test in playground</a>
        <a className="btn btn-ghost" href={ROUTES.callWith(agent.id)}>Start a call</a>
        <a className="btn btn-ghost" href={ROUTES.agent(agent.id)}>Edit</a>
      </div>
      {agent.updated && <span className="mono sm">Updated {agent.updated}</span>}
    </aside>
  );
}
