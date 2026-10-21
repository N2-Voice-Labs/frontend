"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { Badge, Notice, SoonNote, formatDate } from "@/components/features/workspace/ui";
import { campaignMoveLabel, campaignStatusInfo, fromLocalInput, toLocalInput } from "@/lib/campaign-view";
import { addTargets, EDITABLE, getCampaign, getTargets, parseTargets, setCampaignStatus, TARGETS_EDITABLE, TRANSITIONS, updateCampaign, type CampaignStatus } from "@/lib/campaigns";
import { E164 } from "@/lib/deployments";
import { describeError } from "@/lib/platform-errors";
import { useResource } from "@/lib/use-resource";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const campaign = useResource(useCallback(() => getCampaign(id), [id]), { interval: 8000 });
  const targets = useResource(useCallback(() => getTargets(id, { limit: 200 }), [id]), { interval: 8000 });
  const [numbers, setNumbers] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", start: "", end: "", zone: "UTC", attempts: 1 });

  const current = campaign.data;
  const info = current ? campaignStatusInfo[current.status] : null;

  async function move(status: CampaignStatus) {
    if (status === "cancelled" && !window.confirm("Cancel this campaign? It cannot be restarted.")) return;
    setError(""); setMessage("");
    try {
      campaign.setData(await setCampaignStatus(id, status));
    } catch (cause) {
      setError(describeError(cause));
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const { targets: parsed, invalid } = parseTargets(numbers, (phone) => E164.test(phone));
    if (invalid.length) return setError(`These lines are not valid numbers (use +14155550123, name): ${invalid.slice(0, 3).join(" | ")}${invalid.length > 3 ? " …" : ""}`);
    if (parsed.length === 0) return setError("Paste at least one phone number, one per line.");
    if (parsed.length > 1000) return setError("Add up to 1,000 numbers at a time.");
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await addTargets(id, parsed);
      setMessage(`Added ${result.added}${result.skipped_duplicates ? `, skipped ${result.skipped_duplicates} already on the list` : ""}.`);
      setNumbers("");
      await Promise.all([targets.reload(), campaign.reload()]);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    if (!current) return;
    setDraft({ name: current.name, start: toLocalInput(current.schedule_start), end: toLocalInput(current.schedule_end), zone: current.timezone, attempts: current.max_attempts });
    setEditing(true);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (draft.start && draft.end && new Date(draft.end) <= new Date(draft.start)) return setError("The end must be after the start.");
    setBusy(true); setError("");
    try {
      campaign.setData(await updateCampaign(id, { name: draft.name.trim(), schedule_start: fromLocalInput(draft.start), schedule_end: fromLocalInput(draft.end), timezone: draft.zone.trim() || "UTC", max_attempts: draft.attempts }));
      setEditing(false);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-shell dash-main">
    <Link className="dash-back" href="/campaigns">← Campaigns</Link>
    <p className="eyebrow">Campaigns / Detail</p>
    <h1>{current?.name ?? "Campaign"}</h1>
    {campaign.error && <Notice tone="error">Could not load this campaign: {campaign.error}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    {message && <p className="notice" role="status">{message}</p>}
    {campaign.loading && <p role="status">Loading campaign…</p>}

    {current && info && <>
      <section className="panel ws-card" aria-label="Campaign status">
        <div className="ws-card-top"><Badge tone={info.tone}>{info.label}</Badge>
          <div className="ws-actions">
            {TRANSITIONS[current.status].map((status) => <button data-bare key={status} className={status === "running" || status === "scheduled" ? "mini-action primary" : "mini-action"} type="button" onClick={() => void move(status)}>{campaignMoveLabel[status]}</button>)}
          </div>
        </div>
        <ul className="ws-meta">
          <li>Starts: <b>{formatDate(current.schedule_start)}</b></li>
          <li>Ends: <b>{formatDate(current.schedule_end)}</b></li>
          <li>Timezone: <b>{current.timezone}</b></li>
          <li>Attempts: <b>{current.max_attempts}</b></li>
          <li>Numbers: <b>{Object.values(current.target_counts).reduce((sum, count) => sum + count, 0)}</b>{Object.entries(current.target_counts).map(([status, count]) => ` · ${count} ${status}`).join("")}</li>
        </ul>
        {EDITABLE.includes(current.status) && !editing && <div><button data-bare className="mini-action" type="button" onClick={startEdit}>Edit schedule</button></div>}
        {editing && <form className="form-stack" onSubmit={saveEdit} noValidate>
          <label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <div className="ws-two">
            <label>Start<input type="datetime-local" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
            <label>End<input type="datetime-local" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
          </div>
          <div className="ws-two">
            <label>Timezone<input value={draft.zone} onChange={(event) => setDraft({ ...draft, zone: event.target.value })} /></label>
            <label>Attempts<input type="number" min={1} max={10} value={draft.attempts} onChange={(event) => setDraft({ ...draft, attempts: Math.min(10, Math.max(1, Number(event.target.value) || 1)) })} /></label>
          </div>
          <div className="ws-actions"><button type="submit" disabled={busy}>Save</button><button data-bare className="mini-action" type="button" onClick={() => setEditing(false)}>Cancel</button></div>
        </form>}
        <SoonNote capability="sipDialing" />
      </section>

      {TARGETS_EDITABLE.includes(current.status) && <section className="ws-section" aria-labelledby="add-numbers">
        <h2 id="add-numbers">Add phone numbers</h2>
        <form className="form-stack" onSubmit={add} noValidate>
          <label>One per line, optionally with a name
            <textarea rows={5} value={numbers} onChange={(event) => setNumbers(event.target.value)} placeholder={"+14155550123, Ada\n+442071838750"} spellCheck={false} />
            <span className="field-hint">International format. Numbers already on the list are skipped.</span>
          </label>
          <div><button type="submit" disabled={busy}>{busy ? "Adding…" : "Add numbers"}</button></div>
        </form>
      </section>}

      <section className="ws-section" aria-labelledby="numbers-title">
        <h2 id="numbers-title">Numbers</h2>
        {targets.error ? <Notice tone="error">Could not load numbers: {targets.error}</Notice>
          : !targets.data?.length ? <p className="muted">No numbers yet.</p>
          : <ul className="ws-list">{targets.data.map((target) => <li className="ws-row" key={target.id}>
            <div className="ws-row-main"><strong><code>{target.phone_number}</code></strong><small>{target.name || "No name"} · {target.attempts} {target.attempts === 1 ? "attempt" : "attempts"}</small></div>
            <div className="ws-row-side">{target.conversation_id && <Link className="mini-action" href={`/conversations/${target.conversation_id}`}>Conversation</Link>}<Badge>{target.status}</Badge></div>
          </li>)}</ul>}
      </section>
    </>}
  </main>;
}
