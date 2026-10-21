import type { Agent, Conversation } from "./platform";

export type AgentCardData = {
  id: string;
  name: string;
  description: string;
  status: string;
  languages: string[];
  /** True where the agent overrides the runtime default for that provider layer. */
  overrides: { stt: boolean; llm: boolean; tts: boolean };
  conversations: number;
  lastActive: string | null;
  lastActiveAt: number | null;
  hue: number;
};

/** Stable hue per agent so each one keeps its own colour everywhere it appears. */
export function agentHue(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = (hash * 33) ^ seed.charCodeAt(i);
  return Math.round(((hash >>> 0) * 137.508) % 360);
}

export function relativeTime(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(then).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function isLiveStatus(status: string): boolean {
  return /^(active|ready|enabled|published|live)$/i.test(status);
}

export function statusLabel(status: string): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
}

export function languageLabel(language: string): string {
  return language.toUpperCase();
}

export function buildAgentCards(agents: Agent[], conversations: Conversation[], now: number): AgentCardData[] {
  const byAgent = new Map<string, Conversation[]>();
  for (const conversation of conversations) {
    const list = byAgent.get(conversation.agent_id);
    if (list) list.push(conversation);
    else byAgent.set(conversation.agent_id, [conversation]);
  }

  return agents.map((agent) => {
    const own = byAgent.get(agent.id) ?? [];
    const latest = own.reduce<number | null>((max, item) => {
      const started = Date.parse(item.started_at);
      return Number.isFinite(started) && (max === null || started > max) ? started : max;
    }, null);
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      languages: agent.enabled_languages,
      overrides: { stt: agent.stt_provider_id !== null, llm: agent.llm_provider_id !== null, tts: agent.tts_provider_id !== null },
      conversations: own.length,
      lastActive: latest === null ? null : relativeTime(new Date(latest).toISOString(), now),
      lastActiveAt: latest,
      hue: agentHue(agent.id || agent.name),
    };
  });
}
