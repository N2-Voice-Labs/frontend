"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { endVoiceSession, getConversation, getMessages, type ConversationMessage, type VoiceSession } from "@/lib/platform";
import { createHandoff, startDemoSession, type Handoff } from "@/lib/portal";

/**
 * One browser-to-AI voice call with the portal's demo agent. Mirrors the agent playground's room handling
 * (`app/(dashboard)/agents/[id]/test/page.tsx`) but is small and student-facing:
 * start → live (mute, transcript) → end, or → hand off to a person.
 *
 * "Escalated" comes from the conversation's outcome: the agent's `transfer_to_human` tool records it, and the
 * panel then offers "Connect to Admissions Officer" more prominently. The student can always ask directly.
 */
export type AgentCallPhase = "idle" | "starting" | "live" | "reconnecting" | "ending" | "ended" | "error";

const POLL_MS = 1_500;
const AUDIO_ATTR = "data-portal-agent-audio";

export function useAgentCall() {
  const [phase, setPhase] = useState<AgentCallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [escalated, setEscalated] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const roomRef = useRef<Room | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const intentional = useRef(false);
  const mounted = useRef(true);

  const cleanupAudio = () => document.querySelectorAll(`[${AUDIO_ATTR}]`).forEach((el) => el.remove());

  const disconnect = useCallback(async () => {
    intentional.current = true;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect().catch(() => undefined);
    cleanupAudio();
    setAgentSpeaking(false);
    setUserSpeaking(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const session = sessionRef.current;
      void disconnect();
      // Closing the page mid-call ends the AI session (nobody else is in it).
      if (session) void endVoiceSession(session.session_id, session.session_token).catch(() => undefined);
    };
  }, [disconnect]);

  // Transcript + outcome poll while the call is open.
  useEffect(() => {
    if (phase !== "live" && phase !== "reconnecting") return;
    const session = sessionRef.current;
    if (!session) return;
    const controller = new AbortController();
    let timer = 0;
    const tick = async () => {
      try {
        const [list, conversation] = await Promise.all([
          getMessages(session.conversation_id, session.session_token, controller.signal),
          getConversation(session.conversation_id, session.session_token, controller.signal),
        ]);
        if (!mounted.current) return;
        setMessages(list);
        if (conversation.outcome === "escalated") setEscalated(true);
        if (conversation.status === "ended" || conversation.status === "failed") {
          sessionRef.current = null;
          await disconnect();
          setPhase("ended");
          return;
        }
      } catch {
        /* a missed poll is retried */
      }
      if (!controller.signal.aborted) timer = window.setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [phase, disconnect]);

  const start = useCallback(async (name?: string | null) => {
    if (phase === "starting" || phase === "live") return;
    setError(null);
    setMessages([]);
    setEscalated(false);
    setAudioBlocked(false);
    setPhase("starting");
    intentional.current = false;
    let session: VoiceSession | null = null;
    try {
      // Ask for the microphone first, inside the click, so the permission prompt belongs to the button.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
      const { Room, RoomEvent, Track } = await import("livekit-client");
      session = await startDemoSession(name);
      sessionRef.current = session;
      if (!session.connection.url || !session.connection.token) throw new Error("not_configured");
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const audio = track.attach();
        audio.autoplay = true;
        audio.setAttribute("playsinline", "true");
        audio.setAttribute(AUDIO_ATTR, "true");
        document.body.appendChild(audio);
        void audio.play().catch(() => mounted.current && setAudioBlocked(true));
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setUserSpeaking(speakers.some((s) => s.isLocal));
        setAgentSpeaking(speakers.some((s) => !s.isLocal));
      });
      room.on(RoomEvent.Reconnecting, () => mounted.current && setPhase("reconnecting"));
      room.on(RoomEvent.Reconnected, () => mounted.current && setPhase("live"));
      room.on(RoomEvent.Disconnected, () => {
        cleanupAudio();
        if (intentional.current || !mounted.current) return;
        const current = sessionRef.current;
        sessionRef.current = null;
        if (current) void endVoiceSession(current.session_id, current.session_token).catch(() => undefined);
        setPhase("ended");
      });
      await room.connect(session.connection.url, session.connection.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      if (!mounted.current) return;
      setStartedAt(Date.now());
      setPhase("live");
    } catch (cause) {
      await disconnect();
      if (session) void endVoiceSession(session.session_id, session.session_token).catch(() => undefined);
      sessionRef.current = null;
      if (!mounted.current) return;
      setPhase("error");
      setError(describeStartError(cause));
    }
  }, [phase, disconnect]);

  const end = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setPhase("ending");
    await disconnect();
    if (session) await endVoiceSession(session.session_id, session.session_token).catch(() => undefined);
    if (mounted.current) setPhase("ended");
  }, [disconnect]);

  const setMuted = useCallback(async (next: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMutedState(next);
  }, []);

  /** Leaves the AI room and opens the translated call that waits for staff. The Platform ends the AI session. */
  const handOff = useCallback(async (options: { language: string; name?: string | null; reason?: string | null }): Promise<Handoff> => {
    const session = sessionRef.current;
    if (!session) throw new Error("no_session");
    await disconnect();
    const handoff = await createHandoff({ session_id: session.session_id, language: options.language, name: options.name, reason: options.reason }, session.session_token);
    sessionRef.current = null;
    return handoff;
  }, [disconnect]);

  const resumeAudio = useCallback(() => {
    document.querySelectorAll<HTMLAudioElement>(`[${AUDIO_ATTR}]`).forEach((el) => void el.play().then(() => setAudioBlocked(false)).catch(() => undefined));
  }, []);

  return { phase, error, muted, agentSpeaking, userSpeaking, messages, escalated, audioBlocked, startedAt, start, end, setMuted, handOff, resumeAudio, conversationId: sessionRef.current?.conversation_id ?? null };
}

function describeStartError(cause: unknown): string {
  if (cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "SecurityError")) {
    return "Microphone access was blocked. Allow the microphone for this site, then try again.";
  }
  if (cause instanceof DOMException && cause.name === "NotFoundError") return "No microphone was found on this device.";
  const status = (cause as { status?: number } | null)?.status;
  if (status === 429) return "Too many calls were started from this network. Please wait a minute and try again.";
  if (status === 404) return "The assistant isn't switched on right now. Please try the chat instead.";
  if (status === 503) return "The voice service is busy or unavailable. Please try again shortly, or use the chat.";
  return "The call couldn't start. Check your connection and try again.";
}
