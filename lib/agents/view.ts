import { getAgents, getProviders, type Agent, type ProviderConfig } from "@/lib/platform";
import { getVoices, type Voice } from "@/lib/voices";
import { isLiveStatus } from "@/lib/agent-view";

/** What the Agents page shows for one agent, mapped from the Platform's agent, providers and voices. */
export type AgentView = {
  id: string;
  name: string;
  purpose: string;
  ready: boolean;
  statusLabel: string;
  /** Upper-case codes: EN, RU, KO… */
  langs: string[];
  /** The agent's first message. The Platform has no such field yet, so this is null and the block is hidden. */
  greeting: string | null;
  voice: string;
  mode: string;
  providers: { speech: string; language: string; voice: string };
  glossary: number;
  updated: string;
  /** `updated_at` in ms, for sorting; null when the Platform did not send it. */
  updatedAt: number | null;
  /**
   * A real recording of this agent's voice (e.g. its first message rendered by its own TTS voice).
   * Null until one exists: the preview button stays disabled, never a stand-in voice.
   */
  sample: string | null;
};


const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function relativeTime(iso: string | undefined, now: number): string {
  const then = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(then)) return "";
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(then).toLocaleDateString("en", { month: "short", day: "numeric" });
}

const PROVIDER_NAMES: Record<string, string> = { deepgram: "Deepgram", openai: "OpenAI", cartesia: "Cartesia", elevenlabs: "ElevenLabs", google: "Google", azure: "Azure" };
const providerName = (p: string) => PROVIDER_NAMES[p.toLowerCase()] ?? capitalize(p);

function glossaryCount(agent: Agent) {
  const fromInterpreter = agent.interpreter?.glossary;
  if (Array.isArray(fromInterpreter)) return fromInterpreter.length;
  const fromTranslation = agent.translation?.glossary;
  return Array.isArray(fromTranslation) ? fromTranslation.length : 0;
}

function modeLabel(agent: Agent) {
  if (agent.mode === "interpreter" && agent.interpreter) {
    const engine = agent.interpreter.engine === "realtime" ? "Realtime" : "Step-by-step";
    return `${engine} · ${capitalize(agent.interpreter.latency_mode ?? "balanced")}`;
  }
  return agent.translation ? "Agent · with translation" : "Agent";
}

export function toAgentView(agent: Agent, providers: ProviderConfig[], voices: Voice[], now: number): AgentView {
  const provider = (id: string | null) => {
    const p = id ? providers.find((x) => x.id === id) : undefined;
    return p ? providerName(p.provider) : "Default";
  };
  const voice = agent.voice_profile_id ? voices.find((v) => v.id === agent.voice_profile_id) : undefined;
  const langs = agent.mode === "interpreter" && agent.interpreter?.languages?.length ? agent.interpreter.languages : agent.enabled_languages;
  const ready = isLiveStatus(agent.status);
  return {
    id: agent.id,
    name: agent.name,
    purpose: agent.description.trim() || (agent.mode === "interpreter" ? "Live interpreter" : "Voice agent"),
    ready,
    statusLabel: ready ? "Ready" : capitalize(agent.status) || "Draft",
    langs: langs.map((l) => l.toUpperCase()),
    greeting: null,
    voice: voice?.name ?? agent.voice_id ?? "Default voice",
    mode: modeLabel(agent),
    providers: { speech: provider(agent.stt_provider_id), language: provider(agent.llm_provider_id), voice: provider(agent.tts_provider_id) },
    glossary: glossaryCount(agent),
    updated: relativeTime(agent.updated_at, now),
    updatedAt: agent.updated_at && Number.isFinite(Date.parse(agent.updated_at)) ? Date.parse(agent.updated_at) : null,
    sample: null,
  };
}

/**
 * Loads the Agents page data. Providers and voices only enrich the cards, so the page still loads when
 * those calls fail. `?state=loading|error|empty` previews the other states.
 */
export async function listAgents(): Promise<AgentView[]> {
  const forced = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("state");
  if (forced === "loading") return new Promise(() => {});
  if (forced === "error") throw new Error("Platform API is unavailable");
  if (forced === "empty") return [];
  const [agents, providers, voices] = await Promise.all([
    getAgents(),
    getProviders().catch(() => []),
    getVoices().catch(() => []),
  ]);
  const now = Date.now();
  return agents.map((a) => toAgentView(a, providers, voices, now));
}
