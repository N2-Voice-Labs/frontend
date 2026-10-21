"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { parseInviteFragment, stripFragment, type Invite, type InviteParseResult } from "@/lib/invite";
import { getConversation } from "@/lib/platform";
import { ThemeToggle } from "@/components/features/landing/theme/theme-toggle";
import { CallEnded } from "./call-ended";
import { CallScreen } from "./call-screen";
import { EmptyState, ErrorState, LoadingState } from "./call-states";
import { Icon } from "./icons";
import { InviteCountdown, useInviteStage } from "./invite-countdown";
import { LanguageName } from "./language-select";
import { MicCheck, useMicCheck } from "./mic-check";
import { Avatar } from "./participant-card";
import { StatusLine } from "./status-indicator";
import { preloadLiveKit } from "./use-call-room";
import { useLiveCall } from "./use-live-call";

/**
 * Reads the invite once, then removes it from the address bar (UX spec §4.3 step 1). The fragment
 * never reaches a server; stripping it keeps the token out of bookmarks, history and screenshots.
 * Nothing here logs the credentials.
 */
export function useInviteFromFragment(): InviteParseResult | null {
  const [result, setResult] = useState<InviteParseResult | null>(null);
  // Kept in a ref: StrictMode runs effects twice, and the second run would see the stripped URL.
  const parsedRef = useRef<InviteParseResult | null>(null);
  useEffect(() => {
    if (!parsedRef.current) {
      parsedRef.current = parseInviteFragment(window.location.hash);
      if (window.location.hash) stripFragment();
    }
    setResult(parsedRef.current);
  }, []);
  return result;
}

/** /join: the guest's side of a call. */
export function JoinExperience() {
  const result = useInviteFromFragment();
  return (
    <div className="call-setup-page">
      {result?.ok ? null : <JoinHeader />}
      {result === null ? (
        <main className="call-setup" id="main-content"><LoadingState label="Opening your invite…" /></main>
      ) : result.ok ? (
        <JoinCall invite={result.invite} />
      ) : (
        <main className="call-setup" id="main-content">
          <h1>This invite link is incomplete</h1>
          <ErrorState title="The link is missing some of its parts" alert={false}>
            {`Ask ${result.from || "the person who invited you"} for a new one. Invite links work for 10 minutes.`}
          </ErrorState>
          <p className="call-hint">Want to start your own call? <Link href="/call">Start a call</Link></p>
        </main>
      )}
    </div>
  );
}

function JoinHeader() {
  return (
    <header className="call-setup-header">
      <Link className="marketing-brand" href="/" aria-label="Voice Labs home"><span className="brand-glyph">v<span>.</span></span><span>voice labs</span></Link>
      <div className="call-setup-header-actions"><ThemeToggle /></div>
    </header>
  );
}

function JoinCall({ invite }: { invite: Invite }) {
  const formId = useId();
  const mic = useMicCheck();
  const [name, setName] = useState(invite.name);
  const [ended, setEnded] = useState(false);
  const [joining, setJoining] = useState(false);
  const from = invite.from || "Your host";

  const live = useLiveCall({
    selfLanguage: invite.me,
    otherLanguage: invite.them,
    otherName: from,
    conversationId: invite.conversationId,
    sessionId: invite.sessionId,
    sessionToken: invite.sessionToken,
  });
  const { room } = live;
  const state = room.state;

  // The join countdown only matters before joining. JoinCall itself re-renders only when the stage
  // changes (open -> minute -> expired); the ticking text is the <InviteCountdown> leaf.
  const prejoin = state.phase === "idle" || state.phase === "failed";
  const stage = useInviteStage(invite.expiresAt, prejoin);
  // Warn once at one minute left, robust to throttled background timers (WCAG 2.2.1).
  const warnedRef = useRef(false);
  const [warning, setWarning] = useState("");
  useEffect(() => {
    if (!warnedRef.current && stage === "minute") {
      warnedRef.current = true;
      setWarning("One minute left to join.");
    }
  }, [stage]);

  const { setMuted, end: roomEnd, startAudio: roomStartAudio, rejoin: roomRejoin, switchDevice: roomSwitch } = room;
  const muted = state.self.muted;
  const toggleMute = useCallback(() => void setMuted(!muted), [setMuted, muted]);
  const endCall = useCallback(() => void roomEnd(), [roomEnd]);
  const startAudio = useCallback(() => void roomStartAudio(), [roomStartAudio]);
  const rejoin = useCallback(() => void roomRejoin(), [roomRejoin]);
  const switchDevice = useCallback((kind: "audioinput" | "audiooutput", id: string) => void roomSwitch(kind, id), [roomSwitch]);

  // Already over? (Guest session tokens may read the conversation.)
  useEffect(() => {
    let alive = true;
    getConversation(invite.conversationId, invite.sessionToken).then((conversation) => {
      if (alive && (conversation.status === "ended" || conversation.status === "failed")) setEnded(true);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [invite.conversationId, invite.sessionToken]);

  async function join() {
    room.primeAudio(); // synchronously inside the Join click (iOS Web Audio)
    setJoining(true);
    const micDeviceId = mic.deviceId || undefined;
    mic.release();
    await room.connect({
      url: invite.url,
      token: invite.token,
      sessionId: invite.sessionId,
      sessionToken: invite.sessionToken,
      tokenExpiresAt: invite.expiresAt,
      micDeviceId,
    });
    setJoining(false);
  }

  const selfName = name.trim() || "You";
  const people = { self: { name: selfName, language: invite.me }, other: { name: from, language: invite.them } };

  if (state.phase === "ended") {
    return <CallEnded state={state} self={people.self} other={people.other} turns={live.turns} endedAt={live.endedAt} />;
  }
  if (state.phase !== "idle" && state.phase !== "failed") {
    return (
      <CallScreen
        role="guest"
        state={state}
        levels={room.levels}
        self={people.self}
        other={people.other}
        turns={live.turns}
        transcriptError={live.conversation.transcriptError}
        onToggleMute={toggleMute}
        onEnd={endCall}
        onStartAudio={startAudio}
        onRejoin={rejoin}
        canRejoin={room.canRejoin()}
        onSwitchDevice={switchDevice}
        onVolume={room.setVolume}
        technical={[
          { label: "Session", value: invite.sessionId },
          { label: "Conversation", value: invite.conversationId },
          { label: "Role", value: "Guest" },
          { label: "Runtime", value: live.conversation.runtimeStatus },
        ]}
      />
    );
  }

  const expired = stage === "expired";
  return (
    <>
      <JoinHeader />
      <main className="call-setup" id="main-content">
        {ended ? (
          <>
            <h1>This call has ended</h1>
            <EmptyState title="Nothing to join" action={<Link className="call-btn" data-variant="primary" href="/call">Start your own call</Link>}>
              {from} already ended this call.
            </EmptyState>
          </>
        ) : expired ? (
          <>
            <h1>This invite has expired</h1>
            <ErrorState title="Invite links work for 10 minutes" alert={false}>{`Ask ${from} to start a new call.`}</ErrorState>
          </>
        ) : (
          <>
            <p className="join-from"><Avatar name={from} seat="other" size="sm" /> <span>{from} invited you to a call</span></p>
            <h1>Join the call</h1>
            <ul className="join-pair">
              <li data-seat="self">
                <p><b>You</b> speak <strong><LanguageName id={invite.me} /></strong></p>
                <span>you’ll hear {from} in <LanguageName id={invite.me} /></span>
              </li>
              <li data-seat="other">
                <p><b>{from}</b> speaks <strong><LanguageName id={invite.them} /></strong></p>
                <span>they’ll hear you in <LanguageName id={invite.them} /></span>
              </li>
            </ul>
            <form className="call-form" onSubmit={(event) => { event.preventDefault(); if (mic.status === "ready") void join(); }}>
              <div className="call-field">
                <label htmlFor={`${formId}-name`}>Your name</label>
                <input id={`${formId}-name`} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} aria-describedby={`${formId}-name-hint`} />
                <p className="call-hint" id={`${formId}-name-hint`}>Shown on this screen. {from} already has the name they gave you.</p>
              </div>
              <MicCheck mic={mic} idPrefix={formId} onReady={preloadLiveKit} />
              {state.phase === "failed" && (
                <ErrorState title={state.error === "This invite has expired." ? "This invite has expired" : "Couldn’t join the call"}>
                  {state.error === "This invite has expired." ? `Ask ${from} to start a new call.` : state.error}
                </ErrorState>
              )}
              <div className="call-submit">
                <button type="submit" className="call-btn" data-variant="primary" data-size="lg" disabled={mic.status !== "ready" || joining}>
                  <Icon name="phone" /> Join call
                </button>
                <p className="invite-countdown">Join within <InviteCountdown expiresAt={invite.expiresAt} /></p>
              </div>
            </form>
            <StatusLine status={{ message: warning, tone: "neutral" }} />
          </>
        )}
      </main>
    </>
  );
}
