"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { languageName } from "@/lib/languages";
import { sendDemoChat, STAFF_LANGUAGE, type ChatSource, type Handoff } from "@/lib/portal";
import { describeError } from "@/lib/platform-errors";
import { HandoffCall } from "./handoff-call";
import { useAgentCall } from "./use-agent-call";

type Tab = "voice" | "chat";
type ChatLine = { id: string; role: "user" | "assistant"; text: string; sources?: ChatSource[] };

// Kept for this browser tab, so a refresh or a click to another page (the website widget) doesn't lose the chat.
const TAB_KEY = "portal-assistant-tab";
const CHAT_KEY = "portal-chat";
const MAX_SAVED_LINES = 60;

export function loadSavedChat(): { lines: ChatLine[]; conversationId: string | null } {
  try {
    const raw = window.sessionStorage.getItem(CHAT_KEY);
    if (!raw) return { lines: [], conversationId: null };
    const saved = JSON.parse(raw) as { lines?: unknown; conversationId?: unknown };
    const lines = Array.isArray(saved.lines)
      ? saved.lines.filter((l): l is ChatLine => !!l && typeof l === "object" && typeof (l as ChatLine).id === "string"
          && ((l as ChatLine).role === "user" || (l as ChatLine).role === "assistant") && typeof (l as ChatLine).text === "string")
          .map((l) => ({ ...l, sources: cleanSources(l.sources) }))
      : [];
    return { lines, conversationId: typeof saved.conversationId === "string" ? saved.conversationId : null };
  } catch {
    return { lines: [], conversationId: null };
  }
}

function cleanSources(value: unknown): ChatSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ok = value.filter((s): s is ChatSource => !!s && typeof s === "object" && typeof (s as ChatSource).n === "number" && typeof (s as ChatSource).title === "string");
  return ok.length ? ok : undefined;
}

/** Official pages only: a source URL is shown as a link only when it is plain http(s). */
const safeUrl = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : undefined);

/** The answer with its [n] markers as small numbered links to the cited source. */
export function AnswerText({ text, sources, idPrefix }: { text: string; sources?: ChatSource[]; idPrefix: string }) {
  const known = new Set((sources ?? []).map((s) => s.n));
  const parts = text.split(/(\[\d+\])/g);
  return (
    <span className="portal-answer">
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (!m) return part;
        const n = Number(m[1]);
        if (!known.has(n)) return null;
        return <a key={i} className="portal-cite" href={`#${idPrefix}-src-${n}`} aria-label={`Source ${n}`}>{n}</a>;
      })}
    </span>
  );
}

export function SourceList({ sources, idPrefix }: { sources: ChatSource[]; idPrefix: string }) {
  return (
    <details className="portal-sources" open>
      <summary>Sources</summary>
      <ol>
        {sources.map((s) => {
          const url = safeUrl(s.url);
          const label = s.heading && s.heading !== s.title ? `${s.title} \u2014 ${s.heading}` : s.title;
          return (
            <li key={s.n} id={`${idPrefix}-src-${s.n}`} title={s.snippet}>
              <span className="portal-cite" aria-hidden="true">{s.n}</span>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer">{label}</a> : <span>{label}</span>}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function saveChat(lines: ChatLine[], conversationId: string | null) {
  try {
    if (lines.length === 0 && !conversationId) window.sessionStorage.removeItem(CHAT_KEY);
    else window.sessionStorage.setItem(CHAT_KEY, JSON.stringify({ lines: lines.slice(-MAX_SAVED_LINES), conversationId }));
  } catch {
    /* storage blocked: the chat just isn't kept */
  }
}

export type AssistantHandle = { ask: (question: string) => void };

/** Student language for the AI call and the officer call. English first; the platform takes others later. */
const STUDENT_LANGUAGE = "en";

/**
 * The portal's assistant: an AI voice call (primary) with a text chat beside it, and the path to a
 * human admissions officer. Sits in the page's right column, and fills the screen once a person joins.
 */
export const AssistantPanel = forwardRef<AssistantHandle>(function AssistantPanel(_, ref) {
  const [tab, setTab] = useState<Tab>("voice");
  const [chatDraft, setChatDraft] = useState("");
  const chatInput = useRef<HTMLTextAreaElement>(null);
  const ids = useId();

  // Restored after mount (the page is prerendered), then kept in step with the tab.
  const tabRestored = useRef(false);
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(TAB_KEY);
      if (saved === "chat" || saved === "voice") setTab(saved);
    } catch { /* ignore */ }
    tabRestored.current = true;
  }, []);
  useEffect(() => {
    if (!tabRestored.current) return;
    try { window.sessionStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ }
  }, [tab]);

  useImperativeHandle(ref, () => ({
    ask(question) {
      setTab("chat");
      setChatDraft(question);
      requestAnimationFrame(() => chatInput.current?.focus());
    },
  }));

  return (
    <section className="portal-assistant" aria-labelledby={`${ids}-title`}>
      <header className="portal-assistant-head">
        <div>
          <p className="portal-eyebrow">Admissions Assistant</p>
          <h2 id={`${ids}-title`}>Ask about applying to Inha</h2>
        </div>
        <span className="portal-live-dot" aria-hidden="true" />
      </header>
      <div className="portal-tabs" role="tablist" aria-label="How to ask">
        {(["voice", "chat"] as const).map((t) => (
          <button key={t} type="button" role="tab" id={`${ids}-${t}`} aria-controls={`${ids}-${t}-panel`} aria-selected={tab === t} className="portal-tab" onClick={() => setTab(t)}>
            {t === "voice" ? "Voice call" : "Chat"}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${ids}-voice-panel`} aria-labelledby={`${ids}-voice`} hidden={tab !== "voice"}>
        <VoicePane onUseChat={() => setTab("chat")} />
      </div>
      <div role="tabpanel" id={`${ids}-chat-panel`} aria-labelledby={`${ids}-chat`} hidden={tab !== "chat"}>
        <ChatPane draft={chatDraft} onDraft={setChatDraft} inputRef={chatInput} onUseVoice={() => setTab("voice")} />
      </div>
    </section>
  );
});

function VoicePane({ onUseChat }: { onUseChat: () => void }) {
  const call = useAgentCall();
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const nameId = useId();
  const transcriptEnd = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (call.escalated && call.phase === "live") setConfirming(true);
  }, [call.escalated, call.phase]);
  useEffect(() => {
    // A block body: scrollIntoView returns a Promise in current Chromium, and React would call it as a cleanup.
    transcriptEnd.current?.scrollIntoView({ block: "nearest" });
  }, [call.messages.length]);

  async function connectOfficer() {
    setConnecting(true);
    setHandoffError(null);
    try {
      setHandoff(await call.handOff({ language: STUDENT_LANGUAGE, name: name.trim() || null, reason: call.escalated ? "Suggested by the assistant" : "Requested by the student" }));
    } catch (cause) {
      setHandoffError(describeError(cause, "We couldn't reach an admissions officer just now. Please try again, or use the chat."));
    } finally {
      setConnecting(false);
      setConfirming(false);
    }
  }

  if (handoff) {
    return (
      <div className="portal-handoff-layer">
        <HandoffCall handoff={handoff} selfName={name.trim()} selfLanguage={STUDENT_LANGUAGE} staffLanguage={STAFF_LANGUAGE} onDone={() => window.location.reload()} />
      </div>
    );
  }

  const live = call.phase === "live" || call.phase === "reconnecting";

  if (call.phase === "idle" || call.phase === "error" || call.phase === "ended") {
    return (
      <div className="portal-pane">
        {call.phase === "ended" ? (
          <p className="portal-note" role="status">The call has ended. Thanks for calling. You can start a new one any time.</p>
        ) : (
          <p className="portal-pane-lead">Talk to the assistant like you would on the phone. It answers from Inha&apos;s published admissions information and can connect you to an admissions officer.</p>
        )}
        {handoffError && <p className="portal-error" role="alert">{handoffError}</p>}
        {call.error && <p className="portal-error" role="alert">{call.error}</p>}
        <label className="portal-field" htmlFor={nameId}>
          <span>Your name <small>(optional)</small></span>
          <input id={nameId} value={name} maxLength={100} autoComplete="given-name" onChange={(e) => setName(e.target.value)} placeholder="So the officer can greet you" />
        </label>
        <button type="button" className="portal-btn portal-btn-primary portal-btn-call" onClick={() => void call.start(name.trim() || null)}>
          <MicIcon /> {call.phase === "idle" ? "Start AI Voice Call" : "Start a new call"}
        </button>
        <p className="portal-fine">Uses your microphone. Calls in this demo last up to 5 minutes. Prefer typing? <button type="button" className="portal-link" onClick={onUseChat}>Open the chat</button></p>
      </div>
    );
  }

  return (
    <div className="portal-pane portal-pane-live">
      <div className="portal-callstate" data-speaking={call.agentSpeaking ? "agent" : call.userSpeaking ? "user" : "none"} role="status" aria-live="polite">
        <span className="portal-orb" aria-hidden="true"><i /><i /><i /></span>
        <span>
          {call.phase === "starting" ? "Connecting to the assistant…"
            : call.phase === "ending" ? "Ending the call…"
            : call.phase === "reconnecting" ? "Reconnecting…"
            : call.agentSpeaking ? "Assistant is speaking"
            : call.muted ? "You're muted"
            : "Listening. Go ahead and ask."}
        </span>
        {live && call.startedAt && <CallTimer since={call.startedAt} />}
      </div>

      {call.audioBlocked && (
        <button type="button" className="portal-btn" onClick={call.resumeAudio}>Tap to hear the assistant</button>
      )}

      <ol className="portal-transcript" aria-label="Conversation so far">
        {call.messages.length === 0 && live && <li className="portal-turn-empty">Try: &ldquo;What documents do I need to apply?&rdquo;</li>}
        {call.messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => (
          <li key={m.id} className="portal-turn" data-role={m.role}>
            <span className="portal-turn-who">{m.role === "user" ? "You" : "Assistant"}</span>
            <span>{m.content}</span>
          </li>
        ))}
        <li ref={transcriptEnd} aria-hidden="true" className="portal-turn-anchor" />
      </ol>

      {confirming && live && (
        <div className="portal-confirm" role="alertdialog" aria-labelledby={`${nameId}-confirm`}>
          <p id={`${nameId}-confirm`}><strong>Would you like to speak with an admissions officer?</strong> The AI call ends and an officer joins you here. They speak {languageName(STAFF_LANGUAGE)}; you&apos;ll hear them in {languageName(STUDENT_LANGUAGE)}, and they&apos;ll hear you in {languageName(STAFF_LANGUAGE)}.</p>
          <div className="portal-row">
            <button type="button" className="portal-btn portal-btn-primary" disabled={connecting} onClick={() => void connectOfficer()}>{connecting ? "Connecting…" : "Connect to Admissions Officer"}</button>
            <button type="button" className="portal-btn" disabled={connecting} onClick={() => setConfirming(false)}>Keep talking to the assistant</button>
          </div>
        </div>
      )}

      <div className="portal-controls">
        <button type="button" className="portal-btn" aria-pressed={call.muted} disabled={!live} onClick={() => void call.setMuted(!call.muted)}>{call.muted ? "Unmute" : "Mute"}</button>
        {!confirming && (
          <button type="button" className="portal-btn portal-btn-officer" disabled={!live} onClick={() => setConfirming(true)}>Connect to Admissions Officer</button>
        )}
        <button type="button" className="portal-btn portal-btn-end" disabled={call.phase === "ending"} onClick={() => void call.end()}>End call</button>
      </div>
    </div>
  );
}

function ChatPane({ draft, onDraft, inputRef, onUseVoice }: { draft: string; onDraft: (v: string) => void; inputRef: React.RefObject<HTMLTextAreaElement | null>; onUseVoice: () => void }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestOfficer, setSuggestOfficer] = useState(false);
  const end = useRef<HTMLLIElement>(null);
  const inputId = useId();
  const restored = useRef(false);

  useEffect(() => {
    const saved = loadSavedChat();
    if (saved.lines.length) setLines(saved.lines);
    if (saved.conversationId) setConversationId(saved.conversationId);
    restored.current = true;
  }, []);
  useEffect(() => {
    if (restored.current) saveChat(lines, conversationId);
  }, [lines, conversationId]);

  function newChat() {
    setLines([]);
    setConversationId(null);
    setSuggestOfficer(false);
    setError(null);
  }

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length, sending]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    setLines((l) => [...l, { id: `u${Date.now()}`, role: "user", text }]);
    onDraft("");
    try {
      const reply = await sendDemoChat(text, conversationId);
      setConversationId(reply.conversation_id);
      setLines((l) => [...l, { id: `a${Date.now()}`, role: "assistant", text: reply.reply, sources: cleanSources(reply.sources) }]);
      if (reply.handoff_suggested) setSuggestOfficer(true);
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      setError(status === 429 ? "This chat has reached its limit. Choose \u201cNew chat\u201d to start again." : describeError(cause, "The assistant couldn't answer just now. Please try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="portal-pane">
      <ol className="portal-transcript portal-chat" aria-label="Chat" aria-live="polite">
        {lines.length === 0 && <li className="portal-turn-empty">Ask anything about admissions: documents, deadlines, tuition, scholarships or language requirements.</li>}
        {lines.map((line) => (
          <li key={line.id} className="portal-turn" data-role={line.role}>
            <span className="portal-turn-who">{line.role === "user" ? "You" : "Assistant"}</span>
            {line.role === "assistant" ? <AnswerText text={line.text} sources={line.sources} idPrefix={line.id} /> : <span>{line.text}</span>}
            {line.role === "assistant" && line.sources?.length ? <SourceList sources={line.sources} idPrefix={line.id} /> : null}
          </li>
        ))}
        {sending && <li className="portal-turn" data-role="assistant"><span className="portal-turn-who">Assistant</span><span className="portal-typing" aria-label="Typing"><i /><i /><i /></span></li>}
        <li ref={end} aria-hidden="true" className="portal-turn-anchor" />
      </ol>
      {suggestOfficer && (
        <p className="portal-note">Need a person? <button type="button" className="portal-link" onClick={onUseVoice}>Start a voice call</button> and choose &ldquo;Connect to Admissions Officer&rdquo;.</p>
      )}
      {error && <p className="portal-error" role="alert">{error}</p>}
      <form className="portal-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label htmlFor={inputId} className="sr-only">Your question</label>
        <textarea
          id={inputId}
          ref={inputRef}
          rows={2}
          maxLength={2000}
          value={draft}
          placeholder="Type your question…"
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
        />
        <button type="submit" className="portal-btn portal-btn-primary" disabled={!draft.trim() || sending}>Send</button>
      </form>
      {lines.length > 0 && (
        <p className="portal-chat-reset"><button type="button" className="portal-link" onClick={newChat} disabled={sending}>New chat</button></p>
      )}
    </div>
  );
}

function CallTimer({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <span className="portal-timer tabular" aria-label={`${Math.floor(s / 60)} minutes ${s % 60} seconds`}>{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>;
}

function MicIcon() {
  return (
    <svg className="portal-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
  );
}
