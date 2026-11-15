"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { languageName } from "@/lib/languages";
import { acceptHandoff, getHandoffTranscript, listStaffHandoffs, type StaffHandoff } from "@/lib/portal";
import type { ConversationMessage } from "@/lib/platform";

const KEY_STORAGE = "portal-staff-key";
const POLL_MS = 3_000;

function readKey(): string {
  try {
    return window.sessionStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}
function storeKey(value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(KEY_STORAGE, value);
    else window.sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage blocked: the key lives only in memory */
  }
}

/**
 * /inha/staff: the admissions officer's queue. Students who asked for a person wait here; "Pick up" claims one
 * and opens the existing /join flow with that call's invite, so the officer lands in the translated call.
 * The staff key stays in this tab only (sessionStorage).
 */
export function StaffConsole() {
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<StaffHandoff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const keyId = useId();
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const stored = readKey();
    if (stored) setKey(stored);
  }, []);

  const signOut = useCallback((message?: string) => {
    storeKey(null);
    setKey(null);
    setItems([]);
    setLoaded(false);
    if (message) setError(message);
  }, []);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let timer = 0;
    const tick = async () => {
      try {
        const list = await listStaffHandoffs(key, controller.signal);
        setItems(list);
        setLoaded(true);
        setError(null);
        // Announce only students who arrive after the first load.
        const fresh = list.filter((h) => h.status === "waiting" && !seen.current.has(h.id));
        if (fresh.length && primed.current) setAnnounce(`${fresh.length} new student${fresh.length > 1 ? "s" : ""} waiting`);
        fresh.forEach((h) => seen.current.add(h.id));
        primed.current = true;
      } catch (cause) {
        if (controller.signal.aborted) return;
        const status = (cause as { status?: number }).status;
        if (status === 401) return signOut("That staff key wasn't accepted.");
        if (status === 404) return signOut("The staff console isn't switched on for this server.");
        setError("Can't reach the server. Retrying…");
      }
      if (!controller.signal.aborted) timer = window.setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key, signOut]);

  async function pickUp(item: StaffHandoff) {
    if (!key) return;
    setBusy(item.id);
    setError(null);
    try {
      const { invite_code } = await acceptHandoff(key, item.id);
      window.location.assign(`/join#c=${encodeURIComponent(invite_code)}`);
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      setError(status === 409 ? "Someone else already picked up this student, or they left." : "Couldn't pick up. Please try again.");
      setBusy(null);
    }
  }

  if (!key) {
    return (
      <main className="staff-main" id="main-content">
        <div className="staff-signin">
          <p className="portal-eyebrow">Admissions office</p>
          <h1>Staff console</h1>
          <p className="portal-pane-lead">Students who ask for an admissions officer appear here. Pick one up to join their call. UNAI translates between you in real time.</p>
          {error && <p className="portal-error" role="alert">{error}</p>}
          <form onSubmit={(e) => { e.preventDefault(); const v = draft.trim(); if (!v) return; storeKey(v); setError(null); setKey(v); setDraft(""); }}>
            <label className="portal-field" htmlFor={keyId}>
              <span>Staff key</span>
              <input id={keyId} type="password" autoComplete="current-password" value={draft} onChange={(e) => setDraft(e.target.value)} />
            </label>
            <button type="submit" className="portal-btn portal-btn-primary" disabled={!draft.trim()}>Open the queue</button>
          </form>
        </div>
      </main>
    );
  }

  const waiting = items.filter((h) => h.status === "waiting");
  const accepted = items.filter((h) => h.status === "accepted");

  return (
    <main className="staff-main" id="main-content">
      <div className="staff-head">
        <div>
          <p className="portal-eyebrow">Admissions office</p>
          <h1>Students waiting <span className="staff-count">{waiting.length}</span></h1>
        </div>
        <button type="button" className="portal-btn" onClick={() => signOut()}>Lock console</button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {error && <p className="portal-error" role="alert">{error}</p>}

      {!loaded ? (
        <p className="portal-note">Loading the queue…</p>
      ) : waiting.length === 0 ? (
        <div className="staff-empty">
          <span className="portal-live-dot" aria-hidden="true" />
          <p><strong>No one is waiting.</strong> This page checks every few seconds; keep it open.</p>
        </div>
      ) : (
        <ul className="staff-list">
          {waiting.map((item) => (
            <li key={item.id} className="staff-item">
              <div className="staff-item-main">
                <p className="staff-who">{item.requester_name || "A student"}</p>
                <p className="staff-meta">
                  Speaks {languageName(item.requester_language)} · you speak {languageName(item.staff_language)} · waiting <Since iso={item.created_at} />
                </p>
                {item.reason && <p className="staff-reason">{item.reason}</p>}
              </div>
              <div className="staff-actions">
                <button type="button" className="portal-btn" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
                  {open === item.id ? "Hide conversation" : "Read AI conversation"}
                </button>
                <button type="button" className="portal-btn portal-btn-primary" disabled={busy !== null} onClick={() => void pickUp(item)}>
                  {busy === item.id ? "Joining…" : "Pick up"}
                </button>
              </div>
              {open === item.id && <TranscriptPeek staffKey={key} id={item.id} />}
            </li>
          ))}
        </ul>
      )}

      {accepted.length > 0 && (
        <p className="portal-fine">{accepted.length} call{accepted.length > 1 ? "s" : ""} in progress with other staff.</p>
      )}
    </main>
  );
}

function TranscriptPeek({ staffKey, id }: { staffKey: string; id: string }) {
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    getHandoffTranscript(staffKey, id).then((m) => alive && setMessages(m)).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [staffKey, id]);
  if (failed) return <p className="portal-error">Couldn&apos;t load the conversation.</p>;
  if (!messages) return <p className="portal-note">Loading…</p>;
  const turns = messages.filter((m) => m.role === "user" || m.role === "assistant");
  if (!turns.length) return <p className="portal-note">The student asked for a person before saying anything to the assistant.</p>;
  return (
    <ol className="portal-transcript staff-transcript" aria-label="What the student and the assistant said">
      {turns.map((m) => (
        <li key={m.id} className="portal-turn" data-role={m.role}>
          <span className="portal-turn-who">{m.role === "user" ? "Student" : "Assistant"}</span>
          <span>{m.content}</span>
        </li>
      ))}
    </ol>
  );
}

function Since({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  const at = Date.parse(iso.endsWith("Z") || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  const mins = Math.max(0, Math.round((now - at) / 60_000));
  return <>{mins < 1 ? "under a minute" : `${mins} min`}</>;
}
