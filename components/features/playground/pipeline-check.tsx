"use client";

import { useEffect, useState } from "react";
import type { ConversationMessage } from "@/lib/platform";

export type StepState = "pending" | "active" | "ok" | "warn" | "fail";
export type PipelineStep = { key: string; label: string; state: StepState; detail: string };

type PipelineInput = {
  phase: string;
  runtimeStatus: string;
  hasConversation: boolean;
  messages: Pick<ConversationMessage, "role">[];
  heardVoice: boolean;
  agentAudio: boolean;
  /** True once the audio room has actually connected during this session. */
  everConnected: boolean;
};

const isUser = (role: string) => role.toLowerCase() === "user";

/**
 * Each step is verified by something that actually happened, never by assumption:
 * a transcript proves the speech provider answered, an agent message proves the language model
 * answered, and agent audio reaching the browser proves the voice provider answered.
 * No transcript text is shown here; that stays in the transcript list.
 */
export function derivePipeline({ phase, runtimeStatus, hasConversation, messages, heardVoice, agentAudio, everConnected }: PipelineInput): PipelineStep[] {
  const userMessage = messages.some((message) => isUser(message.role));
  const agentMessage = messages.some((message) => !isUser(message.role));
  const connected = phase === "connected";
  const started = hasConversation || phase !== "idle";

  const platform: PipelineStep = hasConversation
    ? { key: "platform", label: "Platform API", state: "ok", detail: "Session created" }
    : phase === "starting" ? { key: "platform", label: "Platform API", state: "active", detail: "Creating a session…" }
    : phase === "error" ? { key: "platform", label: "Platform API", state: "fail", detail: "Couldn’t create a session" }
    : { key: "platform", label: "Platform API", state: "pending", detail: "Waiting to start" };

  const runtime: PipelineStep = !hasConversation ? { key: "runtime", label: "Voice runtime", state: "pending", detail: "Waiting for a session" }
    : ["running", "active"].includes(runtimeStatus) ? { key: "runtime", label: "Voice runtime", state: "ok", detail: "Runtime is running" }
    : runtimeStatus === "not_configured" ? { key: "runtime", label: "Voice runtime", state: "warn", detail: "Not configured yet. Start the Runtime service and check its token" }
    : runtimeStatus === "manual_start_required" ? { key: "runtime", label: "Voice runtime", state: "warn", detail: "Needs a manual start" }
    : ["unavailable", "failed"].includes(runtimeStatus) ? { key: "runtime", label: "Voice runtime", state: "fail", detail: "Can’t be reached" }
    : { key: "runtime", label: "Voice runtime", state: "active", detail: "Starting the runtime…" };

  const roomLabel = "Audio room (LiveKit)";
  const room: PipelineStep = connected ? { key: "room", label: roomLabel, state: "ok", detail: "Connected" }
    : phase === "reconnecting" ? { key: "room", label: roomLabel, state: "warn", detail: "Reconnecting…" }
    : phase === "ended" && everConnected ? { key: "room", label: roomLabel, state: "ok", detail: "Session ended" }
    : phase === "starting" && hasConversation ? { key: "room", label: roomLabel, state: "active", detail: "Joining…" }
    : ["ended", "error", "disconnected"].includes(phase) && hasConversation
      ? { key: "room", label: roomLabel, state: "fail", detail: everConnected ? "Disconnected" : "Never connected. LiveKit may not be configured" }
    : { key: "room", label: roomLabel, state: "pending", detail: "Waiting" };

  const mic: PipelineStep = heardVoice ? { key: "mic", label: "Microphone", state: "ok", detail: "Your voice was picked up" }
    : connected ? { key: "mic", label: "Microphone", state: "ok", detail: "Microphone is on. Say something" }
    : everConnected ? { key: "mic", label: "Microphone", state: "ok", detail: "Microphone was on" }
    : phase === "starting" ? { key: "mic", label: "Microphone", state: "active", detail: "Allow access when asked" }
    : { key: "mic", label: "Microphone", state: "pending", detail: "Waiting" };

  const stt: PipelineStep = userMessage ? { key: "stt", label: "Speech-to-text", state: "ok", detail: "Your speech was transcribed. The provider responded" }
    : heardVoice ? { key: "stt", label: "Speech-to-text", state: "active", detail: "Transcribing…" }
    : connected ? { key: "stt", label: "Speech-to-text", state: "active", detail: "Waiting for you to speak" }
    : { key: "stt", label: "Speech-to-text", state: "pending", detail: "Waiting" };

  const llm: PipelineStep = agentMessage ? { key: "llm", label: "Language model", state: "ok", detail: "The agent replied. The provider responded" }
    : userMessage ? { key: "llm", label: "Language model", state: "active", detail: "Thinking…" }
    : { key: "llm", label: "Language model", state: "pending", detail: "Waiting" };

  const tts: PipelineStep = agentAudio ? { key: "tts", label: "Text-to-speech", state: "ok", detail: "Agent audio reached your browser. The provider responded" }
    : agentMessage ? { key: "tts", label: "Text-to-speech", state: "active", detail: "Waiting for audio…" }
    : { key: "tts", label: "Text-to-speech", state: "pending", detail: "Waiting" };

  return started ? [platform, runtime, room, mic, stt, llm, tts] : [platform, runtime, room, mic, stt, llm, tts].map((step) => ({ ...step, state: "pending" as const }));
}

type Props = Omit<PipelineInput, "heardVoice" | "agentAudio" | "everConnected"> & { microphoneActive: boolean; agentSpeaking: boolean };

/** Mount with `key={conversationId}` so each new session starts with a clean slate. */
export function PipelineCheck({ microphoneActive, agentSpeaking, ...rest }: Props) {
  const [heardVoice, setHeardVoice] = useState(false);
  const [agentAudio, setAgentAudio] = useState(false);
  const [everConnected, setEverConnected] = useState(false);
  useEffect(() => { if (rest.phase === "connected") setEverConnected(true); }, [rest.phase]);
  useEffect(() => { if (microphoneActive) setHeardVoice(true); }, [microphoneActive]);
  useEffect(() => { if (agentSpeaking) setAgentAudio(true); }, [agentSpeaking]);

  const steps = derivePipeline({ ...rest, heardVoice, agentAudio, everConnected });
  const provenAll = ["stt", "llm", "tts"].every((key) => steps.find((step) => step.key === key)?.state === "ok");
  const trouble = steps.some((step) => step.state === "fail" || step.state === "warn");

  return (
    <section className="pipe" aria-labelledby="pipe-title">
      <h2 id="pipe-title">Pipeline check</h2>
      <p className={provenAll ? "pipe-banner is-ok" : trouble ? "pipe-banner is-warn" : "pipe-banner"}>
        {provenAll ? "Everything checks out. Your speech, language and voice providers all responded."
          : trouble ? "Something needs attention. See the highlighted step."
          : "Start a conversation and say a few words. Each step lights up from a real result."}
      </p>
      <ol className="pipe-list">
        {steps.map((step) => (
          <li key={step.key} data-state={step.state}>
            <i aria-hidden="true" />
            <span><strong>{step.label}</strong><small>{step.detail}</small></span>
            <em className="sr-only">{step.state === "ok" ? "passed" : step.state === "fail" ? "failed" : step.state === "warn" ? "warning" : step.state === "active" ? "in progress" : "not started"}</em>
          </li>
        ))}
      </ol>
    </section>
  );
}
