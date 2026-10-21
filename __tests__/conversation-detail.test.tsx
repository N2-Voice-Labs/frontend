import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useParams } from "next/navigation";
import ConversationDetail from "@/app/(dashboard)/conversations/[id]/page";
import { getConversation, getConversationRuntimeState, getMessages } from "@/lib/platform";

vi.mock("next/navigation", () => ({ useParams: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/platform", () => ({
  getConversation: vi.fn(),
  getConversationRuntimeState: vi.fn(),
  getMessages: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function conversation(id: string) {
  return {
    id,
    agent_id: `agent-${id}`,
    status: "active",
    started_at: "2026-10-13T00:00:00Z",
    ended_at: null,
  };
}

function runtimeState(sessionStatus: string, events: Array<{ event_id: string; event_type: string; payload: Record<string, unknown>; received_at: string }>) {
  return {
    session_id: "session-1",
    session_status: sessionStatus,
    events: events.map((event) => ({ ...event, schema_version: 1 })),
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("keeps the new conversation visible when an old route request resolves late", async () => {
  const conversationA = deferred<ReturnType<typeof conversation>>();
  const conversationB = deferred<ReturnType<typeof conversation>>();
  const messagesA = deferred<never[]>();
  const messagesB = deferred<never[]>();

  vi.mocked(useParams).mockReturnValue({ id: "conversation-A" });
  vi.mocked(getConversation).mockImplementation((id) =>
    id === "conversation-A" ? conversationA.promise : conversationB.promise,
  );
  vi.mocked(getMessages).mockImplementation((id) =>
    id === "conversation-A" ? messagesA.promise : messagesB.promise,
  );
  vi.mocked(getConversationRuntimeState).mockResolvedValue(runtimeState("running", []));

  const view = render(<ConversationDetail />);
  vi.mocked(useParams).mockReturnValue({ id: "conversation-B" });
  view.rerender(<ConversationDetail />);

  await act(async () => {
    conversationB.resolve(conversation("conversation-B"));
    messagesB.resolve([]);
  });
  expect(await screen.findByText("conversation-B")).toBeTruthy();

  await act(async () => {
    conversationA.resolve(conversation("conversation-A"));
    messagesA.resolve([]);
  });

  expect(screen.getByText("conversation-B")).toBeTruthy();
  expect(screen.queryByText("conversation-A")).toBeNull();
});

test("hides the previous transcript while a newly selected conversation is loading", async () => {
  const conversationB = deferred<ReturnType<typeof conversation>>();
  const messagesB = deferred<Array<{
    id: string;
    role: string;
    content: string;
    primary_language: string | null;
    detected_languages: string[];
    created_at: string;
  }>>();

  vi.mocked(useParams).mockReturnValue({ id: "conversation-A" });
  vi.mocked(getConversation).mockImplementation((id) =>
    id === "conversation-A" ? Promise.resolve(conversation(id)) : conversationB.promise,
  );
  vi.mocked(getMessages).mockImplementation((id) => id === "conversation-A"
    ? Promise.resolve([{
      id: "private-message",
      role: "user",
      content: "private transcript from A",
      primary_language: "en",
      detected_languages: ["en"],
      created_at: "2026-10-13T00:00:00Z",
    }])
    : messagesB.promise);
  vi.mocked(getConversationRuntimeState).mockResolvedValue(runtimeState("running", []));

  const view = render(<ConversationDetail />);
  expect(await screen.findByText("private transcript from A")).toBeTruthy();

  vi.mocked(useParams).mockReturnValue({ id: "conversation-B" });
  view.rerender(<ConversationDetail />);

  expect(screen.queryByText("private transcript from A")).toBeNull();
  expect(screen.getByText("Loading conversation…")).toBeTruthy();

  await act(async () => {
    conversationB.resolve(conversation("conversation-B"));
    messagesB.resolve([]);
  });
  expect(await screen.findByText("conversation-B")).toBeTruthy();
});

test("stops polling and hides transcripts when the conversation is not found", async () => {
  vi.useFakeTimers();
  vi.mocked(useParams).mockReturnValue({ id: "missing-conversation" });
  vi.mocked(getConversation).mockRejectedValue(
    Object.assign(new Error("conversation_not_found"), { status: 404 }),
  );
  vi.mocked(getMessages).mockResolvedValue([
    {
      id: "orphaned-message",
      role: "user",
      content: "orphaned transcript",
      primary_language: null,
      detected_languages: [],
      created_at: "2026-10-13T00:00:00Z",
    },
  ]);
  vi.mocked(getConversationRuntimeState).mockResolvedValue(runtimeState("created", []));

  render(<ConversationDetail />);
  await act(async () => {
    await Promise.resolve();
  });

  expect(screen.getByRole("alert").textContent).toContain("conversation_not_found");
  expect(screen.queryByText("orphaned transcript")).toBeNull();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });

  expect(getConversation).toHaveBeenCalledTimes(1);
});

test("loads a valid conversation after navigating away from a missing conversation", async () => {
  vi.mocked(useParams).mockReturnValue({ id: "missing-conversation" });
  vi.mocked(getConversation).mockImplementation(async (id) => {
    if (id === "missing-conversation") {
      throw Object.assign(new Error("conversation_not_found"), { status: 404 });
    }
    return conversation(id);
  });
  vi.mocked(getMessages).mockResolvedValue([]);
  vi.mocked(getConversationRuntimeState).mockResolvedValue(runtimeState("created", []));

  const view = render(<ConversationDetail />);
  expect(await screen.findByRole("alert")).toBeTruthy();

  vi.mocked(useParams).mockReturnValue({ id: "valid-conversation" });
  view.rerender(<ConversationDetail />);

  expect(await screen.findByText("valid-conversation")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("shows persisted voice-session status, interruptions, and disconnect reason", async () => {
  vi.mocked(useParams).mockReturnValue({ id: "conversation-1" });
  vi.mocked(getConversation).mockResolvedValue({
    ...conversation("conversation-1"),
    status: "ended",
    ended_at: "2026-10-13T00:01:00Z",
  });
  vi.mocked(getMessages).mockResolvedValue([]);
  vi.mocked(getConversationRuntimeState).mockResolvedValue(runtimeState("ended", [
    {
      event_id: "event-speech-started",
      event_type: "SpeechStarted",
      payload: {},
      received_at: "2026-10-13T00:00:10Z",
    },
    {
      event_id: "event-speech-stopped",
      event_type: "SpeechStopped",
      payload: {},
      received_at: "2026-10-13T00:00:20Z",
    },
    {
      event_id: "event-agent-started",
      event_type: "AgentSpeechStarted",
      payload: {},
      received_at: "2026-10-13T00:00:25Z",
    },
    {
      event_id: "event-interrupted",
      event_type: "UserInterrupted",
      payload: { reason: "barge_in" },
      received_at: "2026-10-13T00:00:30Z",
    },
    {
      event_id: "event-turn-complete",
      event_type: "TurnCompleted",
      payload: {},
      received_at: "2026-10-13T00:00:40Z",
    },
    {
      event_id: "event-ended",
      event_type: "SessionEnded",
      payload: { reason: "participant_disconnected" },
      received_at: "2026-10-13T00:01:00Z",
    },
  ]));

  render(<ConversationDetail />);

  expect(await screen.findByText("Voice session: ended")).toBeTruthy();
  expect(screen.getByText(/You started speaking/)).toBeTruthy();
  expect(screen.getByText(/You stopped speaking/)).toBeTruthy();
  expect(screen.getByText(/Agent started speaking/)).toBeTruthy();
  expect(screen.getByText(/You interrupted the agent/)).toBeTruthy();
  expect(screen.getByText(/Agent turn completed/)).toBeTruthy();
  expect(screen.getByText(/participant_disconnected/)).toBeTruthy();
});

test("shows an empty activity message when stored events are not displayable activity", async () => {
  vi.mocked(useParams).mockReturnValue({ id: "conversation-1" });
  vi.mocked(getConversation).mockResolvedValue(conversation("conversation-1"));
  vi.mocked(getMessages).mockResolvedValue([]);
  vi.mocked(getConversationRuntimeState).mockResolvedValue(runtimeState("running", [
    {
      event_id: "event-speech-started",
      event_type: "LatencyMeasured",
      payload: {},
      received_at: "2026-10-13T00:00:30Z",
    },
  ]));

  render(<ConversationDetail />);

  expect(await screen.findByText("No lifecycle or interruption activity has been recorded.")).toBeTruthy();
});

test("reports an unavailable transcript instead of presenting it as empty", async () => {
  vi.mocked(useParams).mockReturnValue({ id: "conversation-1" });
  vi.mocked(getConversation).mockResolvedValue(conversation("conversation-1"));
  vi.mocked(getMessages).mockRejectedValue(new Error("message_store_unavailable"));
  vi.mocked(getConversationRuntimeState).mockResolvedValue(runtimeState("ended", []));

  render(<ConversationDetail />);

  expect(await screen.findByText(/Transcript unavailable/)).toBeTruthy();
  expect(screen.queryByText("No finalized transcript messages have been received.")).toBeNull();
});
