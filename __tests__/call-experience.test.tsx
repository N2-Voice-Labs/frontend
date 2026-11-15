import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CallExperience } from "@/components/features/call/call-experience";
import { InvitePanel } from "@/components/features/call/invite-panel";
import { parseInviteCode } from "@/lib/invite";

const mocks = vi.hoisted(() => ({
  createCall: vi.fn(),
  endVoiceSession: vi.fn(),
  createCallInvite: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getUserMedia: vi.fn(),
}));

vi.mock("@/lib/voices", () => ({ getVoices: vi.fn().mockResolvedValue([]) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/call" }));
vi.mock("@/lib/platform", () => ({
  createCall: mocks.createCall,
  endCall: mocks.endVoiceSession,
  createCallInvite: mocks.createCallInvite,
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
  mocks.createCall.mockResolvedValue(session);
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

test("Start call: create the call (no account, no agent lookup) → connect LiveKit → live call", async () => {
  const startButton = await readyToStart();
  expect(startButton.getAttribute("aria-disabled")).toBeNull();
  fireEvent.click(startButton);

  await screen.findByRole("heading", { name: "Invite the other person" });
  expect(mocks.createCall).toHaveBeenCalledWith({ languages: ["en", "ko"], name: null, voice_profile_id: null, latency_mode: "balanced", experience: "ai_only" });
  expect(mocks.connect).toHaveBeenCalledWith("ws://livekit.test", "creator-token");
  expect(mocks.endVoiceSession).not.toHaveBeenCalled();
  expect(screen.getByRole("toolbar", { name: "Call controls" })).toBeTruthy();
});

test("the creator also joins the private listen room, where their translation arrives", async () => {
  const listen = { url: "ws://livekit.test", token: "creator-listen-token", room_name: "voice-labs-s1--listen", track: "translation-for-browser-s1" };
  mocks.createCall.mockResolvedValue({ ...session, connection: { ...session.connection, listen } });
  fireEvent.click(await readyToStart());
  await screen.findByRole("heading", { name: "Invite the other person" });
  expect(mocks.connect).toHaveBeenCalledWith("ws://livekit.test", "creator-token");
  expect(mocks.connect).toHaveBeenCalledWith("ws://livekit.test", "creator-listen-token");
});

test("Start is unavailable until the mic is checked, but stays focusable and explains why", async () => {
  render(<CallExperience />);
  const start = await screen.findByRole("button", { name: /Start call/ });
  expect(start.getAttribute("aria-disabled")).toBe("true");
  expect(document.getElementById(start.getAttribute("aria-describedby")!.split(" ")[0])?.textContent).toMatch(/Check your microphone first/);
  fireEvent.click(start);
  expect(mocks.createCall).not.toHaveBeenCalled();
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
  mocks.createCall.mockResolvedValue({ ...session, connection: { url: "", token: "" } });
  fireEvent.click(await readyToStart());
  await screen.findByText("Calls aren’t set up on this server yet");
  expect(mocks.endVoiceSession).toHaveBeenCalledWith("s1", "vls_creator");
  expect(mocks.connect).not.toHaveBeenCalled();
});

test("leaving while the session is being created ends it once it arrives", async () => {
  let resolve!: (value: typeof session) => void;
  mocks.createCall.mockReturnValue(new Promise((done) => { resolve = done; }));
  const start = await readyToStart();
  fireEvent.click(start);
  await waitFor(() => expect(mocks.createCall).toHaveBeenCalled());
  cleanup();
  await act(async () => { resolve(session); });
  await waitFor(() => expect(mocks.endVoiceSession).toHaveBeenCalledWith("s1", "vls_creator"));
  expect(mocks.connect).not.toHaveBeenCalled();
});

test("a voice that isn't ready offers a retry with the interpreter's voice", async () => {
  mocks.createCall.mockRejectedValueOnce(Object.assign(new Error("selected_voice_unavailable"), { status: 409 }));
  fireEvent.click(await readyToStart());
  fireEvent.click(await screen.findByRole("button", { name: "Use the interpreter’s voice" }));
  await screen.findByRole("heading", { name: "Invite the other person" });
  expect(mocks.createCall).toHaveBeenLastCalledWith(expect.objectContaining({ voice_profile_id: null }));
});

const panelProps = {
  sessionId: "s1",
  sessionToken: "vls_creator",
  selfName: "Sam",
  otherLanguage: "ko",
  otherName: "Ji-woo",
  onOtherNameChange: vi.fn(),
  origin: "https://voice.example",
};
const CODE = "11111111-2222-3333-4444-555555555555.abcdefghijklmnopqrstuv";

test("Create invite link: asks the Platform for a code with the creator's token and builds a /join#c= link that carries only the code", async () => {
  mocks.createCallInvite.mockResolvedValue({ code: CODE, expires_at: Math.floor(Date.now() / 1000) + 1800, ttl_seconds: 1800 });
  const onInvite = vi.fn();
  const { rerender } = render(<InvitePanel {...panelProps} invite={null} onInvite={onInvite} />);
  fireEvent.click(screen.getByRole("button", { name: /Create invite link/ }));
  await waitFor(() => expect(onInvite).toHaveBeenCalled());
  expect(mocks.createCallInvite).toHaveBeenCalledWith("s1", "vls_creator");

  const created = onInvite.mock.calls[0][0];
  expect(created.link).toBe(`https://voice.example/join#c=${encodeURIComponent(CODE)}`);
  expect(created.link).not.toMatch(/vls_|token/);
  expect(parseInviteCode(created.link.split("#")[1])).toEqual({ ok: true, code: CODE });

  rerender(<InvitePanel {...panelProps} invite={created} onInvite={onInvite} />);
  expect((screen.getByLabelText("Invite link") as HTMLInputElement).value).toBe(created.link);
  expect(screen.getByText(/Treat this link like a password/)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/used once/i);
});

test("a failed invite request says so and lets the creator try again", async () => {
  mocks.createCallInvite.mockRejectedValue(Object.assign(new Error("session_not_active"), { status: 409 }));
  render(<InvitePanel {...panelProps} invite={null} onInvite={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /Create invite link/ }));
  await screen.findByText("This call has already ended.");
  expect(screen.getByRole("button", { name: /Create invite link/ })).toBeTruthy();
});

test("the audio option is a test switch: AI only by default, cinematic when chosen", async () => {
  render(<CallExperience />);
  fireEvent.click(await screen.findByRole("button", { name: /Check microphone/ }));
  await screen.findByText("Say something to test it");
  fireEvent.click(screen.getByText("Call options"));
  fireEvent.change(screen.getByLabelText("Audio"), { target: { value: "cinematic" } });
  fireEvent.click(screen.getByRole("button", { name: /Start call/ }));
  await waitFor(() => expect(mocks.createCall).toHaveBeenCalled());
  expect(mocks.createCall).toHaveBeenCalledWith(expect.objectContaining({ experience: "cinematic" }));
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
