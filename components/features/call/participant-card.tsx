import { memo } from "react";
import { languageName, nativeLanguageName } from "@/lib/languages";
import { LanguageName } from "./language-select";
import { PERSON_STATE_WORDS, type PersonState, type Quality, type Seat } from "@/lib/call-state";
import { Icon } from "./icons";
import { LevelMeter } from "./level-meter";
import type { LevelStore } from "./level-store";

export function initials(name: string) {
  const parts = name.trim().split(/[\s-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "?";
  const second = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] ?? "" : "";
  return (first + second).toUpperCase();
}

/** Decorative avatar; the name next to it carries the meaning. */
export function Avatar({ name, seat, state, size = "md" }: { name: string; seat: Seat | "agent"; state?: PersonState; size?: "sm" | "md" | "lg" }) {
  return (
    <span className="call-avatar" data-seat={seat} data-state={state} data-size={size} aria-hidden="true">
      {initials(name)}
      {state === "muted" && <span className="call-avatar-badge"><Icon name="mic-off" /></span>}
      {state === "reconnecting" && <span className="call-avatar-badge" data-tone="warning"><Icon name="alert" /></span>}
    </span>
  );
}

export type ParticipantCardProps = {
  seat: Seat;
  name: string;
  /** The language this person speaks. */
  speaks: string;
  /** The language this person hears (the other person's speech, translated). */
  hears: string;
  state: PersonState;
  quality: Quality;
  levels?: LevelStore | null;
  /** True when no real level exists for this person (their raw audio is not subscribed). */
  binaryLevel?: boolean;
  compact?: boolean;
};

/**
 * One person in the call (design system §3.7). Re-renders only when its props change (state,
 * quality); the level meter is ref-driven. Not a live region: the page status line announces changes.
 */
export const ParticipantCard = memo(function ParticipantCard({ seat, name, speaks, hears, state, quality, levels, binaryLevel = false, compact = false }: ParticipantCardProps) {
  const word = PERSON_STATE_WORDS[state];
  const weak = (quality === "poor" || quality === "lost") && state !== "waiting" && state !== "left";
  const you = seat === "self";
  const label = `${name}${you ? " (you)" : ""}, speaks ${languageName(speaks)}, hears ${languageName(hears)}, ${word.replace("…", "").toLowerCase()}${weak ? ", weak connection" : ""}`;
  const showMeter = state === "speaking" || state === "listening" || state === "hearing";
  return (
    <article className="participant-card" data-seat={seat} data-state={state} data-compact={compact ? "true" : "false"} aria-label={label}>
      <Avatar name={name} seat={seat} state={state} size={compact ? "sm" : "lg"} />
      <div className="participant-body">
        <p className="participant-name">
          <span className="participant-name-text">{name}</span>
          {you && <span className="participant-you">You</span>}
        </p>
        <p className="participant-lang">
          <span className="participant-speaks">
            Speaks <b>{compact ? <span lang={speaks}>{nativeLanguageName(speaks)}</span> : languageName(speaks)}</b>
            <span className="lang-code" aria-hidden="true">{speaks.toUpperCase()}</span>
          </span>
          <span className="participant-hears">hears <LanguageName id={hears} /></span>
        </p>
        <p className="participant-state">
          <span className="state-word" data-state={state}>
            {state === "muted" && <Icon name="mic-off" />}
            {state === "hearing" && <Icon name="sound" />}
            {word}
          </span>
          {showMeter && (
            <LevelMeter
              store={levels}
              source={state === "hearing" ? "interp" : seat}
              tone={state === "hearing" ? "interp" : seat}
              active={state === "speaking" || state === "hearing"}
              binary={binaryLevel && state !== "hearing"}
              size={compact ? "sm" : "md"}
            />
          )}
          {weak && (
            <span className="quality-chip" data-quality={quality}>
              <span className="quality-bars" aria-hidden="true"><i /><i /><i /></span>
              Weak connection
            </span>
          )}
        </p>
      </div>
    </article>
  );
});
