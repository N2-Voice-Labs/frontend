"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bridgeState,
  personState,
  statusLine,
  type CallRoomState,
  type Names,
} from "@/lib/call-state";
import type { CallTurn } from "@/lib/call-transcript";
import { languageName, nativeLanguageName } from "@/lib/languages";
import { CallControls } from "./call-controls";
import { CallDialog } from "./call-dialog";
import { ErrorState } from "./call-states";
import { ConnectionIndicator } from "./connection-indicator";
import { Icon } from "./icons";
import { InterpreterBridge } from "./interpreter-bridge";
import { LanguageName } from "./language-select";
import type { LevelStore } from "./level-store";
import { ParticipantCard } from "./participant-card";
import { StatusLine } from "./status-indicator";
import { Transcript, type TranscriptPeople } from "./transcript";
import { PEER_GRACE_MS } from "@/lib/call-state";

export type CallPerson = { name: string; language: string };
export type TechnicalItem = { label: string; value: string };

export type CallScreenProps = {
  role: "creator" | "guest";
  state: CallRoomState;
  levels?: LevelStore | null;
  self: CallPerson;
  other: CallPerson;
  turns: CallTurn[];
  transcriptError?: boolean;
  /** The invite panel (creator, while the other person has not joined). */
  invite?: React.ReactNode;
  technical?: TechnicalItem[];
  onToggleMute: () => void;
  onEnd: () => void;
  onStartAudio: () => void;
  onRejoin?: () => void;
  canRejoin?: boolean;
  onSwitchDevice?: (kind: "audioinput" | "audiooutput", deviceId: string) => void;
  onVolume?: (volume: number) => void;
  /** Extra status sentence (e.g. invite expires in 1 minute), routed through the single status line. */
  statusExtra?: string;
};

const FUTURE = [
  "Leave without ending the call",
  "Change language or translation pace during a call",
  "Reusable invite links and a lobby",
  "Live (partial) transcripts",
  "Add an AI agent or a phone number to a call",
];

const SHORTCUTS_KEY = "vl-call-shortcuts";
const TRANSIENT_MS = 5_000;

function readShortcuts() {
  try {
    return window.localStorage.getItem(SHORTCUTS_KEY) !== "off";
  } catch {
    return true;
  }
}

function formatElapsed(since: number | null, now: number) {
  if (!since) return "00:00";
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The call timer as a leaf: it is the only thing that re-renders every second (performance review
 * finding 5). The visible digits are not a live region; the sr-only prefix names them.
 */
export function CallTimer({ since, running }: { since: number | null; running: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since || !running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since, running]);
  return <span className="call-timer"><span className="sr-only">Call time </span>{formatElapsed(since, now)}</span>;
}

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName)));
}

/**
 * One-off announcements for transitions the precedence-based status line would otherwise skip
 * (accessibility audit S4): mute/unmute, the other person joining or coming back, reconnected.
 */
function useTransitionAnnouncement(state: CallRoomState, otherName: string) {
  const [message, setMessage] = useState("");
  const previous = useRef(state);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    let next = "";
    if (before.self.muted !== state.self.muted && state.phase === "live") next = state.self.muted ? "You’re muted." : "Microphone on.";
    else if (before.other.presence === "waiting" && state.other.presence === "present") next = `${otherName} joined the call.`;
    else if (before.other.presence === "reconnecting" && state.other.presence === "present") next = `${otherName} is back.`;
    else if (before.phase === "reconnecting" && state.phase === "live") next = "Reconnected.";
    if (!next) return;
    setMessage(next);
    const timer = window.setTimeout(() => setMessage(""), TRANSIENT_MS);
    return () => window.clearTimeout(timer);
  }, [state, otherName]);
  return message;
}

const MemoTranscript = memo(Transcript);
const MemoControls = memo(CallControls);

/**
 * The realtime call screen (UX spec §5). Presentational: everything comes in as props, so the same
 * screen serves the creator (/call), the guest (/join) and the dev-only fixture route.
 */
export function CallScreen(props: CallScreenProps) {
  const { role, state, levels, self, other, turns, invite, technical = [] } = props;
  const [moreOpen, setMoreOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(true);
  const [announce, setAnnounce] = useState(true);
  const [shortcuts, setShortcuts] = useState(true);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setShortcuts(readShortcuts()), []);

  const names: Names = useMemo(() => ({
    self: self.name,
    other: other.name,
    selfLanguage: languageName(self.language),
    otherLanguage: languageName(other.language),
  }), [self.name, other.name, self.language, other.language]);
  const people: TranscriptPeople = useMemo(() => ({
    selfName: self.name,
    otherName: other.name,
    selfLanguage: self.language,
    otherLanguage: other.language,
  }), [self.name, other.name, self.language, other.language]);

  const selfState = personState(state, "self");
  const otherState = personState(state, "other");
  const bridge = bridgeState(state);
  const live = state.phase === "live" || state.phase === "reconnecting";
  const waiting = state.other.presence === "waiting";
  const showInvite = role === "creator" && waiting && Boolean(invite);
  const ending = state.phase === "ending";
  const disconnected = state.phase === "disconnected" && !state.endError;
  const transient = useTransitionAnnouncement(state, other.name);

  // Banners that are role="alert" already announce their condition; the status line stays quiet for
  // them so nothing is read twice (accessibility audit M3).
  const alerting = state.soundBlocked || disconnected || Boolean(state.endError);
  const baseStatus = statusLine(state, names);
  const status = alerting ? { ...baseStatus, message: "" } : baseStatus;
  const blocking = status.tone === "danger" || status.tone === "warning";
  const statusMessage = blocking ? status.message : transient || props.statusExtra || status.message;

  // Focus the call title once connected (UX spec §8.6).
  const focused = useRef(false);
  useEffect(() => {
    if (state.phase === "live" && !focused.current) {
      focused.current = true;
      titleRef.current?.focus();
    }
  }, [state.phase]);

  const toggleTranscript = useCallback(() => {
    setTranscriptOpen((open) => {
      // Hiding the panel while focus is inside it would drop focus to <body>.
      const active = document.activeElement;
      if (open && active && active.closest(".call-transcript")) {
        rootRef.current?.querySelector<HTMLButtonElement>("[data-transcript-toggle]")?.focus();
      }
      return !open;
    });
  }, []);

  // Single-key shortcuts (WCAG 2.1.4): only while focus is inside the call screen, never while
  // typing or with a dialog open, and they can be turned off in More. Never a single key for End.
  const handlers = useRef({ onToggleMute: props.onToggleMute, toggleTranscript });
  handlers.current = { onToggleMute: props.onToggleMute, toggleTranscript };
  useEffect(() => {
    if (!shortcuts) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const active = document.activeElement;
      if (!active || !rootRef.current?.contains(active)) return;
      const key = event.key.toLowerCase();
      if (key === "m" && live) { event.preventDefault(); handlers.current.onToggleMute(); }
      else if (key === "t") { event.preventDefault(); handlers.current.toggleTranscript(); }
      else if (key === "d") { event.preventDefault(); setDetailsOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, shortcuts]);

  const setShortcutsStored = (on: boolean) => {
    setShortcuts(on);
    try { window.localStorage.setItem(SHORTCUTS_KEY, on ? "on" : "off"); } catch { /* private mode */ }
  };

  const closeMore = useCallback(() => setMoreOpen(false), []);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);
  const openMore = useCallback(() => setMoreOpen(true), []);
  const openConfirm = useCallback(() => setConfirmOpen(true), []);
  const openDetails = useCallback(() => setDetailsOpen(true), []);
  const toggleInvite = useCallback(() => setInviteOpen((open) => !open), []);

  const outputSupported = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
  const graceSeconds = Math.round(PEER_GRACE_MS / 1000);

  return (
    <div className="call-screen" ref={rootRef} data-phase={state.phase} data-transcript={transcriptOpen ? "open" : "closed"}>
      <header className="call-header">
        <h1 className="call-title" ref={titleRef} tabIndex={-1}>
          <span lang={self.language}>{nativeLanguageName(self.language)}</span>
          <span className="call-title-swap" aria-hidden="true"><Icon name="swap" /></span>
          <span className="sr-only"> and </span>
          <span lang={other.language}>{nativeLanguageName(other.language)}</span>
          <span className="sr-only"> call</span>
        </h1>
        <CallTimer since={state.connectedAt} running={live} />
        <ConnectionIndicator state={state} />
        <button type="button" className="call-btn call-details-btn" data-variant="ghost" data-size="sm" onClick={openDetails} aria-keyshortcuts={shortcuts ? "D" : undefined}>
          Details
        </button>
      </header>

      <main className="call-main" id="main-content">
        <div className="call-banners">
          {state.soundBlocked && (
            <ErrorState
              variant="banner"
              title="Sound is blocked"
              action={<button type="button" className="call-btn" data-variant="primary" onClick={props.onStartAudio}><Icon name="sound" /> Tap to turn on sound</button>}
            >
              Your browser paused the translation audio until you allow it.
            </ErrorState>
          )}
          {state.phase === "reconnecting" && (
            <div className="call-banner" data-tone="warning"><span className="connection-ring" aria-hidden="true" /> Reconnecting… your call will continue when the connection returns.</div>
          )}
          {disconnected && (
            <ErrorState
              variant="banner"
              title={state.inUseElsewhere ? "This invite is in use on another device" : "You were disconnected"}
              action={
                <>
                  {props.onRejoin && props.canRejoin && !state.inUseElsewhere && <button type="button" className="call-btn" data-variant="primary" onClick={props.onRejoin}>Rejoin</button>}
                  <button type="button" className="call-btn" data-variant="danger" onClick={openConfirm}>End call</button>
                </>
              }
            >
              {props.canRejoin && !state.inUseElsewhere
                ? `Rejoin now: if you’re not back within about ${graceSeconds} seconds, the call ends for ${other.name} too.`
                : "Can’t rejoin this call: the link has expired."}
            </ErrorState>
          )}
          {state.endError && (
            <ErrorState
              variant="banner"
              title="Couldn’t end the call"
              technical={state.endError}
              action={<button type="button" className="call-btn" data-variant="danger" onClick={props.onEnd}>Retry end call</button>}
            >
              The other person may still be connected. Try again.
            </ErrorState>
          )}
        </div>

        <section className="call-people" aria-label="Participants">
          <div className="people-row">
            <ParticipantCard
              seat="self"
              name={self.name}
              speaks={self.language}
              hears={other.language}
              state={selfState}
              quality={state.self.quality}
              levels={levels}
            />
            <InterpreterBridge mode={bridge.mode} toward={bridge.toward} names={names} levels={levels} />
            <ParticipantCard
              seat="other"
              name={other.name}
              speaks={other.language}
              hears={self.language}
              state={otherState}
              quality={state.other.quality}
              levels={levels}
              binaryLevel
            />
          </div>
          <StatusLine status={{ ...status, message: statusMessage }} />
          {showInvite && (
            <div className="invite-slot" data-open={inviteOpen ? "true" : "false"}>
              {invite}
            </div>
          )}
        </section>

        <MemoTranscript turns={turns} people={people} announce={announce} error={props.transcriptError} hidden={!transcriptOpen} />

        <MemoControls
          muted={state.self.muted}
          micBusy={state.phase === "connecting"}
          onToggleMute={props.onToggleMute}
          onMore={openMore}
          onEnd={openConfirm}
          endBusy={ending}
          onTranscript={toggleTranscript}
          transcriptOpen={transcriptOpen}
          onDetails={openDetails}
          showInvite={showInvite}
          onInvite={toggleInvite}
          shortcuts={shortcuts}
        />
      </main>

      <CallDialog open={confirmOpen} onClose={closeConfirm} title="End the call for both of you?" initialFocus={cancelRef} describedBy="call-end-consequence"
        footer={
          <>
            <button ref={cancelRef} type="button" className="call-btn" data-variant="secondary" onClick={closeConfirm}>Cancel</button>
            <button type="button" className="call-btn" data-variant="danger" onClick={() => { setConfirmOpen(false); props.onEnd(); }}>End call</button>
          </>
        }
      >
        <p id="call-end-consequence">{other.name} will be disconnected too. Voice Labs can’t leave a call without ending it yet.</p>
      </CallDialog>

      <CallDialog open={moreOpen} onClose={closeMore} title="Call options" variant="sheet-bottom">
        <div className="more-grid">
          <p className="more-meta"><span><LanguageName id={self.language} /> ↔ <LanguageName id={other.language} /></span><CallTimer since={state.connectedAt} running={live && moreOpen} /></p>
          {showInvite && (
            <button type="button" className="call-btn" data-variant="secondary" onClick={() => { setMoreOpen(false); setInviteOpen(true); }}>
              <Icon name="link" /> Invite {other.name}
            </button>
          )}
          <DeviceSelect kind="audioinput" label="Microphone" onChange={props.onSwitchDevice} />
          {outputSupported && <DeviceSelect kind="audiooutput" label="Speaker" onChange={props.onSwitchDevice} />}
          {props.onVolume && (
            <div className="call-field">
              <label htmlFor="call-volume">Translation volume</label>
              <input id="call-volume" type="range" min={0} max={1} step={0.05} defaultValue={1} onChange={(event) => props.onVolume?.(Number(event.target.value))} />
            </div>
          )}
          <label className="call-check">
            <input type="checkbox" checked={announce} onChange={(event) => setAnnounce(event.target.checked)} />
            Announce new translations (screen readers)
          </label>
          <label className="call-check">
            <input type="checkbox" checked={shortcuts} onChange={(event) => setShortcutsStored(event.target.checked)} />
            Single-key shortcuts (M, T, D)
          </label>
          <button type="button" className="call-btn" data-variant="secondary" onClick={() => { setMoreOpen(false); setDetailsOpen(true); }}>
            <Icon name="details" /> Technical details
          </button>
          <div className="shortcut-list">
            <h3 className="call-panel-title">Keyboard shortcuts</h3>
            <p className="call-hint">{shortcuts ? "Work while focus is on the call screen and not in a text field." : "Turned off."}</p>
            <dl>
              <dt><kbd>M</kbd></dt><dd>Mute or unmute</dd>
              <dt><kbd>T</kbd></dt><dd>Show or hide the transcript</dd>
              <dt><kbd>D</kbd></dt><dd>Technical details</dd>
              <dt><kbd>Esc</kbd></dt><dd>Close this panel</dd>
            </dl>
          </div>
        </div>
      </CallDialog>

      <CallDialog open={detailsOpen} onClose={closeDetails} title="Technical details" variant="sheet-side">
        <dl className="tech-list">
          {technical.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value || "—"}</dd></div>)}
          <div><dt>Connection</dt><dd>{state.phase} · you {state.self.quality} · {other.name} {state.other.quality}</dd></div>
          <div><dt>Interpreter</dt><dd>{state.interpreter.present ? "in the room" : "not in the room"}{state.interpreter.speaking ? " · speaking" : ""}</dd></div>
          <div><dt>Hearing direction</dt><dd>{state.hearingTranslation === null ? "Not measured (audio analyser not running yet)" : "Measured from your translation track"}</dd></div>
          <div><dt>Transcript pairing</dt><dd>By order (approximate)</dd></div>
          <div><dt>Translating state</dt><dd>Inferred from speech timing and pending messages</dd></div>
        </dl>
        <h3 className="call-panel-title">Coming later</h3>
        <ul className="future-list">{FUTURE.map((item) => <li key={item}>{item}</li>)}</ul>
      </CallDialog>
    </div>
  );
}

function DeviceSelect({ kind, label, onChange }: { kind: "audioinput" | "audiooutput"; label: string; onChange?: (kind: "audioinput" | "audiooutput", id: string) => void }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    let alive = true;
    void navigator.mediaDevices?.enumerateDevices?.().then((all) => {
      if (alive) setDevices(all.filter((device) => device.kind === kind && device.deviceId));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [kind]);
  if (devices.length < 2 || !onChange) return null;
  const id = `call-device-${kind}`;
  return (
    <div className="call-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} defaultValue="default" onChange={(event) => onChange(kind, event.target.value)}>
        {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}
      </select>
    </div>
  );
}
