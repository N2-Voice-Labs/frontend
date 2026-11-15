"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { parseInviteCode, stripFragment, type InviteCodeResult, type InviteInfo } from "@/lib/invite";
import { getCallInvite, getConversation, joinCall } from "@/lib/platform";
import { describeError, errorCode } from "@/lib/platform-errors";
import { ThemeToggle } from "@/components/shared/theme-toggle";
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
 * Reads the invitation code once, then removes it from the address bar (UX spec §4.3 step 1). The
 * fragment never reaches a server; stripping it keeps the code out of bookmarks, history and
 * screenshots. Nothing here logs it.
 */
export function useInviteFromFragment(): InviteCodeResult | null {
  const [result, setResult] = useState<InviteCodeResult | null>(null);
  // Kept in a ref: StrictMode runs effects twice, and the second run would see the stripped URL.
  const parsedRef = useRef<InviteCodeResult | null>(null);
  useEffect(() => {
    if (!parsedRef.current) {
      parsedRef.current = parseInviteCode(window.location.hash);
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
      {result === null ? (
        <main className="call-setup" id="main-content"><LoadingState label="Opening your invite…" /></main>
      ) : result.ok ? (
        <JoinCall code={result.code} />
      ) : (
        <>
          <JoinHeader />
          <main className="call-setup" id="main-content">
            <h1>This invite link is incomplete</h1>
            <ErrorState title="The link is missing some of its parts" alert={false}>
              Ask the person who invited you for a new one. Copy the whole link, including everything after the “#”.
            </ErrorState>
            <p className="call-hint">Want to start your own call? <Link href="/call">Start a call</Link></p>
          </main>
        </>
      )}
    </div>
  );
}

function JoinHeader() {
  return (
    <header className="call-setup-header">
      <Link className="marketing-brand" href="/" aria-label="UNAI home"><span className="brand-glyph">u<span>.</span></span><span>unai</span></Link>
      <div className="call-setup-header-actions"><ThemeToggle /></div>
    </header>
  );
}

type Lookup = { status: "loading" } | { status: "ready"; info: InviteInfo } | { status: "failed"; code: string | null; message: string };
type Seat = { sessionId: string; conversationId: string; sessionToken: string };

function JoinCall({ code }: { code: string }) {
  const formId = useId();
  const mic = useMicCheck();
  const [name, setName] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ status: "loading" });
  const [seat, setSeat] = useState<Seat | null>(null);
  const [ended, setEnded] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<{ code: string | null; message: string } | null>(null);
  const info = lookup.status === "ready" ? lookup.info : null;
  const from = info?.from || "Your host";

  useEffect(() => {
    let alive = true;
    getCallInvite(code).then(
      (found) => alive && setLookup({ status: "ready", info: { code, from: found.from, me: found.me, them: found.them, expiresAt: found.expires_at } }),
      (cause) => alive && setLookup({ status: "failed", code: errorCode(cause), message: describeError(cause, "Couldn’t open this invite. Try again.") }),
    );
    return () => { alive = false; };
  }, [code]);

  const live = useLiveCall({
    selfLanguage: info?.me ?? "",
    otherLanguage: info?.them ?? "",
    otherName: from,
    conversationId: seat?.conversationId ?? null,
    sessionId: seat?.sessionId ?? null,
    sessionToken: seat?.sessionToken ?? null,
  });
  const { room } = live;
  const state = room.state;

  // The join countdown only matters before joining. JoinCall itself re-renders only when the stage
  // changes (open -> minute -> expired); the ticking text is the <InviteCountdown> leaf.
  const prejoin = state.phase === "idle" || state.phase === "failed";
  const stage = useInviteStage(info ? info.expiresAt : null, prejoin);
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

  async function join() {
    room.primeAudio(); // synchronously inside the Join click (iOS Web Audio)
    setJoining(true);
    setJoinError(null);
    const micDeviceId = mic.deviceId || undefined;
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const guest = await joinCall(code, name.trim() || null);
      mic.release();
      const next: Seat = { sessionId: guest.session_id, conversationId: guest.conversation_id, sessionToken: guest.session_token };
      setSeat(next);
      // Already over? (Guest session tokens may read the conversation.)
      getConversation(next.conversationId, next.sessionToken).then((conversation) => {
        if (conversation.status === "ended" || conversation.status === "failed") setEnded(true);
      }).catch(() => undefined);
      await room.connect({
        url: guest.connection.url,
        token: guest.connection.token,
        listen: guest.connection.listen,
        sessionId: next.sessionId,
        sessionToken: next.sessionToken,
        tokenExpiresAt: issuedAt + 600,
        micDeviceId,
      });
    } catch (cause) {
      setJoinError({ code: errorCode(cause), message: describeError(cause, "Couldn’t join the call. Try again.") });
    } finally {
      setJoining(false);
    }
  }

  const selfName = name.trim() || "You";
  const people = { self: { name: selfName, language: info?.me ?? "" }, other: { name: from, language: info?.them ?? "" } };

  if (state.phase === "ended") {
    return <CallEnded state={state} self={people.self} other={people.other} turns={live.turns} endedAt={live.endedAt} />;
  }
  if (state.phase !== "idle" && state.phase !== "failed" && seat) {
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
          { label: "Session", value: seat.sessionId },
          { label: "Conversation", value: seat.conversationId },
          { label: "Role", value: "Guest" },
          { label: "Runtime", value: live.conversation.runtimeStatus },
        ]}
      />
    );
  }

  if (lookup.status === "loading") {
    return <main className="call-setup" id="main-content"><LoadingState label="Opening your invite…" /></main>;
  }
  if (lookup.status === "failed") {
    const expired = lookup.code === "invite_expired";
    const over = lookup.code === "call_ended";
    return (
      <>
        <JoinHeader />
        <main className="call-setup" id="main-content">
          <h1>{expired ? "This invite has expired" : over ? "This call has ended" : "This invite doesn’t work"}</h1>
          <ErrorState title={expired ? "Invite links expire" : over ? "Nothing to join" : "Couldn’t open this invite"} alert={false} technical={lookup.code ?? undefined}>
            {expired ? "Ask the person who invited you to send a new link." : over ? "The call was already ended." : lookup.message}
          </ErrorState>
          <p className="call-hint">Want to start your own call? <Link href="/call">Start a call</Link></p>
        </main>
      </>
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
            <ErrorState title="Invite links expire" alert={false}>{`Ask ${from} to send a new link.`}</ErrorState>
          </>
        ) : (
          <>
            <p className="join-from"><Avatar name={from} seat="other" size="sm" /> <span>{from} invited you to a call</span></p>
            <h1>Join the call</h1>
            <ul className="join-pair">
              <li data-seat="self">
                <p><b>You</b> speak <strong><LanguageName id={info!.me} /></strong></p>
                <span>you’ll hear {from} in <LanguageName id={info!.me} /></span>
              </li>
              <li data-seat="other">
                <p><b>{from}</b> speaks <strong><LanguageName id={info!.them} /></strong></p>
                <span>they’ll hear you in <LanguageName id={info!.them} /></span>
              </li>
            </ul>
            <form className="call-form" onSubmit={(event) => { event.preventDefault(); if (mic.status === "ready" && !joining) void join(); }}>
              <div className="call-field">
                <label htmlFor={`${formId}-name`}>Your name <span className="call-optional">(optional)</span></label>
                <input id={`${formId}-name`} value={name} maxLength={100} autoComplete="given-name" onChange={(event) => setName(event.target.value)} aria-describedby={`${formId}-name-hint`} />
                <p className="call-hint" id={`${formId}-name-hint`}>Shown on this screen and in {from}’s transcript.</p>
              </div>
              <MicCheck mic={mic} idPrefix={formId} onReady={preloadLiveKit} />
              {(joinError || state.phase === "failed") && (
                <ErrorState title={joinError?.code === "invite_expired" || state.error === "This invite has expired." ? "This invite has expired" : "Couldn’t join the call"} technical={joinError?.code ?? undefined}>
                  {joinError?.message ?? state.error}
                </ErrorState>
              )}
              <div className="call-submit">
                <button type="submit" className="call-btn" data-variant="primary" data-size="lg" disabled={mic.status !== "ready" || joining}>
                  <Icon name="phone" /> Join call
                </button>
                <p className="invite-countdown">Join within <InviteCountdown expiresAt={info!.expiresAt} /></p>
              </div>
            </form>
            <StatusLine status={{ message: warning, tone: "neutral" }} />
          </>
        )}
      </main>
    </>
  );
}
