import { interpreterDirection, languageName } from "./languages";
import { getAgents, saveAgent, type Agent, type InterpreterConfig } from "./platform";

/** "Translation pace" in the UI; `latency_mode` in the API. */
export type TranslationPace = "instant" | "balanced" | "accurate";

export const PACE_OPTIONS: { id: TranslationPace; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "Recommended" },
  { id: "instant", label: "Fast", hint: "Shorter pauses, rougher phrasing" },
  { id: "accurate", label: "Careful", hint: "Waits for whole sentences" },
];

export type InterpreterSettings = {
  /** The creator's language. */
  mine: string;
  /** The other person's language. */
  theirs: string;
  pace: TranslationPace;
  hearOriginal: boolean;
};

/**
 * The agent body for a new call interpreter. `engine: "cascaded"` is always explicit: two-person calls
 * need it, and `instant` pace would otherwise switch to the realtime engine (UX spec §0 F1–F2).
 * `direction` is `auto` only when both languages allow it (F3: any pair with Korean is `one_way`).
 */
export function interpreterAgentBody(settings: InterpreterSettings): Partial<Agent> & Pick<Agent, "name"> {
  const { mine, theirs } = settings;
  const interpreter: InterpreterConfig = {
    languages: [mine, theirs],
    direction: interpreterDirection(mine, theirs),
    engine: "cascaded",
    latency_mode: settings.pace,
    hear_original: settings.hearOriginal,
  };
  return {
    name: `${languageName(mine)} ↔ ${languageName(theirs)} interpreter`,
    description: "Created by Start a call. Reused for calls with the same languages and options.",
    mode: "interpreter",
    interpreter,
    enabled_languages: [mine, theirs],
  };
}

/** True when an existing agent can serve a two-person call with these settings. */
export function matchesInterpreter(agent: Agent, settings: InterpreterSettings): boolean {
  const config = agent.interpreter;
  if (agent.mode !== "interpreter" || !config) return false;
  if ((agent.status ?? "enabled") !== "enabled") return false;
  if ((config.engine ?? "cascaded") !== "cascaded") return false;
  const languages = [...config.languages].sort().join(",");
  if (languages !== [settings.mine, settings.theirs].sort().join(",")) return false;
  if ((config.latency_mode ?? "balanced") !== settings.pace) return false;
  // Never silently reuse a hand-tuned interpreter: one with its own voice or a glossary is left alone.
  if (agent.voice_profile_id || (config.glossary?.length ?? 0) > 0) return false;
  return Boolean(config.hear_original) === settings.hearOriginal;
}

/**
 * Reuses a matching cascaded interpreter, or creates one (product decision 2: auto-create).
 * The created interpreter shows up in /agents and is reused next time.
 */
export async function resolveInterpreter(settings: InterpreterSettings): Promise<{ agent: Agent; created: boolean }> {
  const agents = await getAgents();
  const existing = agents.find((agent) => matchesInterpreter(agent, settings));
  if (existing) return { agent: existing, created: false };
  const agent = await saveAgent(interpreterAgentBody(settings));
  return { agent, created: true };
}
