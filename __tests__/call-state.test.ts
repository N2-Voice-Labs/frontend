import { expect, test } from "vitest";
import {
  bridgeLabel,
  bridgeState,
  callReducer,
  classifyParticipant,
  initialCallState,
  personState,
  statusLine,
  type CallRoomState,
} from "@/lib/call-state";
import { announcementFor, latestPending, pairCallMessages, PENDING_TIMEOUT_MS } from "@/lib/call-transcript";
import type { ConversationMessage } from "@/lib/platform";

const names = { self: "Sam", other: "Ji-woo", selfLanguage: "English", otherLanguage: "Korean" };
const live: CallRoomState = {
  ...initialCallState,
  phase: "live",
  connectedAt: 1,
  other: { ...initialCallState.other, presence: "present", everJoined: true },
  interpreter: { present: true, everJoined: true, speaking: false, unavailable: false },
};

test("participants are classified by LiveKit kind or the Runtime identity prefix", () => {
  expect(classifyParticipant({ identity: "browser-1", isLocal: true })).toBe("self");
  expect(classifyParticipant({ identity: "guest-abc" })).toBe("other");
  expect(classifyParticipant({ identity: "anything", isAgent: true })).toBe("interpreter");
  expect(classifyParticipant({ identity: "voice-labs-agent-voice-labs-1" })).toBe("interpreter");
});

test("the status line shows one message, most blocking first", () => {
  expect(statusLine({ ...initialCallState, phase: "connecting" }, names).message).toBe("Connecting to the call…");
  expect(statusLine({ ...live, other: { ...live.other, presence: "waiting" } }, names).message).toBe("Waiting for Ji-woo to join.");
  const weakAndWaiting = { ...live, self: { ...live.self, quality: "poor" as const }, other: { ...live.other, presence: "waiting" as const } };
  expect(statusLine(weakAndWaiting, names).message).toBe("Waiting for Ji-woo to join.");
  expect(statusLine({ ...live, self: { ...live.self, quality: "poor" } }, names).tone).toBe("warning");
  const blocked = { ...live, phase: "reconnecting" as const, soundBlocked: true };
  expect(statusLine(blocked, names).message).toMatch(/Sound is blocked/);
  expect(statusLine({ ...blocked, phase: "ended", endReason: "other" }, names).message).toBe("Ji-woo ended the call.");
  expect(statusLine({ ...live, other: { ...live.other, presence: "reconnecting" } }, names).message).toBe("Ji-woo lost connection. Reconnecting…");
  expect(statusLine(live, names).message).toBe("");
});

test("bridge: starting, ready, translating toward the listener, speaking with direction from our own track", () => {
  expect(bridgeState({ ...live, interpreter: { ...live.interpreter, present: false, everJoined: false } }).mode).toBe("starting");
  expect(bridgeState({ ...live, interpreter: { ...live.interpreter, present: false } }).mode).toBe("reconnecting");
  expect(bridgeState({ ...live, interpreter: { ...live.interpreter, present: false, everJoined: false, unavailable: true } }).mode).toBe("unavailable");
  expect(bridgeState(live)).toEqual({ mode: "ready", toward: null });
  expect(bridgeState({ ...live, translating: { toward: "self", since: 1 } })).toEqual({ mode: "translating", toward: "self" });

  const speaking = { ...live, interpreter: { ...live.interpreter, speaking: true } };
  expect(bridgeState({ ...speaking, hearingTranslation: true }).toward).toBe("self");
  expect(bridgeState({ ...speaking, hearingTranslation: false }).toward).toBe("other");
  expect(bridgeState({ ...speaking, hearingTranslation: null }).toward).toBeNull();
  expect(bridgeLabel("speaking", "self", names)).toBe("You’re hearing Ji-woo in English");
  expect(bridgeLabel("speaking", "other", names)).toBe("Ji-woo is hearing you in Korean");
  expect(bridgeLabel("speaking", null, names)).toBe("Interpreter speaking");
  expect(bridgeLabel("translating", "other", names)).toBe("Translating into Korean…");
});

test("person state: muted wins over speaking; hearing translation only with a measured direction", () => {
  const muted = callReducer(live, { type: "muted", seat: "self", muted: true });
  const speaking = callReducer(muted, { type: "speakers", self: true, other: false, interpreter: false, at: 1 });
  expect(personState(speaking, "self")).toBe("muted");
  const hearing = { ...live, interpreter: { ...live.interpreter, speaking: true }, hearingTranslation: true };
  expect(personState(hearing, "self")).toBe("hearing");
  expect(personState({ ...hearing, hearingTranslation: false }, "other")).toBe("hearing");
  expect(personState({ ...live, other: { ...live.other, presence: "waiting" } }, "other")).toBe("waiting");
});

test("the reducer returns the same object when nothing changed (no re-render)", () => {
  const same = callReducer(live, { type: "speakers", self: false, other: false, interpreter: false, at: 2 });
  expect(same).toBe(live);
  expect(callReducer(live, { type: "quality", seat: "self", quality: "unknown" })).toBe(live);
  const ended = callReducer(live, { type: "ended", reason: "self" });
  expect(callReducer(ended, { type: "participant-joined", seat: "other", identity: "x" })).toBe(ended);
});

const message = (id: string, role: string, language: string, content: string, second: number): ConversationMessage =>
  ({ id, role, content, primary_language: language, detected_languages: [language], created_at: new Date(Date.UTC(2026, 9, 21, 5, 0, second)).toISOString() });
const now = Date.UTC(2026, 9, 21, 5, 0, 30);

test("pairing: language says who spoke; each translation pairs with the closest earlier original from the other side", () => {
  const turns = pairCallMessages([
    message("1", "user", "ko", "내일 회의 몇 시예요?", 1),
    message("3", "user", "en", "At ten.", 3),
    message("2", "assistant", "en", "What time is the meeting tomorrow?", 4),
    message("4", "assistant", "ko", "열 시요.", 5),
  ], { self: "en", other: "ko" }, now);
  expect(turns.map((turn) => [turn.speaker, turn.original?.id, turn.translation?.id, turn.status])).toEqual([
    ["other", "1", "2", "complete"],
    ["self", "3", "4", "complete"],
  ]);
});

test("pairing: pending, timed-out and unpaired turns", () => {
  const turns = pairCallMessages([
    message("t", "assistant", "en", "Orphan translation", 0),
    message("old", "user", "en", "Hello?", 2),
    message("new", "user", "ko", "여보세요?", 25),
  ], { self: "en", other: "ko" }, now);
  expect(turns[0]).toMatchObject({ status: "unpaired", speaker: "other" });
  expect(turns[1].status).toBe("timeout");
  expect(now - Date.parse(turns[1].at)).toBeGreaterThan(PENDING_TIMEOUT_MS);
  expect(turns[2].status).toBe("pending");
  expect(latestPending(turns)?.id).toBe("new");
});

test("only the other person's completed translation is announced", () => {
  const [theirs, mine] = pairCallMessages([
    message("1", "user", "ko", "안녕하세요", 1),
    message("2", "assistant", "en", "Hello", 2),
    message("3", "user", "en", "Hi", 3),
    message("4", "assistant", "ko", "안녕", 4),
  ], { self: "en", other: "ko" }, now);
  expect(announcementFor(theirs, "Ji-woo")).toBe("Ji-woo: Hello");
  expect(announcementFor(mine, "Ji-woo")).toBeNull();
});
