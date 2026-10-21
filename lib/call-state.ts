/**
 * Pure state machine for a two-person interpreter call (UX spec §5.3). The LiveKit wiring lives in
 * `components/features/call/use-call-room.ts`; everything here is plain data so it can be tested
 * without a browser. Audio levels are deliberately NOT in this state: they go to the LevelStore and
 * reach the DOM through CSS variables, so a level sample never re-renders React.
 */

export type Seat = "self" | "other";
export type Quality = "excellent" | "good" | "poor" | "lost" | "unknown";
export type CallPhase = "idle" | "connecting" | "live" | "reconnecting" | "disconnected" | "ending" | "ended" | "failed";
export type PeerPresence = "waiting" | "present" | "reconnecting" | "left";
export type EndReason = "self" | "other" | "peer-lost" | "remote";

export type CallRoomState = {
  phase: CallPhase;
  connectedAt: number | null;
  self: { speaking: boolean; muted: boolean; quality: Quality };
  other: { presence: PeerPresence; everJoined: boolean; speaking: boolean; muted: boolean; quality: Quality; identity: string | null };
  interpreter: { present: boolean; everJoined: boolean; speaking: boolean; unavailable: boolean };
  /** Inferred: a person stopped speaking and the interpreter has not started yet (times out, see TRANSLATING_TIMEOUT_MS). */
  translating: { toward: Seat; since: number } | null;
  /** Our own translation track has energy. `null` when the browser cannot measure it (no direction then). */
  hearingTranslation: boolean | null;
  soundBlocked: boolean;
  endReason: EndReason | null;
  /** Ending failed; the UI offers "Retry end call". */
  endError: string | null;
  /** Start/connect failure or why we were disconnected. */
  error: string | null;
  /** Disconnected because the same identity joined elsewhere (link opened twice). */
  inUseElsewhere: boolean;
};

export type CallAction =
  | { type: "connect" }
  | { type: "connected"; at: number }
  | { type: "connect-failed"; message: string }
  | { type: "reconnecting" }
  | { type: "reconnected" }
  | { type: "disconnected"; message: string; inUseElsewhere?: boolean }
  | { type: "participant-joined"; seat: Seat | "interpreter"; identity: string; muted?: boolean }
  | { type: "participant-left"; seat: Seat | "interpreter" }
  | { type: "peer-gone" }
  | { type: "speakers"; self: boolean; other: boolean; interpreter: boolean; at: number }
  | { type: "muted"; seat: Seat; muted: boolean }
  | { type: "quality"; seat: Seat; quality: Quality }
  | { type: "sound-blocked"; blocked: boolean }
  | { type: "hearing"; hearing: boolean | null }
  | { type: "translation-pending"; toward: Seat; at: number }
  | { type: "translating-timeout"; since: number }
  | { type: "interpreter-unavailable"; unavailable: boolean }
  | { type: "ending" }
  | { type: "ended"; reason: EndReason }
  | { type: "end-failed"; message: string };

/** How long the inferred "Translating" state may hold with no audio and no message (UX spec §5.3). */
export const TRANSLATING_TIMEOUT_MS = 6_000;
/** How long "{name} is reconnecting…" shows before the call is ended (product decision 3). */
export const PEER_GRACE_MS = 30_000;

export const initialCallState: CallRoomState = {
  phase: "idle",
  connectedAt: null,
  self: { speaking: false, muted: false, quality: "unknown" },
  other: { presence: "waiting", everJoined: false, speaking: false, muted: false, quality: "unknown", identity: null },
  interpreter: { present: false, everJoined: false, speaking: false, unavailable: false },
  translating: null,
  hearingTranslation: null,
  soundBlocked: false,
  endReason: null,
  endError: null,
  error: null,
  inUseElsewhere: false,
};

const isOver = (state: CallRoomState) => state.phase === "ended";

/** Returns the same object when nothing changed, so React skips the render. */
export function callReducer(state: CallRoomState, action: CallAction): CallRoomState {
  if (isOver(state) && action.type !== "end-failed") return state;
  switch (action.type) {
    case "connect":
      // A rejoin keeps the call timer and what we know about the other person.
      return { ...initialCallState, phase: "connecting", connectedAt: state.connectedAt, other: state.other, interpreter: { ...state.interpreter, present: false, speaking: false } };
    case "connected":
      return { ...state, phase: "live", connectedAt: state.connectedAt ?? action.at, error: null, inUseElsewhere: false };
    case "connect-failed":
      return { ...state, phase: "failed", error: action.message };
    case "reconnecting":
      return state.phase === "reconnecting" ? state : { ...state, phase: "reconnecting" };
    case "reconnected":
      return state.phase === "reconnecting" ? { ...state, phase: "live" } : state;
    case "disconnected":
      return {
        ...state,
        phase: "disconnected",
        error: action.message,
        inUseElsewhere: Boolean(action.inUseElsewhere),
        self: { ...state.self, speaking: false },
        other: { ...state.other, speaking: false },
        interpreter: { ...state.interpreter, present: false, speaking: false },
        translating: null,
        hearingTranslation: null,
      };
    case "participant-joined":
      if (action.seat === "interpreter") {
        if (state.interpreter.present) return state;
        return { ...state, interpreter: { ...state.interpreter, present: true, everJoined: true, unavailable: false } };
      }
      if (action.seat !== "other") return state;
      return {
        ...state,
        other: { ...state.other, presence: "present", everJoined: true, identity: action.identity, muted: Boolean(action.muted) },
      };
    case "participant-left":
      if (action.seat === "interpreter") {
        return { ...state, interpreter: { ...state.interpreter, present: false, speaking: false }, translating: null };
      }
      if (action.seat !== "other") return state;
      // Product decision 3: show "Reconnecting…" first; the hook ends the call after PEER_GRACE_MS.
      return {
        ...state,
        other: { ...state.other, presence: state.other.everJoined ? "reconnecting" : "waiting", speaking: false },
        translating: state.translating?.toward === "self" ? null : state.translating,
      };
    case "peer-gone":
      return state.other.presence === "reconnecting" ? { ...state, other: { ...state.other, presence: "left" } } : state;
    case "speakers": {
      const { self, other, interpreter } = action;
      if (self === state.self.speaking && other === state.other.speaking && interpreter === state.interpreter.speaking) return state;
      let translating = state.translating;
      if (interpreter) translating = null;
      else if (state.self.speaking && !self && !other) translating = { toward: "other", since: action.at };
      else if (state.other.speaking && !other && !self) translating = { toward: "self", since: action.at };
      else if (self || other) translating = null;
      return {
        ...state,
        self: { ...state.self, speaking: self && !state.self.muted },
        other: { ...state.other, speaking: other },
        interpreter: { ...state.interpreter, speaking: interpreter },
        translating,
        // Each interpreter turn starts with no direction until our own track has been measured.
        hearingTranslation: interpreter && state.interpreter.speaking ? state.hearingTranslation : null,
      };
    }
    case "muted":
      if (action.seat === "self") {
        if (state.self.muted === action.muted) return state;
        return { ...state, self: { ...state.self, muted: action.muted, speaking: action.muted ? false : state.self.speaking } };
      }
      if (state.other.muted === action.muted) return state;
      return { ...state, other: { ...state.other, muted: action.muted, speaking: action.muted ? false : state.other.speaking } };
    case "quality":
      if (state[action.seat].quality === action.quality) return state;
      return { ...state, [action.seat]: { ...state[action.seat], quality: action.quality } };
    case "sound-blocked":
      return state.soundBlocked === action.blocked ? state : { ...state, soundBlocked: action.blocked };
    case "hearing":
      return state.hearingTranslation === action.hearing ? state : { ...state, hearingTranslation: action.hearing };
    case "translation-pending":
      if (state.interpreter.speaking) return state;
      if (state.translating && state.translating.toward === action.toward) return state;
      return { ...state, translating: { toward: action.toward, since: action.at } };
    case "translating-timeout":
      return state.translating && state.translating.since === action.since ? { ...state, translating: null } : state;
    case "interpreter-unavailable":
      return state.interpreter.unavailable === action.unavailable ? state : { ...state, interpreter: { ...state.interpreter, unavailable: action.unavailable } };
    case "ending":
      return { ...state, phase: "ending", endError: null };
    case "ended":
      return {
        ...state,
        phase: "ended",
        endReason: action.reason,
        endError: null,
        self: { ...state.self, speaking: false },
        other: { ...state.other, speaking: false },
        interpreter: { ...state.interpreter, speaking: false },
        translating: null,
        soundBlocked: false,
      };
    case "end-failed":
      return { ...state, phase: "disconnected", endError: action.message };
    default:
      return state;
  }
}

// ----- Derived view state -----

export type PersonState = "joining" | "waiting" | "listening" | "speaking" | "muted" | "hearing" | "reconnecting" | "left";

export function personState(state: CallRoomState, seat: Seat): PersonState {
  const hearing = state.interpreter.speaking && state.hearingTranslation !== null;
  if (seat === "self") {
    if (state.phase === "idle" || state.phase === "connecting") return "joining";
    if (state.phase === "reconnecting") return "reconnecting";
    if (state.phase === "ended" || state.phase === "disconnected" || state.phase === "failed") return "left";
    if (state.self.muted) return "muted";
    if (state.self.speaking) return "speaking";
    if (hearing && state.hearingTranslation === true) return "hearing";
    return "listening";
  }
  const other = state.other;
  if (other.presence === "waiting") return "waiting";
  if (other.presence === "left" || state.phase === "ended") return "left";
  if (other.presence === "reconnecting") return "reconnecting";
  if (other.muted) return "muted";
  if (other.speaking) return "speaking";
  if (hearing && state.hearingTranslation === false) return "hearing";
  return "listening";
}

export const PERSON_STATE_WORDS: Record<PersonState, string> = {
  joining: "Joining…",
  waiting: "Not joined yet",
  listening: "Listening",
  speaking: "Speaking",
  muted: "Muted",
  hearing: "Hearing translation",
  reconnecting: "Reconnecting…",
  left: "Left the call",
};

export type BridgeMode = "starting" | "ready" | "translating" | "speaking" | "reconnecting" | "unavailable" | "off";

export function bridgeState(state: CallRoomState): { mode: BridgeMode; toward: Seat | null } {
  if (state.phase === "ended") return { mode: "off", toward: null };
  const { interpreter } = state;
  if (!interpreter.present) {
    if (interpreter.unavailable) return { mode: "unavailable", toward: null };
    return { mode: interpreter.everJoined ? "reconnecting" : "starting", toward: null };
  }
  if (interpreter.speaking) {
    const toward = state.hearingTranslation === true ? "self" : state.hearingTranslation === false ? "other" : null;
    return { mode: "speaking", toward };
  }
  if (state.translating) return { mode: "translating", toward: state.translating.toward };
  return { mode: "ready", toward: null };
}

export type Names = { self: string; other: string; selfLanguage: string; otherLanguage: string };

/** The bridge's words. Direction is always in the words, not only in the arrow. */
export function bridgeLabel(mode: BridgeMode, toward: Seat | null, names: Names): string {
  switch (mode) {
    case "starting": return "Interpreter starting…";
    case "ready": return "Ready";
    case "reconnecting": return "Interpreter reconnecting…";
    case "unavailable": return "Interpreter isn’t responding";
    case "off": return "Call ended";
    case "translating":
      return toward === "self" ? `Translating into ${names.selfLanguage}…` : `Translating into ${names.otherLanguage}…`;
    case "speaking":
      if (toward === "self") return `You’re hearing ${names.other} in ${names.selfLanguage}`;
      if (toward === "other") return `${names.other} is hearing you in ${names.otherLanguage}`;
      return "Interpreter speaking";
  }
}

export type StatusLine = { message: string; tone: "neutral" | "warning" | "danger" | "success" };

/**
 * The single status line (the page's only role="status"). One message at a time; the most blocking
 * wins: Ended > Sound blocked > Reconnecting > Connecting > Disconnected > Peer reconnecting >
 * Waiting > Interpreter unavailable > Network degraded > (empty).
 */
export function statusLine(state: CallRoomState, names: Pick<Names, "other">): StatusLine {
  const other = names.other;
  if (state.phase === "ended") {
    const message = state.endReason === "other"
      ? `${other} ended the call.`
      : state.endReason === "peer-lost"
        ? `${other} didn’t come back. Call ended.`
        : "Call ended.";
    return { message, tone: "neutral" };
  }
  if (state.endError) return { message: "Couldn’t end the call. Try again.", tone: "danger" };
  if (state.phase === "ending") return { message: "Ending the call…", tone: "neutral" };
  if (state.soundBlocked) return { message: "Sound is blocked. Turn on sound to hear the translation.", tone: "danger" };
  if (state.phase === "reconnecting") return { message: "Reconnecting…", tone: "warning" };
  if (state.phase === "connecting" || state.phase === "idle") return { message: "Connecting to the call…", tone: "neutral" };
  if (state.phase === "failed") return { message: state.error ?? "Couldn’t join the call.", tone: "danger" };
  if (state.phase === "disconnected") {
    return { message: state.inUseElsewhere ? "This invite is in use on another device." : "You were disconnected.", tone: "danger" };
  }
  if (state.other.presence === "reconnecting") return { message: `${other} lost connection. Reconnecting…`, tone: "warning" };
  if (state.other.presence === "left") return { message: `${other} left the call.`, tone: "warning" };
  if (state.other.presence === "waiting") return { message: `Waiting for ${other} to join.`, tone: "neutral" };
  if (state.interpreter.unavailable && !state.interpreter.present) return { message: "The interpreter isn’t responding.", tone: "danger" };
  if (state.self.quality === "poor" || state.self.quality === "lost") return { message: "Your connection is weak; translation may lag.", tone: "warning" };
  return { message: "", tone: "neutral" };
}

/** Header connection word (UX spec §3.11). */
export function connectionWord(state: CallRoomState): { word: string; bars: 0 | 1 | 2 | 3; tone: "success" | "warning" | "danger" | "neutral" } {
  if (state.phase === "reconnecting") return { word: "Reconnecting…", bars: 0, tone: "warning" };
  if (state.phase === "connecting" || state.phase === "idle") return { word: "Connecting…", bars: 0, tone: "neutral" };
  if (state.phase !== "live" && state.phase !== "ending") return { word: "Offline", bars: 0, tone: "danger" };
  switch (state.self.quality) {
    case "poor": return { word: "Weak connection", bars: 1, tone: "warning" };
    case "lost": return { word: "Connection lost", bars: 0, tone: "danger" };
    case "excellent":
    case "good":
    case "unknown":
    default: return { word: "Good connection", bars: 3, tone: "success" };
  }
}

/** LiveKit identities (backend main.py / runtime pipeline.py): Runtime joins as `voice-labs-agent-<room>`. */
export function classifyParticipant(participant: { identity: string; isAgent?: boolean; isLocal?: boolean }): Seat | "interpreter" {
  if (participant.isLocal) return "self";
  if (participant.isAgent || participant.identity.startsWith("voice-labs-agent-")) return "interpreter";
  return "other";
}

export function normalizeQuality(value: unknown): Quality {
  return value === "excellent" || value === "good" || value === "poor" || value === "lost" ? value : "unknown";
}
