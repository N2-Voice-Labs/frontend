"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageTags } from "@/components/features/conversations/language-tags";
import { OutcomePanel } from "@/components/features/conversations/outcome-panel";
import { isMixedScript, ScriptText } from "@/components/features/conversations/script-text";
import {
  getConversation,
  getConversationRuntimeState,
  getMessages,
  type Conversation,
  type ConversationMessage,
  type ConversationRuntimeState,
} from "@/lib/platform";

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesError, setMessagesError] = useState("");
  const [runtimeState, setRuntimeState] = useState<ConversationRuntimeState | null>(null);
  const [error, setError] = useState("");
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const refreshSequence = useRef(0);
  const [notFoundId, setNotFoundId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const [conversationResult, messagesResult, runtimeResult] = await Promise.allSettled([
      getConversation(id),
      getMessages(id),
      getConversationRuntimeState(id),
    ]);
    if (sequence !== refreshSequence.current) return;
    const conversationError = conversationResult.status === "rejected" ? conversationResult.reason : null;
    const missing = conversationError instanceof Error && "status" in conversationError && conversationError.status === 404;
    if (conversationResult.status === "fulfilled") setConversation(conversationResult.value);
    else if (missing) setConversation(null);
    if (runtimeResult.status === "fulfilled") setRuntimeState(runtimeResult.value);
    else if (missing) setRuntimeState(null);
    if (missing) {
      setMessages([]);
      setMessagesError("");
    } else if (messagesResult.status === "fulfilled") {
      setMessages(messagesResult.value);
      setMessagesError("");
    } else {
      setMessagesError(
        messagesResult.reason instanceof Error
          ? messagesResult.reason.message
          : "Transcript could not be loaded.",
      );
    }
    const failed = [conversationResult, messagesResult, runtimeResult].find((result) => result.status === "rejected");
    setError(failed?.status === "rejected"
      ? failed.reason instanceof Error ? failed.reason.message : "Conversation could not be loaded."
      : "");
    setNotFoundId(missing ? id : null);
    setLoadedForId(id);
  }, [id]);

  useEffect(() => {
    if (notFoundId === id) return;
    void refresh();
    if (conversation && !["created", "active"].includes(conversation.status)) return;
    const interval = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(interval);
  }, [conversation?.status, id, notFoundId, refresh]);

  const activityEvents = runtimeState?.events.filter((event) => [
    "SpeechStarted",
    "SpeechStopped",
    "TurnCompleted",
    "AgentSpeechStarted",
    "UserInterrupted",
    "AgentSpeechCancelled",
    "RuntimeStarted",
    "SessionEnded",
    "SessionFailed",
    "RuntimeFailed",
  ].includes(event.event_type)) ?? [];
  const isCurrentConversationLoaded = loadedForId === id;

  return (
    <main className="page-shell dash-main convo">
      <div className="dash-back-row">
        <Link className="dash-back" href="/conversations">← Conversations</Link>
        {conversation && <Link className="dash-back" href={`/agents/${conversation.agent_id}`}>Back to agent</Link>}
      </div>
      <p className="eyebrow">History / Detail</p>
      <h1>Conversation</h1>
      {isCurrentConversationLoaded && error && <p role="alert">Could not refresh this conversation: {error}</p>}
      {!isCurrentConversationLoaded && <p role="status">Loading conversation…</p>}
      {isCurrentConversationLoaded && conversation && (
        <section className="panel convo-panel convo-details" aria-label="Conversation details" aria-live="polite">
          <p>Conversation ID: <code>{conversation.id}</code></p>
          <p>Agent: <code>{conversation.agent_id}</code></p>
          <p>Status: {conversation.status}</p>
          <p>Voice session: {runtimeState?.session_status ?? "not started"}</p>
          <p>Started: {new Date(conversation.started_at).toLocaleString()}</p>
          {conversation.ended_at && <p>Ended: {new Date(conversation.ended_at).toLocaleString()}</p>}
        </section>
      )}
      {isCurrentConversationLoaded && conversation && <OutcomePanel key={`${conversation.id}-${conversation.outcome_recorded_at ?? ""}`} conversation={conversation} onSaved={setConversation} />}
      {isCurrentConversationLoaded && <section className="panel convo-panel convo-activity" aria-label="Voice session activity" aria-live="polite">
        <h2>Voice session activity</h2>
        {activityEvents.map((event) => {
          const label = event.event_type === "SpeechStarted" ? "You started speaking"
            : event.event_type === "SpeechStopped" ? "You stopped speaking"
              : event.event_type === "TurnCompleted" ? "Agent turn completed"
                : event.event_type === "AgentSpeechStarted" ? "Agent started speaking"
                  : event.event_type === "UserInterrupted" ? "You interrupted the agent"
                    : event.event_type === "AgentSpeechCancelled" ? "Agent speech cancelled"
                      : event.event_type === "RuntimeStarted" ? "Runtime connected"
                        : event.event_type === "SessionEnded" ? "Voice session ended"
                          : "Voice session failed";
          const reason = event.payload.reason;
          return (
            <p className="convo-event" data-type={event.event_type} key={event.event_id}>
              <strong>{label}</strong>{typeof reason === "string" && reason ? ` · ${reason}` : ""}
              {` · ${new Date(event.received_at).toLocaleString()}`}
            </p>
          );
        })}
        {runtimeState && activityEvents.length === 0 && (
          <p>No lifecycle or interruption activity has been recorded.</p>
        )}
      </section>}
      <h2 className="convo-heading">Transcript</h2>
      {isCurrentConversationLoaded && messages.some((message) => isMixedScript(message.content)) && (
        <p className="convo-legend" aria-hidden="true"><i className="seg-cyrillic">Cyrillic</i><i className="seg-latin">Latin</i> Words are tinted by script, so a switch mid-sentence is easy to spot.</p>
      )}
      {!isCurrentConversationLoaded ? null : messagesError ? <p role="status">Transcript unavailable: {messagesError}</p>
        : messages.length === 0 ? <p className="muted">No finalized transcript messages have been received.</p> : (
        <ol className="chat" aria-live="polite">
          {messages.map((message) => (
            <li className="chat-msg" data-role={message.role.toLowerCase() === "user" ? "user" : "agent"} key={message.id}>
              <p className="chat-line">
                <span className="chat-meta"><strong>{message.role}</strong>{message.primary_language && ` · ${message.primary_language}`}: </span>
                <span className="transcript-content"><ScriptText text={message.content} /></span>
              </p>
              <p className="chat-foot">
                <LanguageTags primary={message.primary_language} detected={message.detected_languages} />
                {message.detected_languages.length > 0 && <small> · Detected: {message.detected_languages.join(", ")}</small>}
                <small> · {new Date(message.created_at).toLocaleString()}</small>
              </p>
            </li>
          ))}
        </ol>
      )}
      <button className="mini-action convo-refresh" data-bare type="button" onClick={() => void refresh()}>Refresh now</button>
    </main>
  );
}
