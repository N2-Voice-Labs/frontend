import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  buildInviteFragment,
  buildInviteLink,
  formatCountdown,
  parseInviteFragment,
  secondsLeft,
  stripFragment,
  type Invite,
} from "@/lib/invite";
import { JoinExperience } from "@/components/features/call/join-experience";
import { inviteStage } from "@/components/features/call/invite-countdown";

vi.mock("@/lib/platform", () => ({
  getConversation: vi.fn().mockResolvedValue({ id: "c1", agent_id: "a1", status: "active", started_at: "", ended_at: null }),
  getMessages: vi.fn().mockResolvedValue([]),
  ensureVoiceSessionRunning: vi.fn(),
  endVoiceSession: vi.fn(),
}));
vi.mock("livekit-client", () => ({ Room: class {}, RoomEvent: {}, Track: { Kind: { Audio: "audio" }, Source: { Microphone: "microphone" } } }));

const invite: Invite = {
  sessionId: "s1",
  conversationId: "c1",
  url: "wss://livekit.example/rtc",
  token: "lk.guest.token",
  sessionToken: "vls_guest_secret",
  me: "en",
  them: "ko",
  from: "Ji-woo",
  name: "Sam",
  expiresAt: Math.floor(Date.now() / 1000) + 540,
};

beforeEach(() => window.history.replaceState(null, "", "/join"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("an invite round-trips through the fragment, including spaces and non-Latin names", () => {
  const withNames = { ...invite, from: "지우 Kim", name: "Sam & co" };
  const parsed = parseInviteFragment(`#${buildInviteFragment(withNames)}`);
  expect(parsed).toEqual({ ok: true, invite: withNames });
  expect(buildInviteLink("https://voice.example/", invite)).toMatch(/^https:\/\/voice\.example\/join#v=1&s=s1&/);
});

test("missing, incomplete, malformed and unsupported fragments are rejected without throwing", () => {
  expect(parseInviteFragment("")).toEqual({ ok: false, reason: "missing" });
  expect(parseInviteFragment("#")).toEqual({ ok: false, reason: "missing" });
  const params = new URLSearchParams(buildInviteFragment(invite));
  params.delete("t");
  expect(parseInviteFragment(params.toString())).toEqual({ ok: false, reason: "incomplete", from: "Ji-woo" });
  expect(parseInviteFragment("%%%&&&==")).toMatchObject({ ok: false });
  expect(parseInviteFragment(buildInviteFragment({ ...invite, url: "javascript:alert(1)" }))).toMatchObject({ ok: false, reason: "incomplete" });
  expect(parseInviteFragment(buildInviteFragment({ ...invite, them: "en" }))).toMatchObject({ ok: false });
  expect(parseInviteFragment(buildInviteFragment(invite).replace("v=1", "v=9"))).toMatchObject({ ok: false, reason: "unsupported" });
});

test("expiry countdown helpers", () => {
  expect(secondsLeft(1000, 999_000)).toBe(1);
  expect(secondsLeft(1000, 2_000_000)).toBe(0);
  expect(formatCountdown(581)).toBe("9:41");
  expect(formatCountdown(-3)).toBe("0:00");
});

test("stripFragment removes the credentials from the address bar without a reload", () => {
  window.history.replaceState(null, "", `/join?x=1#${buildInviteFragment(invite)}`);
  stripFragment();
  expect(window.location.hash).toBe("");
  expect(window.location.pathname + window.location.search).toBe("/join?x=1");
});

test("/join reads the invite once, strips it, never logs it, and shows who invited you in both languages", async () => {
  const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error"), vi.spyOn(console, "debug")];
  window.history.replaceState(null, "", `/join#${buildInviteFragment(invite)}`);
  render(<JoinExperience />);

  await waitFor(() => expect(screen.getByText("Ji-woo invited you to a call")).toBeTruthy());
  expect(window.location.hash).toBe("");
  expect(screen.getByRole("heading", { name: "Join the call" })).toBeTruthy();
  // Only the native-script part carries lang; "Korean" stays in the page language.
  for (const element of screen.getAllByText("한국어")) expect(element.getAttribute("lang")).toBe("ko");
  expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("Sam");
  expect((screen.getByRole("button", { name: /Join call/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Join within/)).toBeTruthy();
  expect(document.body.innerHTML).not.toContain("vls_guest_secret");
  expect(document.body.innerHTML).not.toContain("lk.guest.token");
  for (const spy of logs) {
    for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain("vls_guest_secret");
  }
});

test("/join without a valid fragment explains what to do and shows no form", async () => {
  window.history.replaceState(null, "", "/join#from=Ji-woo&s=only");
  render(<JoinExperience />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "This invite link is incomplete" })).toBeTruthy());
  expect(screen.getByText(/Ask Ji-woo for a new one/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Join call/ })).toBeNull();
});

test("/join with an expired invite tells the guest who can fix it", async () => {
  window.history.replaceState(null, "", `/join#${buildInviteFragment({ ...invite, expiresAt: Math.floor(Date.now() / 1000) - 5 })}`);
  render(<JoinExperience />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "This invite has expired" })).toBeTruthy());
  expect(screen.getByText("Ask Ji-woo to start a new call.")).toBeTruthy();
});

test("the invite stage only changes at the 1-minute and expiry boundaries (no per-second page renders)", () => {
  const now = 1_000_000_000_000;
  const at = now / 1000;
  expect(inviteStage(at + 600, now)).toBe("open");
  expect(inviteStage(at + 61, now)).toBe("open");
  expect(inviteStage(at + 60, now)).toBe("minute");
  expect(inviteStage(at + 1, now)).toBe("minute");
  expect(inviteStage(at, now)).toBe("expired");
});
