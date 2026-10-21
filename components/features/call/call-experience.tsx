"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { resolveInterpreter, PACE_OPTIONS, type TranslationPace } from "@/lib/interpreter";
import { interpreterDirection, interpreterLanguages, isInterpreterLanguage, languageName } from "@/lib/languages";
import { createVoiceSession, endVoiceSession, type VoiceSession } from "@/lib/platform";
import { describeError, errorCode } from "@/lib/platform-errors";
import { getVoices, type Voice } from "@/lib/voices";
import { CallEnded } from "./call-ended";
import { CallNav } from "./call-nav";
import { CallScreen } from "./call-screen";
import { ErrorState, LoadingState } from "./call-states";
import { Icon } from "./icons";
import { InvitePanel, type InviteLink } from "./invite-panel";
import { LanguageName, LanguageSelect } from "./language-select";
import { MicCheck, useMicCheck } from "./mic-check";
import { StatusLine } from "./status-indicator";
import { preloadLiveKit } from "./use-call-room";
import { useLiveCall } from "./use-live-call";

const PREFS_KEY = "vl-call-prefs";
const START_STEPS = ["Preparing interpreter…", "Connecting audio…", "Starting interpreter…"];
const LIVEKIT_TTL_SECONDS = 600;

type Prefs = { mine: string; theirs: string; name: string; pace: TranslationPace; hearOriginal: boolean };

function readPrefs(): Prefs {
  const browser = typeof navigator !== "undefined" ? navigator.language?.slice(0, 2).toLowerCase() : "en";
  const mine = browser && isInterpreterLanguage(browser) ? browser : "en";
  const fallback: Prefs = { mine, theirs: mine === "en" ? "ko" : "en", name: "", pace: "balanced", hearOriginal: false };
  try {
    const stored = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
    if (!stored) return fallback;
    const merged = { ...fallback, ...stored };
    if (!isInterpreterLanguage(merged.mine)) merged.mine = fallback.mine;
    if (!isInterpreterLanguage(merged.theirs) || merged.theirs === merged.mine) merged.theirs = merged.mine === "en" ? "ko" : "en";
    if (!PACE_OPTIONS.some((option) => option.id === merged.pace)) merged.pace = "balanced";
    return merged;
  } catch {
    return fallback;
  }
}

function storePrefs(prefs: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode: defaults next time.
  }
}

type StartError = { title: string; message: string; code: string | null; retryWithoutVoice?: boolean; suggestBalanced?: boolean };

/** Plain-language start errors (UX spec §4.1 [E]); the raw code goes into Technical details. */
function startError(cause: unknown, pace: TranslationPace): StartError {
  const code = errorCode(cause);
  if (code === "invalid_interpreter_config" || code === "participants_require_cascaded_interpreter" || code === "invalid_participant_language") {
    return { title: "This language pair can’t be interpreted with the current settings", message: pace === "instant" ? "Try the Balanced pace." : "Try a different pair or pace.", code, suggestBalanced: pace === "instant" };
  }
  if (code === "selected_voice_unavailable") return { title: "That voice isn’t ready", message: "Start the call with the interpreter’s voice instead.", code, retryWithoutVoice: true };
  if (code === "runtime_unavailable" || code === "runtime_auth_not_configured") return { title: "The interpreter isn’t responding", message: "Try again in a moment.", code };
  if (cause instanceof Error && (cause.message.startsWith("Failed to fetch") || cause.message === "fetch failed")) {
    return { title: "Can’t reach Voice Labs right now", message: "Check your connection and try again.", code: cause.message };
  }
  return { title: "The call couldn’t start", message: describeError(cause), code: code ?? (cause instanceof Error ? cause.message : null) };
}

type Session = VoiceSession & { agentId: string; agentName: string; createdInterpreter: boolean; issuedAt: number };

/** /call: setup → live → ended, as one client state machine (UX spec §2.2: no reloadable /call/[id]). */
export function CallExperience() {
  const formId = useId();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [step, setStep] = useState<number | null>(null);
  const [error, setError] = useState<StartError | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [otherName, setOtherName] = useState("");
  const [invite, setInvite] = useState<InviteLink | null>(null);
  const [announce, setAnnounce] = useState("");
  const [inviteWarning, setInviteWarning] = useState<string | undefined>(undefined);
  const mountedRef = useRef(true);
  const mic = useMicCheck();

  useEffect(() => {
    mountedRef.current = true;
    setPrefs(readPrefs());
    let alive = true;
    getVoices({ status: "ready" }).then((list) => {
      if (alive) setVoices(list.filter((voice) => voice.status === "ready"));
    }).catch(() => undefined);
    return () => {
      alive = false;
      mountedRef.current = false;
    };
  }, []);

  const mine = prefs?.mine ?? "en";
  const theirs = prefs?.theirs ?? "ko";
  const displayOther = otherName.trim() || "Guest";
  const selfName = prefs?.name.trim() || "You";

  const live = useLiveCall({
    selfLanguage: mine,
    otherLanguage: theirs,
    otherName: displayOther,
    conversationId: session?.conversation_id ?? null,
    sessionId: session?.session_id ?? null,
    sessionToken: session?.session_token ?? null,
  });
  const { room } = live;

  const update = (patch: Partial<Prefs>) => setPrefs((current) => (current ? { ...current, ...patch } : current));

  function swap() {
    if (!prefs) return;
    update({ mine: prefs.theirs, theirs: prefs.mine });
    setAnnounce(`Now: you speak ${languageName(prefs.theirs)}, they speak ${languageName(prefs.mine)}.`);
  }

  const start = useCallback(async (options: { withoutVoice?: boolean; pace?: TranslationPace } = {}) => {
    if (!prefs) return;
    // Synchronously inside the click: the only reliable way to get a running AudioContext on iOS.
    room.primeAudio();
    const settings = { ...prefs, pace: options.pace ?? prefs.pace };
    if (options.pace) setPrefs(settings);
    storePrefs(settings);
    setError(null);
    setStep(0);
    let created: VoiceSession | null = null;
    try {
      const { agent, created: createdInterpreter } = await resolveInterpreter({ mine: settings.mine, theirs: settings.theirs, pace: settings.pace, hearOriginal: settings.hearOriginal });
      if (!mountedRef.current) return;
      // Probe before session: the mic check already proved access; stop its tracks before LiveKit opens its own.
      const micDeviceId = mic.deviceId || undefined;
      mic.release();
      setStep(1);
      created = await createVoiceSession(agent.id, {
        language: settings.mine,
        display_name: settings.name.trim() || null,
        voice_profile_id: options.withoutVoice ? null : voiceId || null,
      });
      if (!mountedRef.current) {
        void endVoiceSession(created.session_id, created.session_token).catch(() => undefined);
        return;
      }
      if (!created.connection.url || !created.connection.token) {
        const partial = created;
        created = null;
        await endVoiceSession(partial.session_id, partial.session_token).catch(() => undefined);
        setStep(null);
        setError({ title: "Calls aren’t set up on this server yet", message: "Ask whoever runs Voice Labs to configure LiveKit.", code: "livekit_not_configured" });
        return;
      }
      const issuedAt = Math.floor(Date.now() / 1000);
      setSession({ ...created, agentId: agent.id, agentName: agent.name, createdInterpreter, issuedAt });
      setStep(2);
      const ok = await room.connect({
        url: created.connection.url,
        token: created.connection.token,
        sessionId: created.session_id,
        sessionToken: created.session_token,
        tokenExpiresAt: issuedAt + LIVEKIT_TTL_SECONDS,
        micDeviceId,
      });
      if (!mountedRef.current) {
        // Left the page while connecting: nobody else can be in this call yet, so end it.
        void endVoiceSession(created.session_id, created.session_token).catch(() => undefined);
        return;
      }
      setStep(null);
      if (!ok && room.wasEnded()) return; // End was pressed while connecting: not an error.
      if (!ok) {
        // Nobody else can be in this call yet, so ending it is safe.
        const partial = created;
        void endVoiceSession(partial.session_id, partial.session_token).catch(() => undefined);
        setSession(null);
        setError({ title: "Couldn’t connect the call audio", message: "Check your connection and try again.", code: "livekit_connect_failed" });
      }
    } catch (cause) {
      if (!mountedRef.current) return;
      setStep(null);
      setError(startError(cause, settings.pace));
      if (created) void endVoiceSession(created.session_id, created.session_token).catch(() => undefined);
    }
  }, [prefs, mic, voiceId, room]);

  function startAnother() {
    setSession(null);
    setInvite(null);
    setOtherName("");
    setStep(null);
    window.location.assign("/call");
  }

  async function endAndRestart() {
    await room.end();
    startAnother();
  }

  const state = room.state;
  // Stable handlers so the memoised dock and screen pieces are not re-rendered by every parent render.
  const muted = state.self.muted;
  const { setMuted, end: roomEnd, startAudio: roomStartAudio, rejoin: roomRejoin, switchDevice: roomSwitch } = room;
  const toggleMute = useCallback(() => void setMuted(!muted), [setMuted, muted]);
  const endCall = useCallback(() => void roomEnd(), [roomEnd]);
  const startAudio = useCallback(() => void roomStartAudio(), [roomStartAudio]);
  const rejoin = useCallback(() => void roomRejoin(), [roomRejoin]);
  const switchDevice = useCallback((kind: "audioinput" | "audiooutput", id: string) => void roomSwitch(kind, id), [roomSwitch]);
  const inCall = session !== null && state.phase !== "idle" && state.phase !== "failed";

  if (inCall && state.phase === "ended") {
    return (
      <div className="call-setup-page">
        <CallNav />
        <CallEnded
          state={state}
          self={{ name: selfName, language: mine }}
          other={{ name: displayOther, language: theirs }}
          turns={live.turns}
          endedAt={live.endedAt}
          conversationId={session.conversation_id}
          onStartAnother={startAnother}
        />
      </div>
    );
  }

  if (inCall) {
    return (
      <CallScreen
        role="creator"
        state={state}
        levels={room.levels}
        self={{ name: selfName, language: mine }}
        other={{ name: displayOther, language: theirs }}
        turns={live.turns}
        transcriptError={live.conversation.transcriptError}
        onToggleMute={toggleMute}
        onEnd={endCall}
        onStartAudio={startAudio}
        onRejoin={rejoin}
        canRejoin={room.canRejoin()}
        onSwitchDevice={switchDevice}
        onVolume={room.setVolume}
        statusExtra={inviteWarning}
        invite={
          <InvitePanel
            sessionId={session.session_id}
            conversationId={session.conversation_id}
            sessionToken={session.session_token}
            selfName={prefs?.name.trim() ?? ""}
            selfLanguage={mine}
            otherLanguage={theirs}
            otherName={otherName}
            onOtherNameChange={setOtherName}
            invite={invite}
            onInvite={setInvite}
            onExpiredRestart={() => void endAndRestart()}
            onMinuteLeft={setInviteWarning}
          />
        }
        technical={[
          { label: "Interpreter", value: `${session.agentName}${session.createdInterpreter ? " (created for this call)" : ""}` },
          { label: "Interpreter id", value: session.agentId },
          { label: "Engine · pace · direction", value: `cascaded · ${prefs?.pace ?? "balanced"} · ${interpreterDirection(mine, theirs)}` },
          { label: "Languages", value: `${mine} (you) / ${theirs} (them)` },
          { label: "Also hear their real voice", value: prefs?.hearOriginal ? "On" : "Off" },
          { label: "Session", value: session.session_id },
          { label: "Conversation", value: session.conversation_id },
          { label: "Room", value: session.room_name },
          { label: "Your identity", value: `browser-${session.session_id}` },
          { label: "Runtime", value: live.conversation.runtimeStatus || session.runtime_status },
        ]}
      />
    );
  }

  // ----- Setup -----
  const starting = step !== null;
  const canStart = Boolean(prefs) && mic.status === "ready" && mine !== theirs && !starting;
  return (
    <div className="call-setup-page">
      <CallNav />
      <main className="call-setup" id="main-content">
        <h1>Start a call</h1>
        <p className="call-lead">Pick your two languages. You speak naturally; each of you hears the other in your own language.</p>
        <form
          id={formId}
          className="call-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (canStart) void start();
            else if (!starting && mic.status !== "ready") document.getElementById(`${formId}-mic-check`)?.focus();
          }}
          aria-busy={starting || undefined}
        >
          <div className="lang-pair">
            <LanguageSelect id={`${formId}-mine`} label="I speak" value={mine} exclude={theirs} onChange={(value) => update({ mine: value })} />
            <button type="button" className="call-btn swap-btn" data-variant="ghost" data-icon="true" aria-label="Swap languages" onClick={swap} disabled={starting}>
              <Icon name="swap" />
            </button>
            <LanguageSelect id={`${formId}-theirs`} label="They speak" value={theirs} exclude={mine} onChange={(value) => update({ theirs: value })} />
          </div>
          <p className="call-hint">{interpreterLanguages.length} languages. They’ll see both names, like Korean · <span lang="ko">한국어</span>.</p>
          <div className="call-field">
            <label htmlFor={`${formId}-name`}>Your name <span className="call-optional">(optional)</span></label>
            <input id={`${formId}-name`} value={prefs?.name ?? ""} maxLength={100} autoComplete="given-name" aria-describedby={`${formId}-name-hint`} onChange={(event) => update({ name: event.target.value })} />
            <p className="call-hint" id={`${formId}-name-hint`}>Names you in their transcript.</p>
          </div>
          <MicCheck mic={mic} idPrefix={formId} onReady={preloadLiveKit} />
          <details className="call-options">
            <summary>Call options</summary>
            <div className="call-field">
              <label htmlFor={`${formId}-pace`}>Translation pace</label>
              <select id={`${formId}-pace`} value={prefs?.pace ?? "balanced"} onChange={(event) => update({ pace: event.target.value as TranslationPace })}>
                {PACE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.hint}</option>)}
              </select>
            </div>
            <label className="call-check">
              <input type="checkbox" checked={prefs?.hearOriginal ?? false} onChange={(event) => update({ hearOriginal: event.target.checked })} />
              Also hear their real voice
            </label>
            {voices.length > 0 && (
              <div className="call-field">
                <label htmlFor={`${formId}-voice`}>My translated voice</label>
                <select id={`${formId}-voice`} value={voiceId} onChange={(event) => setVoiceId(event.target.value)}>
                  <option value="">Interpreter’s default voice</option>
                  {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
                </select>
              </div>
            )}
          </details>
          {error && (
            <ErrorState
              id={`${formId}-error`}
              focusOnMount
              title={error.title}
              technical={error.code ?? undefined}
              action={
                error.retryWithoutVoice ? <button type="button" className="call-btn" data-variant="secondary" data-size="sm" onClick={() => void start({ withoutVoice: true })}>Use the interpreter’s voice</button>
                : error.suggestBalanced ? <button type="button" className="call-btn" data-variant="secondary" data-size="sm" onClick={() => void start({ pace: "balanced" })}>Try Balanced pace</button>
                : undefined
              }
            >
              {error.message}
            </ErrorState>
          )}
          <div className="call-submit">
            {/* The button stays mounted (focus never drops to <body>); aria-disabled keeps it in the
                Tab order so keyboard users meet the reason it is unavailable (audit S1, M6). */}
            <button
              type="submit"
              className="call-btn"
              data-variant="primary"
              data-size="lg"
              aria-disabled={!canStart || undefined}
              aria-describedby={[`${formId}-start-hint`, error ? `${formId}-error` : ""].filter(Boolean).join(" ")}
            >
              <Icon name="phone" /> Start call
            </button>
            {starting && <LoadingState label={START_STEPS[step ?? 0]} steps={START_STEPS} current={step ?? 0} />}
            <p className="call-hint" id={`${formId}-start-hint`}>
              {!starting && mic.status !== "ready" ? "Check your microphone first. " : ""}
              <LanguageName id={mine} /> ↔ <LanguageName id={theirs} />. You’ll get a link to send to the other person.
            </p>
          </div>
        </form>
        <StatusLine status={{ message: starting ? START_STEPS[step ?? 0] : announce, tone: "neutral" }} />
      </main>
    </div>
  );
}
