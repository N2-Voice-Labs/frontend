import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { derivePipeline, PipelineCheck } from "@/components/features/playground/pipeline-check";
import { deriveStageMode, useStagePreview } from "@/components/features/playground/voice-stage";

afterEach(() => { cleanup(); vi.useRealTimers(); });

const base = { phase: "connected", runtimeStatus: "running", hasConversation: true, messages: [], heardVoice: false, agentAudio: false, everConnected: true };
const state = (steps: ReturnType<typeof derivePipeline>, key: string) => steps.find((step) => step.key === key)?.state;

test("nothing is verified before a session starts", () => {
  const steps = derivePipeline({ ...base, phase: "idle", hasConversation: false, runtimeStatus: "" });
  expect(steps.every((step) => step.state === "pending")).toBe(true);
});

test("providers are only marked working once their real result has arrived", () => {
  const connected = derivePipeline(base);
  expect([state(connected, "platform"), state(connected, "runtime"), state(connected, "room"), state(connected, "mic")]).toEqual(["ok", "ok", "ok", "ok"]);
  expect([state(connected, "stt"), state(connected, "llm"), state(connected, "tts")]).toEqual(["active", "pending", "pending"]);

  const heard = derivePipeline({ ...base, messages: [{ role: "user" }] });
  expect([state(heard, "stt"), state(heard, "llm")]).toEqual(["ok", "active"]);

  const replied = derivePipeline({ ...base, messages: [{ role: "user" }, { role: "assistant" }] });
  expect([state(replied, "llm"), state(replied, "tts")]).toEqual(["ok", "active"]);

  const spoken = derivePipeline({ ...base, messages: [{ role: "user" }, { role: "assistant" }], agentAudio: true });
  expect([state(spoken, "stt"), state(spoken, "llm"), state(spoken, "tts")]).toEqual(["ok", "ok", "ok"]);
});

test("an unconfigured runtime or failed room join is called out instead of hidden", () => {
  expect(state(derivePipeline({ ...base, runtimeStatus: "not_configured", phase: "error" }), "runtime")).toBe("warn");
  expect(state(derivePipeline({ ...base, runtimeStatus: "unavailable" }), "runtime")).toBe("fail");
  expect(state(derivePipeline({ ...base, phase: "error", runtimeStatus: "not_configured" }), "room")).toBe("fail");
  expect(state(derivePipeline({ ...base, phase: "error", hasConversation: false }), "platform")).toBe("fail");
});

test("a session that ended without ever connecting does not show the audio room as working", () => {
  const neverJoined = derivePipeline({ ...base, phase: "ended", everConnected: false, runtimeStatus: "not_configured" });
  expect(state(neverJoined, "room")).toBe("fail");
  expect(state(neverJoined, "mic")).toBe("pending");

  const finished = derivePipeline({ ...base, phase: "ended", everConnected: true });
  expect(state(finished, "room")).toBe("ok");
});

test("PipelineCheck remembers that speech and agent audio happened, and never prints transcript text", () => {
  const props = { phase: "connected", runtimeStatus: "running", hasConversation: true, messages: [{ role: "user" }, { role: "assistant" }] };
  const { rerender } = render(<PipelineCheck {...props} microphoneActive={true} agentSpeaking={false} />);
  expect(screen.getByText(/Start a conversation|Everything checks out|Something needs attention/).textContent).not.toMatch(/Everything checks out/);

  rerender(<PipelineCheck {...props} microphoneActive={false} agentSpeaking={true} />);
  rerender(<PipelineCheck {...props} microphoneActive={false} agentSpeaking={false} />);
  expect(screen.getByText(/Everything checks out/)).toBeTruthy();
  expect(screen.getAllByRole("listitem").every((item) => item.getAttribute("data-state") === "ok")).toBe(true);
});

test("deriveStageMode prefers live speaker signals over the persisted activity label", () => {
  const live = { phase: "connected", microphoneActive: false, agentSpeaking: false, conversationActivity: "Waiting for your speech" };
  expect(deriveStageMode(live)).toBe("listening");
  expect(deriveStageMode({ ...live, conversationActivity: "Thinking" })).toBe("thinking");
  expect(deriveStageMode({ ...live, microphoneActive: true })).toBe("user");
  expect(deriveStageMode({ ...live, microphoneActive: true, agentSpeaking: true })).toBe("agent");
  expect(deriveStageMode({ ...live, phase: "idle" })).toBe("idle");
  expect(deriveStageMode({ ...live, phase: "starting" })).toBe("connecting");
  expect(deriveStageMode({ ...live, phase: "reconnecting" })).toBe("paused");
  expect(deriveStageMode({ ...live, phase: "disconnected" })).toBe("error");
  expect(deriveStageMode({ ...live, phase: "ended" })).toBe("ended");
});

test("the preview loops listening, you, thinking, agent and stops cleanly", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useStagePreview());
  expect(result.current.active).toBe(false);

  act(() => result.current.start());
  expect(result.current.mode).toBe("listening");
  const seen = [result.current.mode];
  for (let i = 0; i < 4; i++) {
    act(() => { vi.advanceTimersByTime(4000); });
    seen.push(result.current.mode);
  }
  expect(new Set(seen)).toEqual(new Set(["listening", "user", "thinking", "agent"]));

  act(() => result.current.stop());
  expect(result.current.active).toBe(false);
  expect(result.current.mode).toBe("idle");
});
