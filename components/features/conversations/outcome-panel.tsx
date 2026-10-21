"use client";

import { useState, type FormEvent } from "react";
import { Badge, Notice, SoonNote, formatDate } from "@/components/features/workspace/ui";
import { channelLabel, handoffOf, OUTCOMES, outcomeInfo, outcomeLabel, outcomeTone } from "@/lib/outcomes";
import { describeError } from "@/lib/platform-errors";
import { setConversationOutcome, type Conversation } from "@/lib/platform";

const actionText = (action: { type?: string; [key: string]: unknown }) => {
  const { type, ...rest } = action;
  const detail = Object.entries(rest).filter(([, value]) => value !== null && value !== undefined && typeof value !== "object").map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`).join(" · ");
  return [String(type ?? "action").replaceAll("_", " "), detail].filter(Boolean).join(" — ");
};

/** How the call ended: outcome, summary, intent and actions, the handoff if there was one, and a way to set it. */
export function OutcomePanel({ conversation, onSaved }: Readonly<{ conversation: Conversation; onSaved: (next: Conversation) => void }>) {
  const handoff = handoffOf(conversation);
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState(conversation.outcome ?? "resolved");
  const [summary, setSummary] = useState(conversation.summary ?? "");
  const [intent, setIntent] = useState(conversation.intent ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actions = conversation.actions ?? [];

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSaved(await setConversationOutcome(conversation.id, { outcome, summary: summary.trim() || null, intent: intent.trim() || null }));
      setEditing(false);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel convo-panel outcome-panel" aria-label="Call outcome">
    <div className="ws-section-head">
      <h2>Outcome</h2>
      <Badge tone={outcomeTone(conversation.outcome)}>{outcomeLabel(conversation.outcome)}</Badge>
    </div>
    {handoff && <div className="handoff">
      <strong>Escalated to a person</strong>
      <small>{handoff.reason ? `Reason: ${handoff.reason}` : "No reason was recorded."}{handoff.target ? ` · Target: ${handoff.target}` : ""}</small>
      <SoonNote capability="liveTransfer" />
    </div>}
    <dl>
      <dt>Channel</dt><dd>{channelLabel(conversation.channel)}</dd>
      <dt>Summary</dt><dd>{conversation.summary || <span className="muted">None recorded</span>}</dd>
      <dt>Intent</dt><dd>{conversation.intent || <span className="muted">None recorded</span>}</dd>
      {actions.length > 0 && <><dt>Actions</dt><dd>{actions.map((action, index) => <div key={index}>{actionText(action)}</div>)}</dd></>}
      {conversation.outcome_recorded_at && <><dt>Recorded</dt><dd>{formatDate(conversation.outcome_recorded_at)}</dd></>}
    </dl>
    {!editing ? <div><button data-bare className="mini-action" type="button" onClick={() => setEditing(true)}>{conversation.outcome ? "Change outcome" : "Set outcome"}</button></div> : (
      <form className="outcome-form" onSubmit={save}>
        <label>Outcome
          <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
            {OUTCOMES.map((value) => <option key={value} value={value}>{outcomeInfo[value].label}</option>)}
          </select>
        </label>
        <label>Summary (optional)<textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
        <label>Intent (optional)<input value={intent} maxLength={200} onChange={(event) => setIntent(event.target.value)} placeholder="e.g. book_consultation" /></label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="ws-actions"><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save outcome"}</button><button data-bare className="mini-action" type="button" onClick={() => setEditing(false)}>Cancel</button></div>
      </form>
    )}
  </section>;
}
