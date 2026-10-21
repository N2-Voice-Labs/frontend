import { expect, test } from "vitest";
import { agentHue, buildAgentCards, isLiveStatus, relativeTime } from "@/lib/agent-view";
import type { Agent, Conversation } from "@/lib/platform";

const agent = (over: Partial<Agent> = {}): Agent => ({
  id: "a1", name: "Concierge", description: "", system_prompt: "", enabled_languages: ["en"],
  stt_provider_id: null, llm_provider_id: "p2", tts_provider_id: null, voice_id: null, status: "active", ...over,
});
const conversation = (id: string, agent_id: string, started_at: string): Conversation => ({ id, agent_id, status: "completed", started_at, ended_at: null });

test("agentHue is stable, in range, and differs between agents", () => {
  expect(agentHue("a1")).toBe(agentHue("a1"));
  expect(agentHue("a1")).toBeGreaterThanOrEqual(0);
  expect(agentHue("a1")).toBeLessThan(360);
  expect(agentHue("a1")).not.toBe(agentHue("a2"));
});

test("relativeTime buckets", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  expect(relativeTime("2026-10-14T11:59:40Z", now)).toBe("just now");
  expect(relativeTime("2026-10-14T11:30:00Z", now)).toBe("30 min ago");
  expect(relativeTime("2026-10-14T09:00:00Z", now)).toBe("3 h ago");
  expect(relativeTime("2026-10-11T12:00:00Z", now)).toBe("3 d ago");
  expect(relativeTime("not a date", now)).toBe("");
});

test("isLiveStatus recognises live-ish statuses only", () => {
  expect(["active", "Ready", "LIVE"].every(isLiveStatus)).toBe(true);
  expect(["draft", "paused", ""].some(isLiveStatus)).toBe(false);
});

test("buildAgentCards counts conversations, finds the latest, and flags provider overrides", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  const cards = buildAgentCards(
    [agent(), agent({ id: "a2", name: "Quiet" })],
    [conversation("c1", "a1", "2026-10-14T11:00:00Z"), conversation("c2", "a1", "2026-10-13T11:00:00Z"), conversation("c3", "other", "2026-10-14T11:30:00Z")],
    now,
  );
  expect(cards[0]).toMatchObject({ id: "a1", conversations: 2, lastActive: "1 h ago", overrides: { stt: false, llm: true, tts: false } });
  expect(cards[1]).toMatchObject({ id: "a2", conversations: 0, lastActive: null, lastActiveAt: null });
});
