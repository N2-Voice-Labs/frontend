import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useParams } from "next/navigation";
import { beforeEach, expect, test, vi } from "vitest";
import VoicePlayground from "@/app/(dashboard)/agents/[id]/test/page";
import {
  createVoiceSession,
  endVoiceSession,
  ensureVoiceSessionRunning,
  getConversation,
  getConversationRuntimeState,
  getMessages,
} from "@/lib/platform";

const mocks = vi.hoisted(() => {
  const roomEvents: Record<string, (...args: unknown[]) => void> = {};
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    endVoiceSession: vi.fn(),
    ensureVoiceSessionRunning: vi.fn(),
    getConversationRuntimeState: vi.fn(),
    getUserMedia: vi.fn(),
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      roomEvents[event] = callback;
    }),
    roomEvents,
    setMicrophoneEnabled: vi.fn(),
    stopMicrophoneTrack: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({ useParams: vi.fn() }));
vi.mock("@/lib/platform", () => ({
  createVoiceSession: vi.fn(),
  endVoiceSession: mocks.endVoiceSession,
  ensureVoiceSessionRunning: mocks.ensureVoiceSessionRunning,
  getConversation: vi.fn(),
  getConversationRuntimeState: mocks.getConversationRuntimeState,
  getMessages: vi.fn(),
}));
vi.mock("livekit-client", () => ({
  Room: class {
    localParticipant = { setMicrophoneEnabled: mocks.setMicrophoneEnabled };
    on = mocks.on;
    connect = mocks.connect;
    disconnect = mocks.disconnect;
  },
  RoomEvent: {
    ActiveSpeakersChanged: "activeSpeakersChanged",
    Disconnected: "disconnected",
    Reconnected: "reconnected",
    Reconnecting: "reconnecting",
    TrackSubscribed: "trackSubscribed",
    TrackUnsubscribed: "trackUnsubscribed",
  },
  Track: { Kind: { Audio: "audio" } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: mocks.getUserMedia },
  });
  mocks.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: mocks.stopMicrophoneTrack }] });
  vi.mocked(useParams).mockReturnValue({ id: "agent-1" });
  vi.mocked(createVoiceSession).mockResolvedValue({
    session_id: "session-1",
    conversation_id: "conversation-1",
    room_name: "voice-labs-session-1",
    connection_status: "configured",
    runtime_status: "accepted",
    connection: { url: "ws://livekit.test", token: "participant-token" },
  });
  vi.mocked(getConversation).mockResolvedValue({
    id: "conversation-1",
    agent_id: "agent-1",
    status: "active",
    started_at: "2026-10-14T00:00:00Z",
    ended_at: null,
  });
  vi.mocked(getMessages).mockResolvedValue([]);
  vi.mocked(getConversationRuntimeState).mockResolvedValue({
    session_id: "session-1",
    session_status: null,
    events: [],
  });
  mocks.connect.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.endVoiceSession.mockResolvedValue({ status: "ended" });
  mocks.ensureVoiceSessionRunning.mockResolvedValue({
    session_status: "created",
    runtime_status: "starting",
  });
  mocks.setMicrophoneEnabled.mockResolvedValue(undefined);
});

test("unmounting an active playground disconnects LiveKit and ends its Platform session", async () => {
  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  view.unmount();

  await waitFor(() => {
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(endVoiceSession).toHaveBeenCalledWith("session-1");
  });
});

test("shows the persisted runtime session state during a conversation", async () => {
  vi.mocked(getConversationRuntimeState).mockResolvedValue({
    session_id: "session-1",
    session_status: "active",
    events: [],
  });
  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  await waitFor(() => {
    expect(screen.getByText("Runtime handoff: active")).toBeTruthy();
  });
  view.unmount();
});

test("automatically asks Platform to recover a pending Runtime handoff", async () => {
  vi.mocked(getConversationRuntimeState).mockResolvedValue({
    session_id: "session-1",
    session_status: "created",
    events: [],
  });
  mocks.ensureVoiceSessionRunning.mockImplementation(async () => {
    vi.mocked(getConversationRuntimeState).mockResolvedValue({
      session_id: "session-1",
      session_status: "starting",
      events: [],
    });
    return {
      session_status: "created",
      runtime_status: "accepted",
    };
  });
  const view = render(<VoicePlayground />);

  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);
  await waitFor(() => {
    expect(ensureVoiceSessionRunning).toHaveBeenCalledWith("session-1");
    expect(screen.getByText("Runtime handoff: starting")).toBeTruthy();
  });
  view.unmount();
});

test("reconciles an already-running conversation with Runtime health", async () => {
  vi.mocked(getConversationRuntimeState).mockResolvedValue({
    session_id: "session-1",
    session_status: "running",
    events: [],
  });
  mocks.ensureVoiceSessionRunning.mockResolvedValue({
    session_status: "running",
    runtime_status: "running",
  });
  const view = render(<VoicePlayground />);

  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);
  await waitFor(() => {
    expect(ensureVoiceSessionRunning).toHaveBeenCalledWith("session-1");
  });

  view.unmount();
});

test("retries an initially unconfigured handoff after Runtime becomes available", async () => {
  vi.useFakeTimers();
  vi.mocked(createVoiceSession).mockResolvedValueOnce({
    session_id: "session-1",
    conversation_id: "conversation-1",
    room_name: "voice-labs-session-1",
    connection_status: "configured",
    runtime_status: "not_configured",
    connection: { url: "ws://livekit.test", token: "participant-token" },
  });
  vi.mocked(getConversationRuntimeState).mockResolvedValue({
    session_id: "session-1",
    session_status: "created",
    events: [],
  });
  mocks.ensureVoiceSessionRunning.mockImplementation(async () => {
    vi.mocked(getConversationRuntimeState).mockResolvedValue({
      session_id: "session-1",
      session_status: "starting",
      events: [],
    });
    return { session_status: "created", runtime_status: "accepted" };
  });

  const view = render(<VoicePlayground />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(16_000);
  });

  expect(ensureVoiceSessionRunning).toHaveBeenCalledWith("session-1");
  expect(screen.getByText("Runtime handoff: starting")).toBeTruthy();
  view.unmount();
  vi.useRealTimers();
});

test("starts the selected agent conversation, joins with its participant token, and ends it", async () => {
  const view = render(<VoicePlayground />);

  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  expect(createVoiceSession).toHaveBeenCalledWith("agent-1");
  expect(mocks.connect).toHaveBeenCalledWith("ws://livekit.test", "participant-token");
  expect(mocks.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  expect(screen.getByRole("link", { name: "Open conversation history" }).getAttribute("href"))
    .toBe("/conversations/conversation-1");

  fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
  await waitFor(() => {
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(endVoiceSession).toHaveBeenCalledWith("session-1");
    expect(screen.getByRole("status").textContent).toContain("Connection: ended · Session ended and saved.");
  });
  view.unmount();
});

test("requests microphone permission before creating the Platform session", async () => {
  const view = render(<VoicePlayground />);

  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  expect(mocks.getUserMedia).toHaveBeenCalledWith({ audio: true });
  expect(mocks.stopMicrophoneTrack).toHaveBeenCalledOnce();
  expect(mocks.getUserMedia.mock.invocationCallOrder[0])
    .toBeLessThan(vi.mocked(createVoiceSession).mock.invocationCallOrder[0]);
  view.unmount();
});

test("shows actionable microphone permission errors without creating a session", async () => {
  mocks.getUserMedia.mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
  const view = render(<VoicePlayground />);

  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));

  expect((await screen.findByRole("status")).textContent).toContain(
    "Microphone permission was denied. Allow microphone access in your browser and try again.",
  );
  expect(createVoiceSession).not.toHaveBeenCalled();
  view.unmount();
});

test("shows microphone and AI speaking activity from LiveKit speakers", async () => {
  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  act(() => mocks.roomEvents.activeSpeakersChanged([
    { isLocal: true },
    { isLocal: false },
  ]));

  expect(screen.getByText("Microphone activity: Speech detected")).toBeTruthy();
  expect(screen.getByText("AI speaking: Yes")).toBeTruthy();

  act(() => mocks.roomEvents.activeSpeakersChanged([]));
  expect(screen.getByText("Microphone activity: No speech detected")).toBeTruthy();
  expect(screen.getByText("AI speaking: No")).toBeTruthy();
  view.unmount();
});

test("shows a visible error when browser audio playback is blocked", async () => {
  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  const audio = document.createElement("audio");
  audio.play = vi.fn().mockRejectedValue(new DOMException("Playback blocked", "NotAllowedError"));
  const track = {
    kind: "audio",
    attach: vi.fn(() => audio),
    detach: vi.fn(() => [audio]),
  };
  act(() => mocks.roomEvents.trackSubscribed(track));

  expect((await screen.findByRole("alert")).textContent).toContain(
    "The agent is speaking, but this browser blocked audio playback.",
  );
  expect(audio.play).toHaveBeenCalledOnce();
  view.unmount();
});

test("reports an ended session after LiveKit disconnect cleanup succeeds", async () => {
  mocks.endVoiceSession.mockImplementationOnce(async () => {
    vi.mocked(getConversation).mockResolvedValue({
      id: "conversation-1",
      agent_id: "agent-1",
      status: "ended",
      started_at: "2026-10-14T00:00:00Z",
      ended_at: "2026-10-14T00:01:00Z",
    });
    return { status: "ended" };
  });
  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  act(() => mocks.roomEvents.disconnected());

  await waitFor(() => {
    expect(endVoiceSession).toHaveBeenCalledWith("session-1");
    expect(screen.getByRole("status").textContent).toContain(
      "Connection: ended · LiveKit disconnected; session ended.",
    );
  });
  view.unmount();
});

test("lets the user retry Platform cleanup after ending a connected conversation fails", async () => {
  mocks.endVoiceSession
    .mockRejectedValueOnce(new Error("Platform unavailable"))
    .mockResolvedValueOnce({ status: "ended" });

  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
  expect(await screen.findByRole("button", { name: "Retry end session" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Platform unavailable");
  expect(mocks.disconnect).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "Retry end session" }));
  await waitFor(() => {
    expect(mocks.endVoiceSession).toHaveBeenNthCalledWith(1, "session-1");
    expect(mocks.endVoiceSession).toHaveBeenNthCalledWith(2, "session-1");
    expect(screen.getByRole("status").textContent).toContain("Connection: ended · Session ended and saved.");
  });
  expect(mocks.disconnect).toHaveBeenCalledOnce();
  view.unmount();
});

test("ending the route during session creation closes the late Platform session without joining LiveKit", async () => {
  let resolveSession!: (session: Awaited<ReturnType<typeof createVoiceSession>>) => void;
  vi.mocked(createVoiceSession).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSession = resolve;
    }),
  );

  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await waitFor(() => expect(createVoiceSession).toHaveBeenCalledOnce());
  view.unmount();
  resolveSession({
    session_id: "late-session",
    conversation_id: "late-conversation",
    room_name: "voice-labs-late-session",
    connection_status: "configured",
    runtime_status: "accepted",
    connection: { url: "ws://livekit.test", token: "late-token" },
  });

  await waitFor(() => {
    expect(endVoiceSession).toHaveBeenCalledWith("late-session");
  });
  expect(mocks.connect).not.toHaveBeenCalled();
});

test("unmounting during LiveKit connect does not disconnect the room twice", async () => {
  let resolveConnect!: () => void;
  mocks.connect.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveConnect = resolve;
    }),
  );

  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await waitFor(() => expect(mocks.connect).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => {
    resolveConnect();
    await Promise.resolve();
  });

  expect(mocks.disconnect).toHaveBeenCalledOnce();
  expect(mocks.setMicrophoneEnabled).not.toHaveBeenCalled();
});

test("unmounting while an unexpected disconnect is ending the session does not send a duplicate end", async () => {
  let resolveEnd!: () => void;
  mocks.endVoiceSession.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveEnd = resolve;
    }),
  );
  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  act(() => mocks.roomEvents.disconnected());
  view.unmount();
  expect(endVoiceSession).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveEnd();
    await Promise.resolve();
  });
  expect(endVoiceSession).toHaveBeenCalledTimes(1);
});

test("unmounting during explicit session end does not issue a second end request", async () => {
  let resolveEnd!: () => void;
  mocks.endVoiceSession.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveEnd = resolve;
    }),
  );
  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
  await waitFor(() => expect(endVoiceSession).toHaveBeenCalledOnce());
  view.unmount();
  expect(endVoiceSession).toHaveBeenCalledOnce();

  await act(async () => {
    resolveEnd();
    await Promise.resolve();
  });
});

test("unmounting while explicit LiveKit disconnect is pending does not disconnect twice", async () => {
  let resolveDisconnect!: () => void;
  mocks.disconnect.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    }),
  );
  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await screen.findByText(/Connected to LiveKit; microphone is on\./);

  fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
  await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledOnce());
  view.unmount();
  expect(mocks.disconnect).toHaveBeenCalledOnce();

  await act(async () => {
    resolveDisconnect();
    await Promise.resolve();
  });
});

test("unmounting while a failed start is ending its partial session does not issue a second end", async () => {
  let resolveEnd!: () => void;
  mocks.connect.mockRejectedValueOnce(new Error("microphone permission denied"));
  mocks.endVoiceSession.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveEnd = resolve;
    }),
  );
  const view = render(<VoicePlayground />);
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  await waitFor(() => expect(endVoiceSession).toHaveBeenCalledOnce());

  view.unmount();
  expect(endVoiceSession).toHaveBeenCalledOnce();
  await act(async () => {
    resolveEnd();
    await Promise.resolve();
  });
  expect(endVoiceSession).toHaveBeenCalledOnce();
});
