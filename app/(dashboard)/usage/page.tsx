"use client";

import { useCallback, useState } from "react";
import { Empty, Notice, PageHead, SoonNote } from "@/components/features/workspace/ui";
import { getAnalytics, ranked } from "@/lib/analytics";
import { latencyStages } from "@/lib/latency";
import { languageName } from "@/lib/languages";
import { channelLabel, outcomeLabel, outcomeTone } from "@/lib/outcomes";
import { getAgents } from "@/lib/platform";
import { useResource } from "@/lib/use-resource";

const periods = [
  { id: "all", label: "All time", days: 0 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "7", label: "Last 7 days", days: 7 },
];

function Bars({ data, label, tone }: Readonly<{ data: Record<string, number>; label: (key: string) => string; tone?: (key: string) => string }>) {
  const rows = ranked(data);
  const max = Math.max(1, ...rows.map(([, count]) => count));
  if (rows.length === 0) return <p className="muted">Nothing recorded yet.</p>;
  return <ul className="bars">{rows.map(([key, count]) => <li key={key} data-tone={tone?.(key)}>
    <span title={label(key)}>{label(key)}</span><i style={{ "--v": `${(count / max) * 100}%` } as React.CSSProperties} /><b>{count}</b>
  </li>)}</ul>;
}

export default function Analytics() {
  const [agentId, setAgentId] = useState("");
  const [period, setPeriod] = useState("all");
  const days = periods.find((item) => item.id === period)?.days ?? 0;
  const load = useCallback(() => getAnalytics({ agent_id: agentId || undefined, since: days ? new Date(Date.now() - days * 86400000).toISOString() : undefined }), [agentId, days]);
  const summary = useResource(load);
  const agents = useResource(getAgents);
  const data = summary.data;
  const hasLatency = data ? Object.keys(data.latency).length > 0 : false;

  return <main className="page-shell dash-main">
    <PageHead eyebrow="Workspace / Analytics" title="Analytics" intro="How calls end, where they come from, and which languages people speak." />
    <div className="ws-toolbar">
      <label className="sr-only" htmlFor="analytics-agent">Agent</label>
      <select id="analytics-agent" value={agentId} onChange={(event) => setAgentId(event.target.value)} style={{ width: "auto" }}>
        <option value="">All agents</option>
        {(agents.data ?? []).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
      </select>
      <div role="group" aria-label="Period" className="ws-toolbar" style={{ margin: 0 }}>
        {periods.map((item) => <button key={item.id} className={period === item.id ? "chip is-active" : "chip"} data-bare type="button" aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}
      </div>
    </div>
    {summary.error && <Notice tone="error">Could not load analytics: {summary.error}</Notice>}
    {summary.loading && <p role="status">Loading analytics…</p>}
    {data && (data.conversations.total === 0 ? <Empty title="No conversations in this period">Talk to an agent in the Voice Playground to see numbers here.</Empty> : <>
      <div className="ws-stats">
        <div><strong>{data.conversations.total}</strong><span>conversations</span></div>
        <div><strong>{data.conversations.by_status.active ?? 0}</strong><span>active now</span></div>
        <div><strong>{data.conversations.by_outcome.booked ?? 0}</strong><span>booked</span></div>
        <div><strong>{data.conversations.by_outcome.escalated ?? 0}</strong><span>escalated</span></div>
      </div>
      <div className="ws-split">
        <section className="panel ws-card" aria-label="Calls by outcome"><h2>By outcome</h2><Bars data={data.conversations.by_outcome} label={(key) => (key === "unknown" ? "Not recorded" : outcomeLabel(key))} tone={(key) => outcomeTone(key)} /></section>
        <section className="panel ws-card" aria-label="Calls by channel"><h2>By channel</h2><Bars data={data.conversations.by_channel} label={(key) => channelLabel(key)} /></section>
        <section className="panel ws-card" aria-label="Messages by language"><h2>By language</h2><Bars data={data.languages} label={(key) => (key === "unknown" ? "Not detected" : languageName(key))} /></section>
      </div>
      <section className="panel ws-card" style={{ marginTop: 16 }} aria-label="Latency">
        <h2>Latency</h2>
        {hasLatency ? <dl className="latency">{latencyStages.map((stage) => {
          const stats = data.latency[stage.key];
          return <div key={stage.key}><dt>{stage.label}</dt><dd>{stats ? `${Math.round(stats.p50)} ms` : "—"}</dd><small>{stats ? `p95 ${Math.round(stats.p95)} ms · ${stats.count} samples` : "No samples"}</small></div>;
        })}</dl> : <SoonNote capability="liveLatency" />}
      </section>
    </>)}
  </main>;
}
