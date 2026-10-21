import type { ConversationMessage } from "./platform";

/**
 * Turns polled interpreter messages into perspective-aware turns (UX spec §5.4).
 *
 * What the Platform gives us: finished utterances only, `role` and `primary_language`, no speaker id.
 * In a two-person call the two languages always differ, so:
 * - `user` + language = which person spoke (the original);
 * - `assistant` + language = whose listener got the translation (the translation is in the
 *   listener's language, so the speaker is the other person).
 * Pairing an original with its translation can only use order. It is a heuristic and the UI says so
 * in Technical details ("Pairing: by order (approximate)").
 */

export type Seat = "self" | "other";

export type CallTurn = {
  /** Stable key: the original's message id, or the translation's id when unpaired. */
  id: string;
  speaker: Seat | "unknown";
  original?: ConversationMessage;
  translation?: ConversationMessage;
  /**
   * complete: original + translation. pending: original waiting for its translation.
   * timeout: no translation after `PENDING_TIMEOUT_MS`. unpaired: a translation with no original.
   */
  status: "complete" | "pending" | "timeout" | "unpaired";
  at: string;
};

export const PENDING_TIMEOUT_MS = 20_000;

const time = (message: ConversationMessage) => Date.parse(message.created_at) || 0;
const lang = (message: ConversationMessage) => (message.primary_language ?? "").toLowerCase();

export function pairCallMessages(
  messages: readonly ConversationMessage[],
  languages: { self: string; other: string },
  nowMs = Date.now(),
): CallTurn[] {
  const ordered = [...messages].sort((a, b) => time(a) - time(b));
  const turns: CallTurn[] = [];
  const seatFor = (language: string): Seat | "unknown" =>
    language === languages.self ? "self" : language === languages.other ? "other" : "unknown";

  for (const message of ordered) {
    const role = message.role.toLowerCase();
    if (role === "user") {
      turns.push({ id: message.id, speaker: seatFor(lang(message)), original: message, status: "pending", at: message.created_at });
      continue;
    }
    if (role !== "assistant") continue;
    // The translation is in the listener's language, so the speaker is the other seat.
    const listener = seatFor(lang(message));
    const speaker: Seat | "unknown" = listener === "self" ? "other" : listener === "other" ? "self" : "unknown";
    // Closest preceding unpaired original from that speaker (by order).
    let match: CallTurn | undefined;
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index];
      if (!turn.original || turn.translation) continue;
      if (speaker === "unknown" || turn.speaker === speaker || turn.speaker === "unknown") {
        match = turn;
        break;
      }
    }
    if (match) {
      match.translation = message;
      match.status = "complete";
      if (match.speaker === "unknown") match.speaker = speaker;
    } else {
      turns.push({ id: message.id, speaker, translation: message, status: "unpaired", at: message.created_at });
    }
  }

  for (const turn of turns) {
    if (turn.status === "pending" && turn.original && nowMs - time(turn.original) > PENDING_TIMEOUT_MS) turn.status = "timeout";
  }
  return turns;
}

/** The newest original still waiting for its translation, if any (drives the inferred "Translating"). */
export function latestPending(turns: readonly CallTurn[]): CallTurn | undefined {
  const last = turns[turns.length - 1];
  return last?.status === "pending" ? last : undefined;
}

/**
 * The line a screen reader should hear for a turn: only the other person's completed speech, in the
 * viewer's language (UX spec §8.3). Pending lines and the viewer's own lines are never announced.
 */
export function announcementFor(turn: CallTurn, otherName: string): string | null {
  if (turn.speaker !== "other" || turn.status !== "complete" || !turn.translation) return null;
  return `${otherName}: ${turn.translation.content}`;
}

/**
 * Keeps object identity for turns that did not change, so `memo(TranscriptTurn)` holds and only new or
 * changed rows re-render (performance review finding 4). Returns `previous` itself when nothing changed.
 */
export function reuseTurns(previous: readonly CallTurn[], next: CallTurn[]): CallTurn[] {
  if (previous.length === 0) return next;
  const byId = new Map(previous.map((turn) => [turn.id, turn]));
  let changed = previous.length !== next.length;
  const merged = next.map((turn, index) => {
    const old = byId.get(turn.id);
    const same = old
      && old.status === turn.status
      && old.speaker === turn.speaker
      && old.original === turn.original
      && old.translation === turn.translation;
    if (!same) {
      changed = true;
      return turn;
    }
    if (previous[index] !== old) changed = true;
    return old;
  });
  return changed ? merged : (previous as CallTurn[]);
}
