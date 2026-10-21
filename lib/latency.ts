import type { ConversationRuntimeEvent } from "./platform";

export type LatencyStage = "stt" | "llm" | "tts";
export const latencyStages: { key: LatencyStage; label: string }[] = [
  { key: "stt", label: "Speech-to-text" },
  { key: "llm", label: "Language model" },
  { key: "tts", label: "Text-to-speech" },
];

const METRIC_KEYS = ["metric", "stage", "name"];
const VALUE_KEYS = ["value_ms", "latency_ms", "duration_ms", "value"];

/**
 * Reads `LatencyMeasured` runtime events, in the same shapes the Platform's analytics accepts:
 * { metric | stage | name: "stt", value_ms | latency_ms | duration_ms | value: 180 }.
 * Returns the latest value per stage. Empty until the Runtime reports latency.
 */
export function latestLatency(events: Pick<ConversationRuntimeEvent, "event_type" | "payload">[]): Partial<Record<LatencyStage, number>> {
  const result: Partial<Record<LatencyStage, number>> = {};
  for (const event of events) {
    if (event.event_type !== "LatencyMeasured") continue;
    const metric = METRIC_KEYS.map((key) => event.payload[key]).find((value) => typeof value === "string") as string | undefined;
    const value = VALUE_KEYS.map((key) => event.payload[key]).find((item) => typeof item === "number" && Number.isFinite(item)) as number | undefined;
    const stage = metric?.toLowerCase();
    if (value !== undefined && (stage === "stt" || stage === "llm" || stage === "tts")) result[stage] = Math.round(value);
  }
  return result;
}
