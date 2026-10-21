import type { Conversation, ConversationAction } from "./platform";

/** Mirrors the Platform's allowed outcomes. */
export const OUTCOMES = ["resolved", "booked", "callback_requested", "no_answer", "declined", "escalated", "failed", "other"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export type Tone = "good" | "warn" | "bad" | "neutral";

export const outcomeInfo: Record<Outcome, { label: string; tone: Tone }> = {
  resolved: { label: "Resolved", tone: "good" },
  booked: { label: "Booked", tone: "good" },
  callback_requested: { label: "Callback requested", tone: "warn" },
  no_answer: { label: "No answer", tone: "neutral" },
  declined: { label: "Declined", tone: "neutral" },
  escalated: { label: "Escalated to a person", tone: "warn" },
  failed: { label: "Failed", tone: "bad" },
  other: { label: "Other", tone: "neutral" },
};

export function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return "Not recorded";
  return outcomeInfo[outcome as Outcome]?.label ?? outcome.replaceAll("_", " ");
}

export function outcomeTone(outcome: string | null | undefined): Tone {
  return outcomeInfo[outcome as Outcome]?.tone ?? "neutral";
}

/** The escalation the Platform recorded when the Runtime asked for a person (`handoff_requested`). */
export function handoffOf(conversation: Pick<Conversation, "actions">): { reason: string | null; target: string | null } | null {
  const action = (conversation.actions ?? []).find((item: ConversationAction) => item.type === "handoff_requested");
  return action ? { reason: action.reason ?? null, target: action.target ?? null } : null;
}

export const channelLabel = (channel: string | null | undefined) =>
  ({ web: "Web", sip: "Phone", api: "API" } as Record<string, string>)[channel ?? ""] ?? (channel ? channel : "Unknown");
