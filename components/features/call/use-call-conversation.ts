"use client";

import { useEffect, useRef, useState } from "react";
import { ensureVoiceSessionRunning, getConversation, getMessages, type ConversationMessage } from "@/lib/platform";

/**
 * One poll loop per call, keyed on the conversation only (not on phase, unlike the playground), so a
 * phase change never restarts it.
 *
 * - Never overlaps: the next tick is scheduled only after the current one has settled.
 * - Every tick has an AbortController with a REQUEST_TIMEOUT_MS timeout, and is aborted on cleanup.
 * - Pauses while the tab is hidden and polls once immediately when it becomes visible again.
 * - Messages are diffed and merged by id: an unchanged poll keeps the same array, and unchanged messages
 *   keep their object identity, so transcript rows do not re-render.
 * - The Platform has no incremental messages API (`GET /conversations/{id}/messages` always returns the
 *   full list; checked in backend main.py), so each poll downloads the whole transcript. Backend ticket.
 *
 * Also keeps the interpreter running: while no interpreter participant is in the room it calls
 * `ensure-running` (3 s between tries, 10 s after `not_configured` / errors). Three failed tries in a
 * row mark the interpreter unavailable (UX spec §4.1 [E] 503).
 */
export const POLL_MS = 1_500;
const POLL_RETRY_MS = 3_000;
export const REQUEST_TIMEOUT_MS = 5_000;

export type CallConversation = {
  messages: ConversationMessage[];
  /** created | active | ended | failed | "" (unknown yet) */
  status: string;
  transcriptError: boolean;
  runtimeStatus: string;
  interpreterUnavailable: boolean;
  /** 404 for the conversation (guest link to a call that no longer exists). */
  missing: boolean;
};

export function useCallConversation(options: {
  conversationId: string | null;
  sessionId: string | null;
  token?: string | null;
  /** Stop polling once the call is over on our side. */
  active: boolean;
  /** Read through a ref so the loop does not restart when it changes. */
  interpreterPresent: boolean;
}): CallConversation {
  const { conversationId, sessionId, token, active } = options;
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState("");
  const [transcriptError, setTranscriptError] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState("");
  const [failures, setFailures] = useState(0);
  const [missing, setMissing] = useState(false);
  const presentRef = useRef(options.interpreterPresent);
  presentRef.current = options.interpreterPresent;

  useEffect(() => {
    if (!conversationId || !active) return;
    let alive = true;
    let timer: number | undefined;
    let inFlight: AbortController | null = null;
    let running = false;
    let over = false;
    let retryAt = 0;
    let failed = 0;
    let lastOk = true;

    const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

    const schedule = (delay: number) => {
      if (!alive || over || hidden()) return; // hidden: resumed by the visibilitychange listener
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), delay);
    };

    const refresh = async () => {
      if (!alive || running || over) return;
      running = true;
      timer = undefined;
      const controller = new AbortController();
      inFlight = controller;
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const [conversation, list] = await Promise.allSettled([
          getConversation(conversationId, token, controller.signal),
          getMessages(conversationId, token, controller.signal),
        ]);
        if (!alive) return;
        lastOk = conversation.status === "fulfilled";
        if (conversation.status === "fulfilled") {
          setStatus(conversation.value.status);
          over = conversation.value.status === "ended" || conversation.value.status === "failed";
        } else if ((conversation.reason as { status?: number })?.status === 404) {
          setMissing(true);
          over = true;
        }
        if (list.status === "fulfilled") {
          const next = list.value;
          setMessages((previous) => mergeMessages(previous, next));
          setTranscriptError(false);
        } else {
          setTranscriptError(true);
        }

        if (!over && sessionId && !presentRef.current && Date.now() >= retryAt) {
          try {
            const ensured = await ensureVoiceSessionRunning(sessionId, token, controller.signal);
            if (!alive) return;
            setRuntimeStatus(ensured.runtime_status);
            if (["not_configured", "manual_start_required"].includes(ensured.runtime_status)) {
              failed += 1;
              retryAt = Date.now() + 10_000;
            } else {
              failed = 0;
              retryAt = Date.now() + 3_000;
            }
          } catch {
            if (!alive) return;
            failed += 1;
            retryAt = Date.now() + 10_000;
            setRuntimeStatus("unavailable");
          }
          setFailures(failed);
        } else if (presentRef.current && failed !== 0) {
          failed = 0;
          setFailures(0);
        }
      } finally {
        window.clearTimeout(timeout);
        if (inFlight === controller) inFlight = null;
        running = false;
      }
      schedule(lastOk ? POLL_MS : POLL_RETRY_MS);
    };

    const onVisibility = () => {
      if (!hidden() && !running && timer === undefined) void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!hidden()) void refresh();

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer !== undefined) window.clearTimeout(timer);
      inFlight?.abort();
    };
  }, [conversationId, sessionId, token, active]);

  return { messages, status, transcriptError, runtimeStatus, interpreterUnavailable: failures >= 3, missing };
}

const sameMessage = (a: ConversationMessage, b: ConversationMessage) =>
  a.id === b.id && a.content === b.content && a.primary_language === b.primary_language && a.role === b.role;

/**
 * Merges a poll into the previous list: unchanged messages keep their object identity, and an
 * unchanged poll returns `previous` itself (no render). Content is compared too, in case the Platform
 * fills a message in place.
 */
export function mergeMessages(previous: ConversationMessage[], next: ConversationMessage[]): ConversationMessage[] {
  const byId = new Map(previous.map((message) => [message.id, message]));
  let changed = previous.length !== next.length;
  const merged = next.map((message, index) => {
    const old = byId.get(message.id);
    if (old && sameMessage(old, message)) {
      if (previous[index] !== old) changed = true;
      return old;
    }
    changed = true;
    return message;
  });
  return changed ? merged : previous;
}
