import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { buildInviteLink, formatCountdown, parseInviteCode, secondsLeft, stripFragment } from "@/lib/invite";
import { JoinExperience } from "@/components/features/call/join-experience";
import { inviteStage } from "@/components/features/call/invite-countdown";

const mocks = vi.hoisted(() => ({
  getCallInvite: vi.fn(),
  joinCall: vi.fn(),
  connect: vi.fn(),
  getUserMedia: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({
  getCallInvite: mocks.getCallInvite,
  joinCall: mocks.joinCall,
  getConversation: vi.fn().mockResolvedValue({ id: "c1", agent_id: "a1", status: "active", started_at: "", ended_at: null }),
  getMessages: vi.fn().mockResolvedValue([]),
  ensureVoiceSessionRunning: vi.fn(),
  endCall: vi.fn(),
}));
vi.mock("livekit-client", () => ({
  Room: class {
    localParticipant = { identity: "guest-1", setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined), getTrackPublication: () => undefined };
    remoteParticipants = new Map();
    canPlaybackAudio = true;
    on() { return this; }
    connect = mocks.connect;
    disconnect = vi.fn().mockResolvedValue(undefined);
  },
  RoomEvent: new Proxy({}, { get: (_target, key) => String(key) }),
  Track: { Kind: { Audio: "audio" }, Source: { Microphone: "microphone" } },
}));

const CODE = "11111111-2222-3333-4444-555555555555.abcdefghijklmnopqrstuv";
const info = { from: "Ji-woo", me: "en", them: "ko", expires_at: Math.floor(Date.now() / 1000) + 1700 };
const guest = {
  participant_identity: "guest-1",
  connection: { url: "wss://livekit.example/rtc", token: "lk.guest.token" },
  session_token: "vls_guest_secret",
  session_id: "s1",
  conversation_id: "c1",
  me: "en",
  them: "ko",
  from: "Ji-woo",
};

beforeEach(() => {
  window.history.replaceState(null, "", "/join");
  mocks.getCallInvite.mockResolvedValue(info);
  mocks.joinCall.mockResolvedValue(guest);
  mocks.connect.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: mocks.getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
  });
  mocks.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }], getAudioTracks: () => [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("a link carries only the invitation code, and parses back to it", () => {
  const link = buildInviteLink("https://voice.example/", CODE);
  expect(link).toBe(`https://voice.example/join#c=${encodeURIComponent(CODE)}`);
  expect(parseInviteCode(link.split("#")[1])).toEqual({ ok: true, code: CODE });
  expect(parseInviteCode(`#c=${CODE}`)).toEqual({ ok: true, code: CODE });
});

test("missing, malformed and oversized codes are rejected without throwing", () => {
  expect(parseInviteCode("")).toEqual({ ok: false, reason: "missing" });
  expect(parseInviteCode("#")).toEqual({ ok: false, reason: "missing" });
  expect(parseInviteCode("#c=")).toEqual({ ok: false, reason: "incomplete" });
  expect(parseInviteCode("#x=1")).toEqual({ ok: false, reason: "incomplete" });
  expect(parseInviteCode("#c=nonsense")).toEqual({ ok: false, reason: "incomplete" });
  expect(parseInviteCode("%%%&&&==")).toMatchObject({ ok: false });
  expect(parseInviteCode(`#c=${CODE}${"a".repeat(200)}`)).toEqual({ ok: false, reason: "incomplete" });
  expect(parseInviteCode(`#c=${CODE.replace(".", "<script>")}`)).toEqual({ ok: false, reason: "incomplete" });
});

test("expiry countdown helpers", () => {
  expect(secondsLeft(1000, 999_000)).toBe(1);
  expect(secondsLeft(1000, 2_000_000)).toBe(0);
  expect(formatCountdown(581)).toBe("9:41");
  expect(formatCountdown(-3)).toBe("0:00");
});

test("stripFragment removes the code from the address bar without a reload", () => {
  window.history.replaceState(null, "", `/join?x=1#c=${CODE}`);
  stripFragment();
  expect(window.location.hash).toBe("");
  expect(window.location.pathname + window.location.search).toBe("/join?x=1");
});

test("/join reads the code once, strips it, never logs it, and shows who invited you in both languages", async () => {
  const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error"), vi.spyOn(console, "debug")];
  window.history.replaceState(null, "", `/join#c=${CODE}`);
  render(<JoinExperience />);

  await waitFor(() => expect(screen.getByText("Ji-woo invited you to a call")).toBeTruthy());
  expect(window.location.hash).toBe("");
  expect(mocks.getCallInvite).toHaveBeenCalledWith(CODE);
  expect(screen.getByRole("heading", { name: "Join the call" })).toBeTruthy();
  // Only the native-script part carries lang; "Korean" stays in the page language.
  for (const element of screen.getAllByText("한국어")) expect(element.getAttribute("lang")).toBe("ko");
  expect((screen.getByRole("button", { name: /Join call/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Join within/)).toBeTruthy();
  expect(mocks.joinCall).not.toHaveBeenCalled(); // opening the page seats nobody
  expect(document.body.innerHTML).not.toContain(CODE);
  for (const spy of logs) {
    for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(CODE);
  }
});

test("Join call seats the guest with the code and the typed name, then connects with the guest's own connection", async () => {
  window.history.replaceState(null, "", `/join#c=${CODE}`);
  render(<JoinExperience />);
  await screen.findByText("Ji-woo invited you to a call");
  fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Sam" } });
  fireEvent.click(screen.getByRole("button", { name: /Check microphone/ }));
  await screen.findByText("Say something to test it");
  fireEvent.click(screen.getByRole("button", { name: /Join call/ }));
  await waitFor(() => expect(mocks.joinCall).toHaveBeenCalledWith(CODE, "Sam"));
  await waitFor(() => expect(mocks.connect).toHaveBeenCalledWith("wss://livekit.example/rtc", "lk.guest.token"));
  await screen.findByRole("toolbar", { name: "Call controls" });
});

test("the guest also joins the private listen room, where their translation arrives", async () => {
  mocks.joinCall.mockResolvedValue({ ...guest, connection: { ...guest.connection, listen: { url: "wss://livekit.example/rtc", token: "guest-listen-token", room_name: "r--listen", track: "translation-for-guest-1" } } });
  window.history.replaceState(null, "", `/join#c=${CODE}`);
  render(<JoinExperience />);
  await screen.findByText("Ji-woo invited you to a call");
  fireEvent.click(screen.getByRole("button", { name: /Check microphone/ }));
  await screen.findByText("Say something to test it");
  fireEvent.click(screen.getByRole("button", { name: /Join call/ }));
  await waitFor(() => expect(mocks.connect).toHaveBeenCalledWith("wss://livekit.example/rtc", "guest-listen-token"));
  expect(mocks.connect).toHaveBeenCalledWith("wss://livekit.example/rtc", "lk.guest.token");
});

test("a refused join (someone else holds the seat) is explained and nothing connects", async () => {
  mocks.joinCall.mockRejectedValue(Object.assign(new Error("guest_already_invited"), { status: 409 }));
  window.history.replaceState(null, "", `/join#c=${CODE}`);
  render(<JoinExperience />);
  await screen.findByText("Ji-woo invited you to a call");
  fireEvent.click(screen.getByRole("button", { name: /Check microphone/ }));
  await screen.findByText("Say something to test it");
  fireEvent.click(screen.getByRole("button", { name: /Join call/ }));
  await screen.findByText("Someone else already joined this call with a different link.");
  expect(mocks.connect).not.toHaveBeenCalled();
});

test("/join without a valid code explains what to do and shows no form", async () => {
  window.history.replaceState(null, "", "/join#c=only");
  render(<JoinExperience />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "This invite link is incomplete" })).toBeTruthy());
  expect(mocks.getCallInvite).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Join call/ })).toBeNull();
});

test.each([
  ["invite_expired", "This invite has expired", /send a new link/],
  ["call_ended", "This call has ended", /already ended/],
  ["invite_not_found", "This invite doesn’t work", /isn’t valid/],
])("/join with a %s code tells the guest what happened", async (code, heading, text) => {
  mocks.getCallInvite.mockRejectedValue(Object.assign(new Error(code), { status: 410 }));
  window.history.replaceState(null, "", `/join#c=${CODE}`);
  render(<JoinExperience />);
  await waitFor(() => expect(screen.getByRole("heading", { name: heading })).toBeTruthy());
  expect(screen.getByText(text)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Join call/ })).toBeNull();
});

test("the invite stage only changes at the 1-minute and expiry boundaries (no per-second page renders)", () => {
  const now = 1_000_000_000_000;
  const at = now / 1000;
  expect(inviteStage(at + 1800, now)).toBe("open");
  expect(inviteStage(at + 61, now)).toBe("open");
  expect(inviteStage(at + 60, now)).toBe("minute");
  expect(inviteStage(at + 1, now)).toBe("minute");
  expect(inviteStage(at, now)).toBe("expired");
});
