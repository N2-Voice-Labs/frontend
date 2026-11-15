"use client";

import { useEffect, useRef, useState } from "react";
import { TickIcon } from "@/components/shared/tick-icon";
import type { AgentView } from "@/lib/agents/view";
import { frac } from "@/lib/landing/math";
import { ROUTES } from "@/lib/landing/config";
import { LangDot, PHONE_ICON, PLAY_ICON, agentTone } from "./agent-card";

const P_N = 48;
const HEIGHTS = Array.from({ length: P_N }, (_, i) => {
  const r = frac(Math.sin(i * 7.31 + 1.7) * 43758.5453);
  return Math.round(6 + (0.25 + 0.75 * r) * Math.sin((Math.PI * (i + 0.5)) / P_N) * 34);
});

const STEPS = [
  { key: "speech", label: "Hears", icon: <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v1a7 7 0 0 1-14 0v-1M12 18v4" /> },
  { key: "language", label: "Thinks", icon: <path d="M12 3a6 6 0 0 0-4 10.5V17h8v-3.5A6 6 0 0 0 12 3zM9 21h6" /> },
  { key: "voice", label: "Speaks", icon: <path d="M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> },
] as const;

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
    <aside className="inspector" aria-label="Agent details" data-tone={agentTone(agent.id)}>
      {/* Re-keyed per agent, so the panel's content eases in on every selection. */}
      <div className="insp-in" key={agent.id}>
        <div className="insp-hero">
          <span className="insp-avatar"><TickIcon letter={agent.name.charAt(0).toUpperCase()} size={60} /></span>
          <div className="insp-title">
            <h2>{agent.name}</h2>
            <span className="insp-sub">
              <span className={agent.ready ? "status" : "status draft"}><i /><span>{agent.statusLabel}</span></span>
              <span className="tag" data-kind={agent.kind}>{agent.kind === "interpreter" ? "Interpreter" : "Agent"}</span>
            </span>
          </div>
        </div>

        <p className="insp-purpose">{agent.purpose}</p>
        <div className="insp-langs" aria-label="Languages">
          {agent.langs.map((l) => <span key={l} className="lang-tag"><LangDot lang={l} />{l}</span>)}
        </div>

        {agent.greeting && (
          <div className="greet">
            <span className="mono sm">First message</span>
            <p>“{agent.greeting}”</p>
          </div>
        )}

        <div className="insp-block">
          <span className="mono sm insp-label">Voice / {agent.voice}</span>
          {agent.sample ? (
            <div className="player">
              <button type="button" className="play-btn" aria-label={playing ? "Pause voice preview" : "Play voice preview"} title="Play the first message" onClick={play}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={playing ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5v14l11-7z"} /></svg>
              </button>
              <div className="pbars" aria-hidden="true">
                {HEIGHTS.map((h, i) => <span key={i} className={i < lit ? "on" : undefined} style={{ height: h }} />)}
              </div>
            </div>
          ) : (
            // No recording of this agent's voice yet: say so instead of showing a dead play button.
            <div className="no-preview">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M22 9l-6 6M16 9l6 6" /></svg>
              <span>No preview yet</span>
            </div>
          )}
        </div>

        <div className="insp-block">
          <span className="mono sm insp-label">Voice pipeline</span>
          <ol className="pipeline">
            {STEPS.map((s) => (
              <li key={s.key} className="pipe-step">
                <span className="pipe-node" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
                </span>
                <span className="mono sm pipe-label">{s.label}</span>
                <span className="pipe-name">{agent.providers[s.key]}</span>
              </li>
            ))}
          </ol>
        </div>

        <dl className="kv">
          <div><dt className="mono sm">Mode</dt><dd>{agent.mode}</dd></div>
          <div><dt className="mono sm">Glossary</dt><dd>{agent.glossary ? `${agent.glossary} terms` : "None"}</dd></div>
          {agent.updated && <div><dt className="mono sm">Updated</dt><dd>{agent.updated}</dd></div>}
        </dl>

        <div className="insp-actions">
          <a className="btn btn-primary" href={ROUTES.playgroundFor(agent.id)}>{PLAY_ICON}Test in playground</a>
          <a className="btn btn-ghost" href={ROUTES.callWith(agent.id)}>{PHONE_ICON}Start a call</a>
          <a className="btn btn-ghost" href={ROUTES.agent(agent.id)}>Edit</a>
        </div>
      </div>
    </aside>
  );
}
