"use client";

import { useEffect, useId, useRef, useState } from "react";
import { describeError, errorCode } from "@/lib/platform-errors";
import { addSessionParticipant } from "@/lib/platform";
import { buildInviteLink, INVITE_TTL_SECONDS, type Invite } from "@/lib/invite";
import { ErrorState } from "./call-states";
import { Icon } from "./icons";
import { InviteCountdown, useInviteStage } from "./invite-countdown";
import { LanguageReadout } from "./language-select";

export type InviteLink = { link: string; expiresAt: number; name: string };

/**
 * Invite the second person (UX spec §4.2). Creating the link is an explicit click: it uses up the
 * call's only guest slot and starts the 10-minute LiveKit clock. The link is built in the browser and
 * carries the guest credentials in its #fragment (never sent to a server).
 */
export function InvitePanel({
  sessionId,
  conversationId,
  sessionToken,
  selfName,
  selfLanguage,
  otherLanguage,
  otherName,
  onOtherNameChange,
  invite,
  onInvite,
  onExpiredRestart,
  onMinuteLeft,
  origin,
}: {
  sessionId: string;
  conversationId: string;
  sessionToken?: string | null;
  selfName: string;
  selfLanguage: string;
  otherLanguage: string;
  otherName: string;
  onOtherNameChange: (name: string) => void;
  invite: InviteLink | null;
  onInvite: (invite: InviteLink) => void;
  onExpiredRestart: () => void;
  /** Receives the 1-minute / expired warning for the page status line (WCAG 2.2.1), or undefined. */
  onMinuteLeft?: (message: string | undefined) => void;
  origin?: string;
}) {
  const nameId = useId();
  const linkId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code: string | null } | null>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "manual">("idle");
  const stage = useInviteStage(invite ? invite.expiresAt : null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  // The countdown itself is not live; the warning goes once through the page's status line.
  const warned = useRef<"none" | "minute" | "expired">("none");
  useEffect(() => {
    if (!invite || !onMinuteLeft) return;
    if (stage === "expired" && warned.current !== "expired") {
      warned.current = "expired";
      onMinuteLeft("The invite link has expired.");
    } else if (stage === "minute" && warned.current === "none") {
      warned.current = "minute";
      onMinuteLeft("The invite link expires in 1 minute.");
    }
  }, [stage, invite, onMinuteLeft]);
  useEffect(() => () => onMinuteLeft?.(undefined), [onMinuteLeft]);

  // Focus Copy as soon as the link exists (UX spec §8.6).
  useEffect(() => {
    if (invite) copyRef.current?.focus();
  }, [invite]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const display = otherName.trim() || null;
      const guest = await addSessionParticipant(sessionId, { language: otherLanguage, display_name: display }, sessionToken);
      const expiresAt = Math.floor(Date.now() / 1000) + INVITE_TTL_SECONDS;
      const payload: Invite = {
        sessionId,
        conversationId,
        url: guest.connection.url,
        token: guest.connection.token,
        sessionToken: guest.session_token,
        me: otherLanguage,
        them: selfLanguage,
        from: selfName,
        name: otherName.trim(),
        expiresAt,
      };
      onInvite({ link: buildInviteLink(origin ?? window.location.origin, payload), expiresAt, name: otherName.trim() });
    } catch (cause) {
      setError({ message: describeError(cause, "Couldn’t create the invite link. Try again."), code: errorCode(cause) });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied("copied");
    } catch {
      linkRef.current?.select();
      setCopied("manual");
    }
  }

  async function share() {
    if (!invite || typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: "Join my Voice Labs call", text: `${selfName} invited you to a translated call.`, url: invite.link });
    } catch {
      // Cancelled.
    }
  }

  const who = otherName.trim() || "them";
  const expired = invite !== null && stage === "expired";
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <section className="invite-panel" aria-labelledby={`${nameId}-title`}>
      <h2 id={`${nameId}-title`} className="call-panel-title">Invite the other person</h2>
      {!invite && (
        <>
          <p className="invite-lang">They speak <LanguageReadout language={otherLanguage} /></p>
          <div className="call-field">
            <label htmlFor={nameId}>Their name <span className="call-optional">(optional)</span></label>
            <input id={nameId} value={otherName} maxLength={100} autoComplete="off" onChange={(event) => onOtherNameChange(event.target.value)} />
          </div>
          <p className="call-hint">You can create one invite link per call. It can be used to join for the next 10 minutes.</p>
          <button type="button" className="call-btn" data-variant="primary" onClick={() => void create()} disabled={busy} aria-busy={busy || undefined}>
            {busy ? <span className="call-spinner" aria-hidden="true" /> : <Icon name="link" />} Create invite link
          </button>
          {error && (
            <ErrorState
              title={error.code === "session_full" ? "Someone has already been invited to this call" : "Couldn’t create the invite link"}
              technical={error.code ?? undefined}
              action={error.code === "session_full" ? <button type="button" className="call-btn" data-variant="secondary" data-size="sm" onClick={onExpiredRestart}>End call and start a new one</button> : undefined}
            >
              {error.code === "session_full" ? "This call can only have one guest link." : error.message}
            </ErrorState>
          )}
        </>
      )}
      {invite && !expired && (
        <>
          <div className="call-field">
            <label htmlFor={linkId}>Invite link</label>
            <input id={linkId} ref={linkRef} className="invite-link" value={invite.link} readOnly onFocus={(event) => event.currentTarget.select()} />
          </div>
          <div className="invite-actions">
            {canShare && <button type="button" className="call-btn" data-variant="primary" onClick={() => void share()}><Icon name="share" /> Share…</button>}
            <button ref={copyRef} type="button" className="call-btn" data-variant={canShare ? "secondary" : "primary"} onClick={() => void copy()}>
              <Icon name={copied === "copied" ? "check" : "copy"} /> {copied === "copied" ? "Link copied" : "Copy link"}
            </button>
            <a className="call-btn" data-variant="ghost" href={invite.link} target="_blank" rel="noopener noreferrer">Open guest view in a new tab</a>
          </div>
          {copied === "manual" && <p className="call-hint">Copying is blocked here. Press ⌘C / Ctrl+C to copy the selected link.</p>}
          <p className="invite-countdown">Link works for <InviteCountdown expiresAt={invite.expiresAt} /></p>
          <p className="call-hint">
            Treat this link like a password. Anyone who has it can join as {who} during the next 10 minutes; opening it again
            moves the call to the newer device. It also lets them read this call’s transcript, even after the call.
            Testing on one device? Use headphones to avoid echo.
          </p>
        </>
      )}
      {expired && (
        <ErrorState
          title="The invite link expired"
          action={<button type="button" className="call-btn" data-variant="primary" data-size="sm" onClick={onExpiredRestart}>End and start a new call</button>}
        >
          The link expired before {who} joined. Voice Labs can’t issue a second link for this call.
        </ErrorState>
      )}
    </section>
  );
}
