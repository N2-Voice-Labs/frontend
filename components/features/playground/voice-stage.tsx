"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

export type StageMode = "idle" | "connecting" | "listening" | "user" | "thinking" | "agent" | "paused" | "ended" | "error";

const LABELS: Record<StageMode, string> = {
  idle: "Ready when you are",
  connecting: "Connecting…",
  listening: "Listening…",
  user: "You’re speaking",
  thinking: "Thinking…",
  agent: "The agent is speaking",
  paused: "Reconnecting…",
  ended: "Session ended",
  error: "Needs attention",
};

export const stageLabel = (mode: StageMode) => LABELS[mode];

type StageInput = { phase: string; microphoneActive: boolean; agentSpeaking: boolean; conversationActivity: string };

/** Live signals win: LiveKit's speaker flags are real-time, the persisted activity label can lag. */
export function deriveStageMode({ phase, microphoneActive, agentSpeaking, conversationActivity }: StageInput): StageMode {
  switch (phase) {
    case "idle": return "idle";
    case "starting": return "connecting";
    case "reconnecting":
    case "ending": return "paused";
    case "ended": return "ended";
    case "error":
    case "disconnected": return "error";
    default:
      if (agentSpeaking) return "agent";
      if (microphoneActive) return "user";
      return conversationActivity === "Thinking" ? "thinking" : "listening";
  }
}

const BARS = 56;
const bars = Array.from({ length: BARS }, (_, index) => ({
  angle: (index / BARS) * 360,
  delay: ((index * 37) % 100) / 100,
  variance: 0.62 + ((index * 53) % 100) / 100 * 0.6,
}));

function amplitudeFor(mode: StageMode, level: number) {
  if (mode === "user" || mode === "agent") return Math.min(1, Math.max(0.42, level * 3.5));
  return { idle: 0.08, connecting: 0.16, listening: 0.2, thinking: 0.1, paused: 0.1, ended: 0.06, error: 0.06 }[mode];
}

/**
 * A radial voice visual: bars ring a dark core and move with who is speaking.
 * `level` is 0..1 (LiveKit audio level); when it is missing, speaking modes still animate.
 */
export function VoiceStage({ mode, level = 0, hue }: Readonly<{ mode: StageMode; level?: number; hue: number }>) {
  return (
    <div className="voice-stage" data-mode={mode} style={{ "--hue": hue, "--amp": amplitudeFor(mode, level) } as CSSProperties} aria-hidden="true">
      <span className="stage-glow" />
      <span className="stage-ripple" /><span className="stage-ripple" />
      <span className="stage-arc" />
      <span className="stage-bars">
        {bars.map((bar, index) => <i key={index} style={{ "--a": `${bar.angle}deg`, "--d": `-${bar.delay}s`, "--v": bar.variance } as CSSProperties} />)}
      </span>
      <span className="stage-core">
        <span className="stage-mark">v<span>.</span></span>
        <span className="stage-wave"><i /><i /><i /><i /><i /></span>
      </span>
    </div>
  );
}

const PREVIEW_STEPS: { mode: StageMode; ms: number; caption: string }[] = [
  { mode: "listening", ms: 1600, caption: "Listening…" },
  { mode: "user", ms: 2800, caption: "You: “Hi, can you help me with a visa question?”" },
  { mode: "thinking", ms: 1600, caption: "Thinking…" },
  { mode: "agent", ms: 3800, caption: "Agent: “Of course. Which country are you applying to?”" },
];

/** A simulated loop of the four states, for demos without a live session. Never touches the platform. */
export function useStagePreview() {
  const [step, setStep] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const active = step !== null;
  const current = step === null ? null : PREVIEW_STEPS[step];

  useEffect(() => {
    if (step === null) return;
    const timer = window.setTimeout(() => setStep((step + 1) % PREVIEW_STEPS.length), PREVIEW_STEPS[step].ms);
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (!current) return;
    if (current.mode !== "user" && current.mode !== "agent") {
      setLevel(0);
      return;
    }
    const started = performance.now();
    const interval = window.setInterval(() => {
      const t = (performance.now() - started) / 1000;
      setLevel(Math.max(0.05, 0.12 + 0.1 * Math.sin(t * 7) + 0.07 * Math.sin(t * 13.3 + 1) + Math.random() * 0.05));
    }, 110);
    return () => window.clearInterval(interval);
  }, [current]);

  const start = useCallback(() => setStep(0), []);
  const stop = useCallback(() => setStep(null), []);
  return { active, mode: current?.mode ?? "idle", caption: current?.caption ?? "", level, start, stop };
}
