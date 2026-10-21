"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { statusLine, type CallRoomState } from "@/lib/call-state";
import type { CallTurn } from "@/lib/call-transcript";
import { LanguageName } from "./language-select";
import { Avatar } from "./participant-card";
import { StatusLine } from "./status-indicator";
import { TranscriptTurn, type TranscriptPeople } from "./transcript";
import type { CallPerson } from "./call-screen";

/**
 * End-of-call summary (UX spec §4.4): duration, the two people and languages, the number of exchanges,
 * the last three pairs, then "Open full transcript" and (creator) "Start another call".
 * Focus moves to the heading when it appears.
 */
export function CallEnded({
  state,
  self,
  other,
  turns,
  endedAt,
  conversationId,
  onStartAnother,
}: {
  state: CallRoomState;
  self: CallPerson;
  other: CallPerson;
  turns: CallTurn[];
  endedAt: number;
  conversationId?: string | null;
  onStartAnother?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const seconds = state.connectedAt ? Math.max(0, Math.round((endedAt - state.connectedAt) / 1000)) : 0;
  const duration = `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
  const exchanges = turns.filter((turn) => turn.status === "complete").length;
  const people: TranscriptPeople = { selfName: self.name, otherName: other.name, selfLanguage: self.language, otherLanguage: other.language };
  const status = statusLine(state, { other: other.name });

  return (
    <main className="call-ended" id="main-content">
      <h1 ref={heading} tabIndex={-1}>Call ended</h1>
      <StatusLine status={status} />
      <dl className="ended-facts">
        <div><dt>Duration</dt><dd>{state.connectedAt ? duration : "—"}</dd></div>
        <div><dt>Exchanges</dt><dd>{exchanges}</dd></div>
      </dl>
      <ul className="ended-people" aria-label="People">
        <li><Avatar name={self.name} seat="self" size="sm" /><span><b>{self.name}</b> (you) · <LanguageName id={self.language} /></span></li>
        <li><Avatar name={other.name} seat="other" size="sm" /><span><b>{other.name}</b> · <LanguageName id={other.language} /></span></li>
      </ul>
      {turns.length > 0 && (
        <section aria-labelledby="ended-last">
          <h2 id="ended-last" className="call-panel-title">Last exchanges</h2>
          <ol className="turn-list">{turns.slice(-3).map((turn) => <TranscriptTurn key={turn.id} turn={turn} people={people} />)}</ol>
        </section>
      )}
      <div className="ended-actions">
        {conversationId && <Link className="call-btn" data-variant="secondary" href={`/conversations/${conversationId}`}>Open full transcript</Link>}
        {onStartAnother && <button type="button" className="call-btn" data-variant="primary" onClick={onStartAnother}>Start another call</button>}
      </div>
    </main>
  );
}
