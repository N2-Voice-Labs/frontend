"use client";

import { useEffect, useMemo, useState } from "react";
import { initialCallState, type CallRoomState } from "@/lib/call-state";
import { pairCallMessages } from "@/lib/call-transcript";
import type { ConversationMessage } from "@/lib/platform";
import { CallEnded } from "./call-ended";
import { CallScreen } from "./call-screen";
import { InvitePanel } from "./invite-panel";
import { LevelStore } from "./level-store";

export type FixtureName = "live" | "waiting" | "translating" | "reconnecting" | "ended";

// Times are relative to page load so the transcript always reads as "a few minutes ago".
const loadedAt = Date.now();
const at = (minute: number, second: number) => new Date(loadedAt - 240_000 + minute * 60_000 + second * 1000).toISOString();
const message = (id: string, role: string, language: string, content: string, time: string): ConversationMessage =>
  ({ id, role, content, primary_language: language, detected_languages: [language], created_at: time });

const MESSAGES: ConversationMessage[] = [
  message("m1", "user", "ko", "내일 회의 몇 시예요?", at(2, 1)),
  message("m2", "assistant", "en", "What time is the meeting tomorrow?", at(2, 3)),
  message("m3", "user", "en", "At ten, in the main office.", at(2, 12)),
  message("m4", "assistant", "ko", "열 시에 본사에서요.", at(2, 14)),
  message("m5", "user", "ko", "좋아요. 계약서도 가져갈까요?", at(3, 2)),
  message("m6", "assistant", "en", "Great. Should I bring the contract too?", at(3, 4)),
];

function stateFor(name: FixtureName): CallRoomState {
  const base: CallRoomState = {
    ...initialCallState,
    phase: "live",
    connectedAt: Date.now() - 252_000,
    self: { speaking: false, muted: false, quality: "good" },
    other: { presence: "present", everJoined: true, speaking: true, muted: false, quality: "good", identity: "guest-1a2b3c4d" },
    interpreter: { present: true, everJoined: true, speaking: false, unavailable: false },
    hearingTranslation: false,
  };
  switch (name) {
    case "waiting":
      return { ...base, connectedAt: Date.now() - 18_000, other: { ...initialCallState.other }, interpreter: { ...base.interpreter, present: false, everJoined: false } };
    case "translating":
      return { ...base, other: { ...base.other, speaking: false }, translating: { toward: "self", since: Date.now() } };
    case "reconnecting":
      return { ...base, phase: "reconnecting", other: { ...base.other, speaking: false }, self: { ...base.self, quality: "poor" } };
    case "ended":
      return { ...base, phase: "ended", endReason: "other", other: { ...base.other, speaking: false } };
    default:
      return base;
  }
}

/** Static, mocked call screen for screenshots and review (dev only; see app/(call)/call/fixture). */
export function CallFixture({ name }: { name: FixtureName }) {
  // Client-only: clock times and the timer would differ between the server render and hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <Fixture name={name} /> : null;
}

function Fixture({ name }: { name: FixtureName }) {
  const levels = useMemo(() => new LevelStore({ reducedMotion: false }), []);
  const state = useMemo(() => stateFor(name), [name]);
  const messages = name === "waiting" ? [] : name === "translating" ? [...MESSAGES, message("m7", "user", "ko", "그리고 점심도 같이 해요.", new Date().toISOString())] : MESSAGES;
  const turns = useMemo(() => pairCallMessages(messages, { self: "en", other: "ko" }), [messages]);
  useEffect(() => {
    levels.set("other", 0.72);
  }, [levels]);
  const self = { name: "Sam", language: "en" };
  const other = { name: "Ji-woo", language: "ko" };
  const noop = () => undefined;
  if (name === "ended") return <CallEnded state={state} self={self} other={other} turns={turns} endedAt={Date.now()} conversationId="fixture" onStartAnother={noop} />;
  return (
    <CallScreen
      role="creator"
      state={state}
      levels={levels}
      self={self}
      other={other}
      turns={turns}
      onToggleMute={noop}
      onEnd={noop}
      onStartAudio={noop}
      invite={name === "waiting" ? (
        <InvitePanel sessionId="fixture" conversationId="fixture" selfName="Sam" selfLanguage="en" otherLanguage="ko" otherName="Ji-woo"
          onOtherNameChange={noop} invite={null} onInvite={noop} onExpiredRestart={noop} />
      ) : undefined}
      technical={[{ label: "Fixture", value: name }]}
    />
  );
}
