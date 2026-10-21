"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Badge, Notice, Soon } from "@/components/features/workspace/ui";
import type { Capability } from "@/lib/capabilities";
import { archiveDeployment, channelOrder, createDeployment, E164, getDeployments, updateDeployment, type Channel, type Deployment } from "@/lib/deployments";
import { describeError } from "@/lib/platform-errors";
import { useResource } from "@/lib/use-resource";

const channels: Record<Channel, { title: string; noun: string; blurb: string; defaultName: string; soon?: Capability }> = {
  web: { title: "Web", noun: "web deployment", blurb: "Talk to the agent in the browser: the Voice Playground and web embeds.", defaultName: "Website widget" },
  sip: { title: "Phone (SIP)", noun: "phone line", blurb: "A phone number callers can dial. Campaigns place outbound calls from it.", defaultName: "Phone line", soon: "sipDialing" },
  api: { title: "API", noun: "API access", blurb: "Start conversations from your own software.", defaultName: "API access", soon: "apiCalls" },
};

const tone = (status: Deployment["status"]) => (status === "active" ? "good" : status === "paused" ? "warn" : "neutral");

/** Where an agent can be reached. Records are saved now; only the web channel takes calls today. */
export function DeploymentsPanel({ agentId }: Readonly<{ agentId: string }>) {
  const load = useCallback(() => getDeployments({ agent_id: agentId }), [agentId]);
  const deployments = useResource(load);
  const [adding, setAdding] = useState<Channel | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const live = (deployments.data ?? []).filter((item) => item.status !== "archived");

  function start(channel: Channel) {
    setAdding(channel);
    setName(channels[channel].defaultName);
    setPhone("");
    setError("");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!adding) return;
    if (!name.trim()) return setError("Give the deployment a name.");
    if (adding === "sip" && !E164.test(phone.trim())) return setError("Enter the number in international format, e.g. +14155550123.");
    setBusy(true);
    setError("");
    try {
      await createDeployment({ agent_id: agentId, name: name.trim(), channel: adding, phone_number: adding === "sip" ? phone.trim() : null });
      setAdding(null);
      await deployments.reload();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function change(item: Deployment, action: "pause" | "resume" | "archive") {
    setError("");
    try {
      if (action === "archive") await archiveDeployment(item.id);
      else await updateDeployment(item.id, { status: action === "pause" ? "paused" : "active" });
      await deployments.reload();
    } catch (cause) {
      setError(describeError(cause));
    }
  }

  return <section className="panel detail-panel detail-wide" aria-label="Deployments">
    <div className="ws-section-head"><h2>Deployments</h2></div>
    <p className="muted">One agent, one voice, several ways to reach it.</p>
    {deployments.error && <Notice tone="error">Could not load deployments: {deployments.error}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="deploy-grid">
      {channelOrder.map((channel) => {
        const info = channels[channel];
        const items = live.filter((item) => item.channel === channel);
        return <div className="deploy-card" key={channel} data-empty={items.length === 0}>
          <div className="ws-card-top"><h3>{info.title}</h3>{info.soon && <Soon capability={info.soon} />}</div>
          <p>{info.blurb}</p>
          {items.map((item) => <div className="ws-row" key={item.id} style={{ padding: "8px 0", border: 0 }}>
            <div className="ws-row-main"><strong>{item.name}</strong>{item.phone_number && <small><code>{item.phone_number}</code></small>}</div>
            <div className="ws-row-side">
              <Badge tone={tone(item.status)}>{item.status === "active" ? "Active" : "Paused"}</Badge>
              <button data-bare className="mini-action" type="button" onClick={() => void change(item, item.status === "active" ? "pause" : "resume")}>{item.status === "active" ? "Pause" : "Resume"}</button>
              <button data-bare className="mini-action" type="button" onClick={() => void change(item, "archive")}>Archive</button>
            </div>
          </div>)}
          {adding === channel ? <form className="form-stack" onSubmit={create} noValidate>
            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
            {channel === "sip" && <label>Phone number<input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="+14155550123" /></label>}
            <div className="ws-actions"><button type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</button><button data-bare className="mini-action" type="button" onClick={() => setAdding(null)}>Cancel</button></div>
          </form> : <button data-bare className="mini-action" type="button" onClick={() => start(channel)}>{items.length ? `Add another ${info.noun}` : `Add ${info.noun}`}</button>}
        </div>;
      })}
    </div>
  </section>;
}
