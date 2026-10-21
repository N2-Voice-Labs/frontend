"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { latestPending, pairCallMessages, reuseTurns, type CallTurn } from "@/lib/call-transcript";
import { useCallConversation } from "./use-call-conversation";
import { useCallRoom } from "./use-call-room";

/**
 * Glue shared by /call and /join: the LiveKit room, the conversation poll, transcript pairing, and the
 * page-level effects of a live call (end detection, leave prompt, screen wake lock).
 */
export function useLiveCall(options: {
  selfLanguage: string;
  otherLanguage: string;
  otherName: string;
  conversationId: string | null;
  sessionId: string | null;
  sessionToken?: string | null;
}) {
  const room = useCallRoom({ otherName: options.otherName });
  const { state } = room;
  const inCall = state.phase === "connecting" || state.phase === "live" || state.phase === "reconnecting" || state.phase === "disconnected" || state.phase === "ending";
  const conversation = useCallConversation({
    conversationId: options.conversationId,
    sessionId: options.sessionId,
    token: options.sessionToken,
    active: inCall,
    interpreterPresent: state.interpreter.present,
  });

  // Re-evaluate pending → "No translation received" every few seconds while something is pending.
  const [now, setNow] = useState(() => Date.now());
  // Unchanged turns keep their identity across polls and pending re-checks, so memo'd rows don't re-render.
  const previousTurns = useRef<CallTurn[]>([]);
  const turns = useMemo(() => {
    const next = reuseTurns(previousTurns.current, pairCallMessages(conversation.messages, { self: options.selfLanguage, other: options.otherLanguage }, now));
    previousTurns.current = next;
    return next;
  }, [conversation.messages, options.selfLanguage, options.otherLanguage, now]);
  const hasPending = turns.some((turn) => turn.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [hasPending]);

  // A new original without its translation is an honest "translating" signal (UX spec §0 F8).
  const { dispatch } = room;
  const pendingId = useRef<string | null>(null);
  const pending = latestPending(turns);
  useEffect(() => {
    if (!pending || pending.id === pendingId.current) return;
    pendingId.current = pending.id;
    if (pending.speaker === "self" || pending.speaker === "other") {
      dispatch({ type: "translation-pending", toward: pending.speaker === "self" ? "other" : "self", at: Date.now() });
    }
  }, [pending, dispatch]);

  // Interpreter unavailable after repeated ensure-running failures.
  useEffect(() => {
    dispatch({ type: "interpreter-unavailable", unavailable: conversation.interpreterUnavailable });
  }, [conversation.interpreterUnavailable, dispatch]);

  // The other side (or the server) ended the call.
  const { markEnded } = room;
  useEffect(() => {
    if (state.phase === "ended" || state.phase === "ending" || state.phase === "idle") return;
    if (conversation.missing) markEnded("remote");
    else if (conversation.status === "ended" || conversation.status === "failed") markEnded(state.other.everJoined ? "other" : "remote");
  }, [conversation.status, conversation.missing, state.phase, state.other.everJoined, markEnded]);

  // Ended timestamp for the summary.
  const [endedAt, setEndedAt] = useState<number | null>(null);
  useEffect(() => {
    if (state.phase === "ended" && endedAt === null) setEndedAt(Date.now());
  }, [state.phase, endedAt]);

  // Leaving the page while connected asks first (UX spec §3.4). Leaving anyway sends nothing.
  const connected = state.phase === "live" || state.phase === "reconnecting" || state.phase === "connecting";
  useEffect(() => {
    if (!connected) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [connected]);

  // Keep a phone screen awake during a live call (progressive enhancement).
  useEffect(() => {
    if (!connected) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    void nav.wakeLock?.request("screen").then((sentinel) => {
      if (cancelled) void sentinel.release().catch(() => undefined);
      else lock = sentinel;
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      void lock?.release().catch(() => undefined);
    };
  }, [connected]);

  return { room, conversation, turns, endedAt: endedAt ?? Date.now() };
}
