"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Notice } from "@/components/features/workspace/ui";
import { fromLocalInput } from "@/lib/campaign-view";
import { createCampaign, type CampaignDetail } from "@/lib/campaigns";
import { getDeployments } from "@/lib/deployments";
import { describeError } from "@/lib/platform-errors";
import { getAgents } from "@/lib/platform";
import { useResource } from "@/lib/use-resource";

/** A campaign belongs to one agent and one of its active phone (SIP) deployments. */
export function CampaignForm({ onCreated }: Readonly<{ onCreated: (campaign: CampaignDetail) => void }>) {
  const agents = useResource(getAgents);
  const [agentId, setAgentId] = useState("");
  const loadLines = useCallback(() => (agentId ? getDeployments({ agent_id: agentId, channel: "sip", status: "active" }) : Promise.resolve([])), [agentId]);
  const lines = useResource(loadLines);
  const [deploymentId, setDeploymentId] = useState("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [zone, setZone] = useState("UTC");
  const [attempts, setAttempts] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); }, []);
  useEffect(() => { setDeploymentId(lines.data?.[0]?.id ?? ""); }, [lines.data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the campaign a name.");
    if (!agentId) return setError("Choose an agent.");
    if (!deploymentId) return setError("Choose a phone line. The agent needs an active phone (SIP) deployment.");
    if (start && end && new Date(end) <= new Date(start)) return setError("The end must be after the start.");
    setBusy(true);
    setError("");
    try {
      onCreated(await createCampaign({ name: name.trim(), agent_id: agentId, deployment_id: deploymentId, schedule_start: fromLocalInput(start), schedule_end: fromLocalInput(end), timezone: zone.trim() || "UTC", max_attempts: attempts }));
    } catch (cause) {
      setError(describeError(cause));
      setBusy(false);
    }
  }

  const noLine = agentId && !lines.loading && (lines.data?.length ?? 0) === 0;
  return <form className="ws-form" onSubmit={submit} noValidate>
    <section className="form-section">
      <h2>Who calls</h2>
      <label>Campaign name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} placeholder="e.g. Appointment reminders" /></label>
      <label>Agent
        <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
          <option value="">Choose an agent</option>
          {(agents.data ?? []).filter((agent) => agent.status !== "disabled").map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </select>
      </label>
      <label>Phone line
        <select value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)} disabled={!agentId || !lines.data?.length}>
          {lines.data?.length ? lines.data.map((line) => <option key={line.id} value={line.id}>{line.name} · {line.phone_number}</option>) : <option value="">{agentId ? "No active phone line" : "Choose an agent first"}</option>}
        </select>
      </label>
      {noLine && <Notice>This agent has no active phone (SIP) deployment. <Link href={`/agents/${agentId}`}>Add one on the agent’s page</Link>, then come back.</Notice>}
    </section>
    <section className="form-section">
      <h2>Schedule</h2>
      <div className="ws-two">
        <label>Start (your local time)<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label>End (your local time)<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
      <div className="ws-two">
        <label>Timezone<input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Europe/Berlin" /></label>
        <label>Attempts per number<input type="number" min={1} max={10} value={attempts} onChange={(event) => setAttempts(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} /></label>
      </div>
    </section>
    {error && <p className="notice" data-tone="error" role="alert">{error}</p>}
    <div className="ws-form-actions"><button type="submit" disabled={busy}>{busy ? "Creating…" : "Create campaign"}</button><span className="field-hint">You add the phone numbers next.</span></div>
  </form>;
}
