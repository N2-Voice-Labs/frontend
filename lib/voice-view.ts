import type { Tone } from "./outcomes";
import type { Voice, VoiceSource, VoiceStatus, VoiceStyle } from "./voices";

export const voiceStatusInfo: Record<VoiceStatus, { label: string; tone: Tone; hint: string }> = {
  pending: { label: "Queued", tone: "neutral", hint: "Saved and waiting for the provider to pick it up." },
  processing: { label: "Processing", tone: "warn", hint: "The provider is creating this voice." },
  ready: { label: "Ready", tone: "good", hint: "Agents can speak with this voice." },
  failed: { label: "Failed", tone: "bad", hint: "The provider could not create this voice." },
  disabled: { label: "Disabled", tone: "neutral", hint: "Hidden from agents. Existing agents keep the record." },
};

export const voiceSourceLabel: Record<VoiceSource, string> = { library: "Library", clone: "Cloned", design: "Designed" };

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** "Energy 20% · Warmth 80%" for a card; empty when the voice has no style set. */
export function styleSummary(style: VoiceStyle | null | undefined): string {
  if (!style) return "";
  const parts: string[] = [];
  if (typeof style.energy === "number") parts.push(`Energy ${percent(style.energy)}`);
  if (typeof style.warmth === "number") parts.push(`Warmth ${percent(style.warmth)}`);
  if (typeof style.speed === "number") parts.push(`Speed ${percent(style.speed)}`);
  if (style.style) parts.push(style.style);
  return parts.join(" · ");
}

export const isWaiting = (voice: Pick<Voice, "status">) => voice.status === "pending" || voice.status === "processing";

/** The steps a cloned or designed voice goes through, for the "what happens next" list. */
export function creationSteps(voice: Pick<Voice, "source" | "status">): { label: string; done: boolean; current: boolean }[] {
  const consent = voice.source === "clone";
  const steps = [
    { label: consent ? "Sample and consent saved" : "Design saved", done: true, current: false },
    { label: "Provider creates the voice", done: voice.status === "ready", current: isWaiting(voice) },
    { label: "Ready to use on an agent", done: voice.status === "ready", current: false },
  ];
  return steps;
}
