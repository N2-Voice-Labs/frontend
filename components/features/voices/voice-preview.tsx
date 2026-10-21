"use client";

import { useRef, useState } from "react";
import { isEnabled } from "@/lib/capabilities";
import { describeError } from "@/lib/platform-errors";
import { previewVoice } from "@/lib/voices";
import { Soon } from "@/components/features/workspace/ui";

/** Type a line, hear the voice. Disabled and labelled "Coming soon" until the Runtime ships preview. */
export function VoicePreview({ voiceId, disabled }: Readonly<{ voiceId: string; disabled?: boolean }>) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("Hello! How can I help you today?");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);

  if (!isEnabled("voicePreview")) {
    return <span className="ws-actions"><button data-bare className="mini-action" type="button" disabled aria-disabled="true">Preview voice</button><Soon capability="voicePreview" /></span>;
  }

  async function play() {
    setBusy(true);
    setError("");
    try {
      const blob = await previewVoice(voiceId, text.trim());
      const url = URL.createObjectURL(blob);
      if (audio.current) {
        audio.current.src = url;
        audio.current.onended = () => URL.revokeObjectURL(url);
        await audio.current.play();
      }
    } catch (cause) {
      setError(describeError(cause, "Could not play the preview."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button data-bare className="mini-action" type="button" disabled={disabled} onClick={() => setOpen(true)}>Preview voice</button>;
  return <div className="ws-voice-pick">
    <label>Line to speak<textarea rows={2} maxLength={200} value={text} onChange={(event) => setText(event.target.value)} /></label>
    <div className="ws-actions">
      <button data-bare className="mini-action primary" type="button" disabled={busy || !text.trim()} onClick={() => void play()}>{busy ? "Generating…" : "Play"}</button>
      <button data-bare className="mini-action" type="button" onClick={() => setOpen(false)}>Close</button>
    </div>
    {error && <p className="field-hint" role="status">{error}</p>}
    <audio ref={audio} />
  </div>;
}
