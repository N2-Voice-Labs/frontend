import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { pairCallMessages, reuseTurns } from "@/lib/call-transcript";
import type { ConversationMessage } from "@/lib/platform";
import { mergeMessages, POLL_MS, REQUEST_TIMEOUT_MS, useCallConversation } from "@/components/features/call/use-call-conversation";

const mocks = vi.hoisted(() => ({ getConversation: vi.fn(), getMessages: vi.fn(), ensure: vi.fn() }));
vi.mock("@/lib/platform", () => ({ getConversation: mocks.getConversation, getMessages: mocks.getMessages, ensureVoiceSessionRunning: mocks.ensure }));

const message = (id: string, role: string, language: string, content: string, second: number): ConversationMessage =>
  ({ id, role, content, primary_language: language, detected_languages: [language], created_at: new Date(Date.UTC(2026, 9, 21, 5, 0, second)).toISOString() });

let visibility: DocumentVisibilityState = "visible";
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  mocks.getConversation.mockResolvedValue({ id: "c1", status: "active" });
  mocks.getMessages.mockResolvedValue([]);
  mocks.ensure.mockResolvedValue({ session_status: "running", runtime_status: "running" });
});
afterEach(() => vi.useRealTimers());

const options = { conversationId: "c1", sessionId: "s1", token: "vls", active: true, interpreterPresent: true };

test("polls with an abort signal, never overlaps, and pauses while the tab is hidden", async () => {
  renderHook(() => useCallConversation(options));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(mocks.getConversation).toHaveBeenCalledTimes(1);
  expect(mocks.getConversation.mock.calls[0][2]).toBeInstanceOf(AbortSignal);

  await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS); });
  expect(mocks.getConversation).toHaveBeenCalledTimes(2);

  visibility = "hidden";
  await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 5); });
  const whileHidden = mocks.getConversation.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 5); });
  expect(mocks.getConversation.mock.calls.length).toBe(whileHidden);

  visibility = "visible";
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0); });
  expect(mocks.getConversation.mock.calls.length).toBe(whileHidden + 1);
});

test("a hung request is aborted after the timeout and the loop carries on", async () => {
  mocks.getConversation.mockImplementationOnce((_id: string, _token: string, signal: AbortSignal) =>
    new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))));
  renderHook(() => useCallConversation(options));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(mocks.getConversation).toHaveBeenCalledTimes(1);
  // No second request while the first is in flight.
  await act(async () => { await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 10); });
  expect(mocks.getConversation).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(20 + 3_000); });
  expect(mocks.getConversation).toHaveBeenCalledTimes(2);
});

test("unchanged polls keep the same array; unchanged messages keep their identity", () => {
  const a = [message("1", "user", "ko", "안녕", 1)];
  const sameAgain = [{ ...a[0] }];
  expect(mergeMessages(a, sameAgain)).toBe(a);
  const grown = mergeMessages(a, [{ ...a[0] }, message("2", "assistant", "en", "Hi", 2)]);
  expect(grown).not.toBe(a);
  expect(grown[0]).toBe(a[0]);
  // Filled in place (same id, new content) is picked up.
  expect(mergeMessages(a, [{ ...a[0], content: "안녕하세요" }])[0].content).toBe("안녕하세요");
});

test("turns keep their identity across re-pairing, so memoised rows don't re-render", () => {
  const first = [message("1", "user", "ko", "안녕", 1), message("2", "assistant", "en", "Hi", 2)];
  const turnsA = pairCallMessages(first, { self: "en", other: "ko" });
  const turnsB = reuseTurns(turnsA, pairCallMessages(first, { self: "en", other: "ko" }));
  expect(turnsB).toBe(turnsA);
  const more = [...first, message("3", "user", "en", "Hello", 3)];
  const turnsC = reuseTurns(turnsB, pairCallMessages(more, { self: "en", other: "ko" }));
  expect(turnsC).not.toBe(turnsB);
  expect(turnsC[0]).toBe(turnsA[0]);
  expect(turnsC[1].status).toBe("pending");
});
