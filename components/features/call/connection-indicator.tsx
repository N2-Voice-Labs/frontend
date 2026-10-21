import { connectionWord, type CallRoomState } from "@/lib/call-state";

/**
 * Header connection state (design system §3.11): 3 bars + a word. The word stays in the accessible
 * name even where it is visually hidden (phones). Changes are announced by the status line, not here.
 */
export function ConnectionIndicator({ state }: { state: CallRoomState }) {
  const { word, bars, tone } = connectionWord(state);
  const spinning = state.phase === "reconnecting" || state.phase === "connecting";
  return (
    <span className="connection" data-tone={tone} data-bars={bars}>
      {spinning ? <span className="connection-ring" aria-hidden="true" /> : (
        <span className="connection-bars" aria-hidden="true"><i /><i /><i /></span>
      )}
      <span className="connection-word">{word}</span>
    </span>
  );
}
