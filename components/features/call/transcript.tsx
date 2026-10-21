"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { announcementFor, type CallTurn } from "@/lib/call-transcript";
import { languageName } from "@/lib/languages";
import type { ConversationMessage } from "@/lib/platform";
import { EmptyState } from "./call-states";
import { prefersReducedMotion } from "./level-store";

/** Turns older than the last VISIBLE_TURNS hide behind "Show earlier" (UX spec §5.4). */
export const VISIBLE_TURNS = 50;

export type TranscriptPeople = {
  selfName: string;
  otherName: string;
  selfLanguage: string;
  otherLanguage: string;
};

const clock = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

function Text({ message, fallbackLang }: { message: ConversationMessage; fallbackLang: string }) {
  return <span lang={message.primary_language ?? fallbackLang}>{message.content}</span>;
}

/**
 * One utterance and its translation (design system §3.12–3.13). Perspective rule: the line in the
 * viewer's language is primary. For their speech that is the translation ("Translated"); for yours it
 * is your original, with "What {name} heard" underneath.
 */
export const TranscriptTurn = memo(function TranscriptTurn({ turn, people }: { turn: CallTurn; people: TranscriptPeople }) {
  const { selfName, otherName, selfLanguage, otherLanguage } = people;
  const seat = turn.speaker;
  const name = seat === "self" ? "You" : seat === "other" ? otherName : "Someone";
  const time = clock(turn.at);
  const original = turn.original;
  const translation = turn.translation;

  let body: React.ReactNode;
  if (turn.status === "unpaired" && translation) {
    body = (
      <p className="turn-primary">
        <span className="turn-tag">Translation</span>
        <Text message={translation} fallbackLang={seat === "self" ? otherLanguage : selfLanguage} />
      </p>
    );
  } else if (seat === "self" && original) {
    body = (
      <>
        <p className="turn-primary"><Text message={original} fallbackLang={selfLanguage} /></p>
        {translation && (
          <p className="turn-secondary turn-translation">
            <span className="turn-tag">What {otherName} heard</span>
            <Text message={translation} fallbackLang={otherLanguage} />
          </p>
        )}
      </>
    );
  } else if (original) {
    body = (
      <>
        <p className="turn-secondary">
          <span className="lang-code" aria-hidden="true">{(original.primary_language ?? otherLanguage).toUpperCase()}</span>
          <Text message={original} fallbackLang={otherLanguage} />
        </p>
        {translation && (
          <p className="turn-primary turn-translation">
            <span className="turn-tag">Translated</span>
            <Text message={translation} fallbackLang={selfLanguage} />
          </p>
        )}
      </>
    );
  }

  return (
    <li className="turn" data-seat={seat} data-status={turn.status}>
      <p className="turn-meta">
        <span className="turn-who">{name}</span>
        {time && <time className="turn-time" dateTime={turn.at}>{time}</time>}
        {seat === "self" && selfName && selfName !== "You" && <span className="sr-only"> ({selfName})</span>}
      </p>
      {body}
      {turn.status === "pending" && (
        <p className="turn-pending"><span aria-hidden="true">···</span> Translating into {languageName(seat === "self" ? otherLanguage : selfLanguage)}…</p>
      )}
      {turn.status === "timeout" && <p className="turn-timeout">No translation received</p>}
    </li>
  );
});

/**
 * The live transcript. The visible list is not a live region; a separate visually-hidden log carries
 * only the other person's completed lines in the viewer's language (UX spec §8.3), so the viewer's own
 * lines and pending lines are never read out. Sticks to the bottom while the reader is at the bottom;
 * otherwise shows "Jump to latest" with the count of new turns.
 */
export function Transcript({
  turns,
  people,
  announce = true,
  error = false,
  hidden = false,
}: {
  turns: CallTurn[];
  people: TranscriptPeople;
  announce?: boolean;
  error?: boolean;
  hidden?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const seenCount = useRef(turns.length);
  const [unseen, setUnseen] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => (showAll || turns.length <= VISIBLE_TURNS ? turns : turns.slice(-VISIBLE_TURNS)), [turns, showAll]);
  const announcements = useMemo(
    () => turns.map((turn) => ({ id: turn.id, text: announcementFor(turn, people.otherName), lang: turn.translation?.primary_language ?? people.selfLanguage })).filter((item) => item.text).slice(-5),
    [turns, people.otherName, people.selfLanguage],
  );

  const scrollToEnd = useCallback((smooth: boolean) => {
    const element = scroller.current;
    if (!element) return;
    if (typeof element.scrollTo === "function") element.scrollTo({ top: element.scrollHeight, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
    else element.scrollTop = element.scrollHeight;
    atBottom.current = true;
    seenCount.current = turns.length;
    setUnseen(0);
  }, [turns.length]);

  useLayoutEffect(() => {
    if (turns.length === seenCount.current) return;
    if (atBottom.current) scrollToEnd(false);
    else setUnseen(Math.max(0, turns.length - seenCount.current));
  }, [turns.length, scrollToEnd]);

  useEffect(() => {
    // Keep the bottom in view when the last row changes height (pending → translated).
    if (atBottom.current) scrollToEnd(false);
  }, [turns, scrollToEnd]);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 32;
    if (atBottom.current && unseen) {
      seenCount.current = turns.length;
      setUnseen(0);
    }
  };

  return (
    <section className="call-transcript" aria-labelledby="call-transcript-title" data-hidden={hidden ? "true" : "false"}>
      <h2 id="call-transcript-title" className="call-panel-title">Transcript</h2>
      <div className="transcript-scroll" ref={scroller} onScroll={onScroll} tabIndex={0} role="group" aria-label="Transcript lines">
        {turns.length === 0 ? (
          <EmptyState title="Nothing said yet">When someone speaks, their words and the translation appear here.</EmptyState>
        ) : (
          <>
            {turns.length > visible.length && (
              <button type="button" className="call-btn" data-variant="ghost" data-size="sm" onClick={() => setShowAll(true)}>
                Show earlier ({turns.length - visible.length})
              </button>
            )}
            <ol className="turn-list">
              {visible.map((turn) => <TranscriptTurn key={turn.id} turn={turn} people={people} />)}
            </ol>
          </>
        )}
        {error && <p className="transcript-note">Transcript is catching up…</p>}
      </div>
      {unseen > 0 && (
        <button type="button" className="jump-latest" onClick={() => scrollToEnd(true)}>
          Jump to latest · {unseen} new
        </button>
      )}
      <div className="sr-only" role="log" aria-live={announce ? "polite" : "off"} aria-relevant="additions" aria-label="New translations">
        {announcements.map((item) => <p key={item.id} lang={item.lang}>{item.text}</p>)}
      </div>
    </section>
  );
}
