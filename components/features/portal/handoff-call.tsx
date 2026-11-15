"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Handoff } from "@/lib/portal";
import { CallEnded } from "@/components/features/call/call-ended";
import { CallScreen } from "@/components/features/call/call-screen";
import { useLiveCall } from "@/components/features/call/use-live-call";

const LIVEKIT_TTL_SECONDS = 600;

/**
 * The student's side after "Connect to Admissions Officer": the existing two-person translated call
 * (same screen as /call), with the officer as the other person. No invite panel; the officer joins from
 * the staff console. Either side ends it for both (`POST /calls/{id}/end`, inside useCallRoom).
 */
export function HandoffCall({ handoff, selfName, selfLanguage, staffLanguage, onDone }: {
  handoff: Handoff;
  selfName: string;
  selfLanguage: string;
  staffLanguage: string;
  onDone: () => void;
}) {
  const officer = "Admissions officer";
  const live = useLiveCall({
    selfLanguage,
    otherLanguage: staffLanguage,
    otherName: officer,
    conversationId: handoff.conversation_id,
    sessionId: handoff.session_id,
    sessionToken: handoff.session_token ?? null,
  });
  const { room } = live;
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    room.primeAudio();
    const issuedAt = Math.floor(Date.now() / 1000);
    void room.connect({
      url: handoff.connection.url,
      token: handoff.connection.token,
      listen: handoff.connection.listen,
      sessionId: handoff.session_id,
      sessionToken: handoff.session_token,
      tokenExpiresAt: issuedAt + LIVEKIT_TTL_SECONDS,
    }).then((ok) => !ok && !room.wasEnded() && setFailed(true));
  }, [room, handoff]);

  const state = room.state;
  const muted = state.self.muted;
  const { setMuted, end, startAudio, rejoin, switchDevice } = room;
  const toggleMute = useCallback(() => void setMuted(!muted), [setMuted, muted]);
  const onEnd = useCallback(() => void end(), [end]);
  const onStartAudio = useCallback(() => void startAudio(), [startAudio]);
  const onRejoin = useCallback(() => void rejoin(), [rejoin]);
  const onSwitch = useCallback((kind: "audioinput" | "audiooutput", id: string) => void switchDevice(kind, id), [switchDevice]);

  const self = { name: selfName || "You", language: selfLanguage };
  const other = { name: officer, language: staffLanguage };

  if (failed) {
    return (
      <div className="portal-handoff-note" role="alert">
        <p><strong>The call to an officer couldn&apos;t connect.</strong> Check your connection and try again, or use the chat.</p>
        <button type="button" className="portal-btn" onClick={onDone}>Back to the assistant</button>
      </div>
    );
  }

  if (state.phase === "ended") {
    return (
      <div className="call-setup-page portal-call-ended">
        <CallEnded state={state} self={self} other={other} turns={live.turns} endedAt={live.endedAt ?? Date.now()} conversationId={handoff.conversation_id} onStartAnother={onDone} />
      </div>
    );
  }

  return (
    <CallScreen
      role="creator"
      state={state}
      levels={room.levels}
      self={self}
      other={other}
      turns={live.turns}
      transcriptError={live.conversation.transcriptError}
      onToggleMute={toggleMute}
      onEnd={onEnd}
      onStartAudio={onStartAudio}
      onRejoin={onRejoin}
      canRejoin={room.canRejoin()}
      onSwitchDevice={onSwitch}
      onVolume={room.setVolume}
      statusExtra={state.other.everJoined ? undefined : "Waiting for an admissions officer to pick up. You'll each hear the other in your own language."}
    />
  );
}
