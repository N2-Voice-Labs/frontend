import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { initialCallState, type CallRoomState } from "@/lib/call-state";
import { pairCallMessages } from "@/lib/call-transcript";
import type { ConversationMessage } from "@/lib/platform";
import { CallScreen } from "@/components/features/call/call-screen";
import { InterpreterBridge } from "@/components/features/call/interpreter-bridge";
import { LevelMeter } from "@/components/features/call/level-meter";
import { LevelStore } from "@/components/features/call/level-store";
import { ParticipantCard } from "@/components/features/call/participant-card";
import { Transcript } from "@/components/features/call/transcript";

afterEach(cleanup);

const names = { self: "Sam", other: "Ji-woo", selfLanguage: "English", otherLanguage: "Korean" };
const people = { selfName: "Sam", otherName: "Ji-woo", selfLanguage: "en", otherLanguage: "ko" };

test("participant card: name, both languages and the state are text, and the card label carries them", () => {
  const { rerender } = render(<ParticipantCard seat="other" name="Ji-woo" speaks="ko" hears="en" state="speaking" quality="good" />);
  const card = screen.getByRole("article", { name: "Ji-woo, speaks Korean, hears English, speaking" });
  expect(within(card).getByText("Speaking")).toBeTruthy();
  // English language names stay in the page language; only native script carries lang (WCAG 3.1.2).
  expect(within(card).getByText("Korean").getAttribute("lang")).toBeNull();
  expect(within(card).getByText("hears English").closest("[lang]")).toBeNull();
  expect(within(card).queryByText("You")).toBeNull();
  expect(card.getAttribute("data-seat")).toBe("other");

  rerender(<ParticipantCard seat="other" name="Ji-woo" speaks="ko" hears="en" state="reconnecting" quality="poor" />);
  expect(screen.getByRole("article", { name: /reconnecting, weak connection$/ })).toBeTruthy();
  expect(screen.getByText("Weak connection")).toBeTruthy();

  rerender(<ParticipantCard seat="self" name="Sam" speaks="en" hears="ko" state="muted" quality="good" />);
  expect(screen.getByRole("article", { name: "Sam (you), speaks English, hears Korean, muted" })).toBeTruthy();
  expect(screen.getByText("You")).toBeTruthy();
  expect(screen.getByText("Muted")).toBeTruthy();

  rerender(<ParticipantCard seat="other" name="Ji-woo" speaks="ko" hears="en" state="waiting" quality="unknown" />);
  expect(screen.getByText("Not joined yet")).toBeTruthy();
});

test("bridge: an image whose label states the direction in words", () => {
  const { rerender, container } = render(<InterpreterBridge mode="translating" toward="self" names={names} />);
  expect(screen.getByRole("img", { name: "Translating into English…" })).toBeTruthy();
  expect(container.querySelector(".bridge")?.getAttribute("data-toward")).toBe("self");
  expect(container.querySelector(".bridge-packet")).not.toBeNull();

  rerender(<InterpreterBridge mode="speaking" toward="other" names={names} />);
  expect(screen.getByRole("img", { name: "Ji-woo is hearing you in Korean" })).toBeTruthy();
  expect(container.querySelector(".bridge-packet")).toBeNull();

  rerender(<InterpreterBridge mode="starting" toward={null} names={names} />);
  expect(screen.getByRole("img", { name: "Interpreter starting…" })).toBeTruthy();
  expect(container.querySelector(".bridge-arrow")).toBeNull();
});

test("level meters are written through a CSS variable, not React state, and skip tiny changes", () => {
  const store = new LevelStore({ reducedMotion: false });
  const renders = vi.fn();
  function Probe() {
    renders();
    return <LevelMeter store={store} source="self" tone="self" active />;
  }
  const { container } = render(<Probe />);
  const meter = container.querySelector<HTMLElement>(".level-meter")!;
  act(() => {
    store.set("self", 0.5);
    store.set("self", 0.51);
    store.set("self", 0.9);
  });
  expect(meter.style.getPropertyValue("--level")).toBe("0.90");
  expect(meter.dataset.active).toBe("true");
  store.set("self", 0.01);
  expect(meter.style.getPropertyValue("--level")).toBe("0.00");
  expect(renders).toHaveBeenCalledTimes(1);

  const reduced = new LevelStore({ reducedMotion: true });
  const element = document.createElement("span");
  reduced.bind("other", element);
  reduced.set("other", 0.5, 1000);
  expect(element.style.getPropertyValue("--level")).toBe("0.66");
  reduced.set("other", 0.95, 1200);
  expect(element.style.getPropertyValue("--level")).toBe("0.66");
  reduced.set("other", 0.95, 1600);
  expect(element.style.getPropertyValue("--level")).toBe("1.00");
});

const message = (id: string, role: string, language: string, content: string, second: number): ConversationMessage =>
  ({ id, role, content, primary_language: language, detected_languages: [language], created_at: new Date(Date.UTC(2026, 9, 21, 5, 0, second)).toISOString() });
const now = Date.UTC(2026, 9, 21, 5, 0, 20);
const turns = pairCallMessages([
  message("1", "user", "ko", "내일 회의 몇 시예요?", 1),
  message("2", "assistant", "en", "What time is the meeting tomorrow?", 2),
  message("3", "user", "en", "At ten, in the main office.", 3),
  message("4", "assistant", "ko", "열 시에 본사에서요.", 4),
  message("5", "user", "ko", "그리고 점심도 같이 해요.", 15),
], { self: "en", other: "ko" }, now);

test("transcript: the viewer's language is primary, originals keep their lang, pending shows 'Translating…'", () => {
  const { container } = render(<Transcript turns={turns} people={people} />);
  const rows = container.querySelectorAll(".turn");
  expect(rows).toHaveLength(3);

  // Their speech: the translation is the primary line, labelled "Translated".
  expect(rows[0].getAttribute("data-seat")).toBe("other");
  expect(rows[0].querySelector(".turn-primary")?.textContent).toBe("TranslatedWhat time is the meeting tomorrow?");
  expect(within(rows[0] as HTMLElement).getByText("내일 회의 몇 시예요?").getAttribute("lang")).toBe("ko");

  // My speech: my original is primary, "What Ji-woo heard" underneath.
  expect(rows[1].querySelector(".turn-primary")?.textContent).toBe("At ten, in the main office.");
  expect(within(rows[1] as HTMLElement).getByText("What Ji-woo heard")).toBeTruthy();
  expect(within(rows[1] as HTMLElement).getByText("You")).toBeTruthy();

  expect(rows[2].getAttribute("data-status")).toBe("pending");
  expect(within(rows[2] as HTMLElement).getByText(/Translating into English…/)).toBeTruthy();

  // Screen readers hear only the other person's completed lines, in the viewer's language.
  const log = screen.getByRole("log", { name: "New translations" });
  expect(log.getAttribute("aria-live")).toBe("polite");
  expect(log.textContent).toBe("Ji-woo: What time is the meeting tomorrow?");
});

test("transcript: empty state and no announcements when turned off", () => {
  const { rerender } = render(<Transcript turns={[]} people={people} />);
  expect(screen.getByText("When someone speaks, their words and the translation appear here.")).toBeTruthy();
  rerender(<Transcript turns={turns} people={people} announce={false} />);
  expect(screen.getByRole("log", { name: "New translations" }).getAttribute("aria-live")).toBe("off");
});

const live: CallRoomState = {
  ...initialCallState,
  phase: "live",
  connectedAt: Date.now() - 5000,
  other: { ...initialCallState.other, presence: "present", everJoined: true },
  interpreter: { present: true, everJoined: true, speaking: false, unavailable: false },
};

function renderScreen(state: CallRoomState, overrides: Partial<Parameters<typeof CallScreen>[0]> = {}) {
  const handlers = { onToggleMute: vi.fn(), onEnd: vi.fn(), onStartAudio: vi.fn() };
  render(<CallScreen role="creator" state={state} self={{ name: "Sam", language: "en" }} other={{ name: "Ji-woo", language: "ko" }} turns={turns} {...handlers} {...overrides} />);
  return handlers;
}

test("call screen: one status region, people and transcript landmarks, a labelled toolbar, End needs confirmation", async () => {
  const handlers = renderScreen({ ...live, other: { ...live.other, presence: "waiting" } }, { invite: <p>Invite panel</p> });
  expect(screen.getAllByRole("status")).toHaveLength(1);
  // Born empty, filled after mount, so screen readers announce it.
  expect(screen.getByRole("status").textContent).toBe("");
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Waiting for Ji-woo to join."));
  expect(screen.getByRole("region", { name: "Participants" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Transcript" })).toBeTruthy();
  expect(screen.getByText("Invite panel")).toBeTruthy();

  const toolbar = screen.getByRole("toolbar", { name: "Call controls" });
  const mute = within(toolbar).getByRole("button", { name: "Mute" });
  expect(mute.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(mute);
  expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);

  // Single-key shortcuts fire only while focus is inside the call screen (WCAG 2.1.4).
  (document.activeElement as HTMLElement | null)?.blur(); // the h1 got focus on connect; move it out
  fireEvent.keyDown(document.body, { key: "m" });
  expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
  mute.focus();
  fireEvent.keyDown(mute, { key: "m" });
  expect(handlers.onToggleMute).toHaveBeenCalledTimes(2);

  fireEvent.click(within(toolbar).getByRole("button", { name: "End call" }));
  const dialog = screen.getByRole("dialog", { name: "End the call for both of you?" });
  expect(document.activeElement?.textContent).toBe("Cancel");
  expect(handlers.onEnd).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "End call" }));
  expect(handlers.onEnd).toHaveBeenCalledTimes(1);
});

test("call screen: blocked sound is an alert with a fix; a failed end offers Retry end call", () => {
  const handlers = renderScreen({ ...live, soundBlocked: true });
  expect(screen.getByRole("alert").textContent).toMatch(/Sound is blocked/);
  fireEvent.click(screen.getByRole("button", { name: /Tap to turn on sound/ }));
  expect(handlers.onStartAudio).toHaveBeenCalled();
  cleanup();

  const again = renderScreen({ ...live, phase: "disconnected", endError: "Platform returned 503" });
  fireEvent.click(screen.getByRole("button", { name: "Retry end call" }));
  expect(again.onEnd).toHaveBeenCalled();
});

test("call screen: muted state flips the mic button and is reflected on your card", () => {
  renderScreen({ ...live, self: { ...live.self, muted: true } });
  // Toggle model: fixed name "Mute" + aria-pressed (the visible word says "Unmute").
  const mic = screen.getByRole("button", { name: "Mute" });
  expect(mic.getAttribute("aria-pressed")).toBe("true");
  expect(mic.textContent).toBe("Unmute");
  expect(screen.getByRole("article", { name: /^Sam \(you\).*muted$/ })).toBeTruthy();
});

test("transitions the status line would skip are announced once: muted, joined, reconnected", async () => {
  const props = { role: "creator" as const, self: { name: "Sam", language: "en" }, other: { name: "Ji-woo", language: "ko" }, turns: [], onToggleMute: vi.fn(), onEnd: vi.fn(), onStartAudio: vi.fn() };
  const waiting = { ...live, other: { ...live.other, presence: "waiting" as const } };
  const { rerender } = render(<CallScreen {...props} state={waiting} />);
  rerender(<CallScreen {...props} state={live} />);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Ji-woo joined the call."));
  rerender(<CallScreen {...props} state={{ ...live, self: { ...live.self, muted: true } }} />);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("You’re muted."));
  rerender(<CallScreen {...props} state={{ ...live, phase: "reconnecting" }} />);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Reconnecting…"));
  rerender(<CallScreen {...props} state={live} />);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Reconnected."));
});

test("blocking banners are the only announcer for their condition (no duplicate status)", async () => {
  renderScreen({ ...live, soundBlocked: true });
  await new Promise((done) => setTimeout(done, 150));
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getAllByRole("alert")).toHaveLength(1);
});

test("single-key shortcuts can be turned off in More", () => {
  const handlers = renderScreen(live);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Single-key shortcuts/ }));
  const mute = screen.getByRole("button", { name: "Mute" });
  expect(mute.getAttribute("aria-keyshortcuts")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  mute.focus();
  fireEvent.keyDown(mute, { key: "m" });
  expect(handlers.onToggleMute).not.toHaveBeenCalled();
  try { window.localStorage.removeItem("vl-call-shortcuts"); } catch { /* ignore */ }
});
