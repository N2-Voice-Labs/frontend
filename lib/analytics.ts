import { request } from "./platform";

export type LatencyStats = { count: number; p50: number; p95: number };
export type AnalyticsSummary = {
  conversations: { total: number; by_status: Record<string, number>; by_outcome: Record<string, number>; by_channel: Record<string, number> };
  languages: Record<string, number>;
  /** Keyed by stage (e.g. stt, llm, tts). Empty until the Runtime reports `LatencyMeasured`. */
  latency: Record<string, LatencyStats>;
};

export const getAnalytics = (filter: { agent_id?: string; since?: string } = {}) => {
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value) as [string, string][]).toString();
  return request<AnalyticsSummary>(`/analytics/summary${query ? `?${query}` : ""}`);
};

/** Sorted biggest first, for bar lists. */
export const ranked = (counts: Record<string, number>) => Object.entries(counts).toSorted((a, b) => b[1] - a[1]);
