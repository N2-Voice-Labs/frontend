import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CallExperience } from "@/components/features/call/call-experience";
import { InvitePanel } from "@/components/features/call/invite-panel";
import { parseInviteFragment } from "@/lib/invite";

const mocks = vi.hoisted(() => ({
  resolveInterpreter: vi.fn(),
  createVoiceSession: vi.fn(),
  endVoiceSession: vi.fn(),
  addSessionParticipant: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getUserMedia: vi.fn(),
}));

vi.mock("@/lib/interpreter", async (original) => ({ ...(await original<typeof import("@/lib/interpreter")>()), resolveInterpreter: mocks.resolveInterpreter }));
vi.mock("@/lib/voices", () => ({ getVoices: vi.fn().mockResolvedValue([]) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/call" }));
vi.mock("@/lib/platform", () => ({
  createVoiceSession: mocks.createVoiceSession,
  endVoiceSession: mocks.endVoiceSession,
  addSessionParticipant: mocks.addSessionParticipant,
  getConversation: vi.fn().mockResolvedValue({ id: "c1", agent_id: "i1", status: "active", started_at: "", ended_at: null }),
  getMessages: vi.fn().mockResolvedValue([]),
  ensureVoiceSessionRunning: vi.fn().mockResolvedValue({ session_status: "created", runtime_status: "starting" }),
}));
vi.mock("livekit-client", () => ({
  Room: class {
    localParticipant = { identity: "browser-s1", setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined), getTrackPublication: () => undefined };
    remoteParticipants = new Map();
    canPlaybackAudio = true;
    on() { return this; }
    connect = mocks.connect;
    disconnect = mocks.disconnect;
  },
  RoomEvent: new Proxy({}, { get: (_target, key) => String(key) }),
  Track: { Kind: { Audio: "audio" }, Source: { Microphone: "microphone" } },
}));

const session = {
  session_id: "s1",
  conversation_id: "c1",
  room_name: "voice-labs-s1",
  connection_status: "configured",
  runtime_status: "accepted",
  connection: { url: "ws://livekit.test", token: "creator-token" },
  session_token: "vls_creator",
};

beforeEach(() => {
  vi.clearAllMocks();
  try { window.localStorage.clear(); } catch { /* ignore */ }
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: mocks.getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
  });
  mocks.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }], getAudioTracks: () => [] });
  mocks.resolveInterpreter.mockResolvedValue({ agent: { id: "i1", name: "English ↔ Korean interpreter" }, created: true });
  mocks.createVoiceSession.mockResolvedValue(session);
  mocks.endVoiceSession.mockResolvedValue({ status: "ended" });
  mocks.connect.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue(undefined);
});
afterEach(cleanup);

async function readyToStart() {
  render(<CallExperience />);
  fireEvent.click(await screen.findByRole("button", { name: /Check microphone/ }));
  await screen.findByText("Say something to test it");
  return screen.getByRole("button", { name: /Start call/ });
}

test("Start call: resolve interpreter → create session with the creator participant → connect LiveKit → live call", async () => {
  const startButton = await readyToStart();
  expect(startButton.getAttribute("aria-disabled")).toBeNull();
  fireEvent.click(startButton);

  await screen.findByRole("heading", { name: "Invite the other person" });
  expect(mocks.resolveInterpreter).toHaveBeenCalledWith({ mine: "en", theirs: "ko", pace: "balanced", hearOriginal: false });
  expect(mocks.createVoiceSession).toHaveBeenCalledWith("i1", { language: "en", display_name: null, voice_profile_id: null });
  expect(mocks.connect).toHaveBeenCalledWith("ws://livekit.test", "creator-token");
  expect(mocks.endVoiceSession).not.toHaveBeenCalled();
  expect(screen.getByRole("toolbar", { name: "Call controls" })).toBeTruthy();
});

test("Start is unavailable until the mic is checked, but stays focusable and explains why", async () => {
  render(<CallExperience />);
  const start = await screen.findByRole("button", { name: /Start call/ });
  expect(start.getAttribute("aria-disabled")).toBe("true");
  expect(document.getElementById(start.getAttribute("aria-describedby")!.split(" ")[0])?.textContent).toMatch(/Check your microphone first/);
  fireEvent.click(start);
  expect(mocks.resolveInterpreter).not.toHaveBeenCalled();
  expect(document.activeElement?.textContent).toMatch(/Check microphone/);
});

test("a failed LiveKit connect ends the partial session and shows a plain error", async () => {
  mocks.connect.mockRejectedValue(new Error("could not establish signal connection"));
  fireEvent.click(await readyToStart());
  await screen.findByText("Couldn’t connect the call audio");
  expect(mocks.endVoiceSession).toHaveBeenCalledWith("s1", "vls_creator");
  expect(screen.getByRole("button", { name: /Start call/ })).toBeTruthy();
});

test("an empty LiveKit token means calls aren't configured: the session is ended, nothing connects", async () => {
  mocks.createVoiceSession.mockResolvedValue({ ...session, connection: { url: "", token: "" } });
  fireEvent.click(await readyToStart());
  await screen.findByText("Calls aren’t set up on this server yet");
  expect(mocks.endVoiceSession).toHaveBeenCalledWith("s1", "vls_creator");
  expect(mocks.connect).not.toHaveBeenCalled();
});

test("leaving while the session is being created ends it once it arrives", async () => {
  let resolve!: (value: typeof session) => void;
  mocks.createVoiceSession.mockReturnValue(new Promise((done) => { resolve = done; }));
  const start = await readyToStart();
  fireEvent.click(start);
  await waitFor(() => expect(mocks.createVoiceSession).toHaveBeenCalled());
  cleanup();
  await act(async () => { resolve(session); });
  await waitFor(() => expect(mocks.endVoiceSession).toHaveBeenCalledWith("s1", "vls_creator"));
  expect(mocks.connect).not.toHaveBeenCalled();
});

test("a voice that isn't ready offers a retry with the interpreter's voice", async () => {
  mocks.createVoiceSession.mockRejectedValueOnce(Object.assign(new Error("selected_voice_unavailable"), { status: 409 }));
  fireEvent.click(await readyToStart());
  fireEvent.click(await screen.findByRole("button", { name: "Use the interpreter’s voice" }));
  await screen.findByRole("heading", { name: "Invite the other person" });
  expect(mocks.createVoiceSession).toHaveBeenLastCalledWith("i1", expect.objectContaining({ voice_profile_id: null }));
});

const panelProps = {
  sessionId: "s1",
  conversationId: "c1",
  sessionToken: "vls_creator",
  selfName: "Sam",
  selfLanguage: "en",
  otherLanguage: "ko",
  otherName: "Ji-woo",
  onOtherNameChange: vi.fn(),
  onExpiredRestart: vi.fn(),
  origin: "https://voice.example",
};

test("Create invite link: adds the guest with the creator's token and builds a /join# link carrying the guest credentials", async () => {
  mocks.addSessionParticipant.mockResolvedValue({ participant_identity: "guest-1", connection: { url: "wss://lk.example", token: "guest-lk" }, session_token: "vls_guest" });
  const onInvite = vi.fn();
  const { rerender } = render(<InvitePanel {...panelProps} invite={null} onInvite={onInvite} />);
  fireEvent.click(screen.getByRole("button", { name: /Create invite link/ }));
  await waitFor(() => expect(onInvite).toHaveBeenCalled());
  expect(mocks.addSessionParticipant).toHaveBeenCalledWith("s1", { language: "ko", display_name: "Ji-woo" }, "vls_creator");

  const created = onInvite.mock.calls[0][0];
  expect(created.link).toMatch(/^https:\/\/voice\.example\/join#/);
  const parsed = parseInviteFragment(created.link.split("#")[1]);
  expect(parsed).toMatchObject({ ok: true, invite: { token: "guest-lk", sessionToken: "vls_guest", me: "ko", them: "en", from: "Sam", name: "Ji-woo" } });

  rerender(<InvitePanel {...panelProps} invite={created} onInvite={onInvite} />);
  expect((screen.getByLabelText("Invite link") as HTMLInputElement).value).toBe(created.link);
  // Honest copy: reusable for 10 minutes, treat it like a password, never "used once".
  expect(screen.getByText(/Treat this link like a password/)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/used once/i);
});

test("session_full explains the single guest slot and offers to start over", async () => {
  mocks.addSessionParticipant.mockRejectedValue(Object.assign(new Error("session_full"), { status: 409 }));
  const onExpiredRestart = vi.fn();
  render(<InvitePanel {...panelProps} invite={null} onInvite={vi.fn()} onExpiredRestart={onExpiredRestart} />);
  fireEvent.click(screen.getByRole("button", { name: /Create invite link/ }));
  fireEvent.click(await screen.findByRole("button", { name: "End call and start a new one" }));
  expect(onExpiredRestart).toHaveBeenCalled();
});

test("the creator is warned once through the status line when the invite has a minute left", async () => {
  const onMinuteLeft = vi.fn();
  const invite = { link: "https://voice.example/join#x", expiresAt: Math.floor(Date.now() / 1000) + 50, name: "Ji-woo" };
  render(<InvitePanel {...panelProps} invite={invite} onInvite={vi.fn()} onMinuteLeft={onMinuteLeft} />);
  await waitFor(() => expect(onMinuteLeft).toHaveBeenCalledWith("The invite link expires in 1 minute."));
  expect(onMinuteLeft).toHaveBeenCalledTimes(1);
});

test("pressing Check microphone moves focus to the result instead of dropping it to <body>", async () => {
  render(<CallExperience />);
  const check = await screen.findByRole("button", { name: /Check microphone/ });
  check.focus();
  fireEvent.click(check);
  await screen.findByText("Say something to test it");
  expect(document.activeElement?.classList.contains("mic-level")).toBe(true);
});
