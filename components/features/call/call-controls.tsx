"use client";

import type { KeyboardEvent } from "react";
import { Icon } from "./icons";

/**
 * The control dock (design system §3.15). One toolbar in the DOM for every size: on phones CSS keeps
 * only three slots (More · Mic · End) and moves the rest into the More sheet, so screen readers and
 * tests see one set of controls. Arrow keys move between buttons (roving focus). End call has no
 * single-key shortcut and sits apart from the toggles.
 */
export function CallControls({
  muted,
  micBusy,
  onToggleMute,
  onMore,
  onEnd,
  onTranscript,
  transcriptOpen,
  onDetails,
  onInvite,
  showInvite,
  endLabel = "End call",
  endBusy = false,
  shortcuts = true,
}: {
  muted: boolean;
  micBusy?: boolean;
  onToggleMute: () => void;
  onMore: () => void;
  onEnd: () => void;
  onTranscript?: () => void;
  transcriptOpen?: boolean;
  onDetails?: () => void;
  onInvite?: () => void;
  showInvite?: boolean;
  endLabel?: string;
  endBusy?: boolean;
  /** Whether single-key shortcuts are on (keeps aria-keyshortcuts honest). */
  shortcuts?: boolean;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")].filter((button) => button.offsetParent !== null || !button.closest("[data-hide-s]"));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div className="call-dock" role="toolbar" aria-label="Call controls" onKeyDown={onKeyDown}>
      <div className="dock-group">
        <button
          type="button"
          className="dock-btn dock-mic"
          aria-pressed={muted}
          aria-keyshortcuts={shortcuts ? "M" : undefined}
          aria-label="Mute"
          disabled={micBusy}
          onClick={onToggleMute}
        >
          {/* Toggle model: a fixed name "Mute" + aria-pressed. The visible word may change. */}
          <Icon name={muted ? "mic-off" : "mic"} />
          <span className="dock-label" aria-hidden="true">{micBusy ? "Connecting" : muted ? "Unmute" : "Mute"}</span>
        </button>
        {showInvite && onInvite && (
          <button type="button" className="dock-btn" data-hide-s="true" onClick={onInvite}>
            <Icon name="link" />
            <span className="dock-label">Invite</span>
          </button>
        )}
        {onTranscript && (
          <button type="button" className="dock-btn" data-hide-s="true" data-show-m="true" data-transcript-toggle="true" aria-pressed={transcriptOpen} aria-keyshortcuts={shortcuts ? "T" : undefined} onClick={onTranscript}>
            <Icon name="transcript" />
            <span className="dock-label">Transcript</span>
          </button>
        )}
        {onDetails && (
          <button type="button" className="dock-btn" data-hide-s="true" aria-keyshortcuts={shortcuts ? "D" : undefined} onClick={onDetails}>
            <Icon name="details" />
            <span className="dock-label">Details</span>
          </button>
        )}
        <button type="button" className="dock-btn dock-more" onClick={onMore} aria-haspopup="dialog">
          <Icon name="more" />
          <span className="dock-label">More</span>
        </button>
      </div>
      <button type="button" className="dock-btn dock-end" onClick={onEnd} disabled={endBusy} aria-busy={endBusy || undefined}>
        <Icon name="end" />
        <span className="dock-label">{endLabel}</span>
      </button>
    </div>
  );
}
