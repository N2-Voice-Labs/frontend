"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { AgentOrb } from "@/components/features/agents/agent-orb";
import { Badge } from "@/components/features/workspace/ui";
import { channelLabel, outcomeLabel, outcomeTone } from "@/lib/outcomes";
import { agentHue, relativeTime } from "@/lib/agent-view";
import { getAgents, getConversations, type Conversation } from "@/lib/platform";

function duration(start: string, end: string | null) {
  if (!end) return null;
  const seconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
  if (!Number.isFinite(seconds)) return null;
  return seconds < 90 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  const refresh = useCallback(async () => {
    try {
      const current = await getConversations();
      setConversations(current.toSorted((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Platform API is unavailable.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  // Names only decorate the list; ids are the fallback if agents cannot be loaded.
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => getAgents()).then((agents) => {
      if (active) setAgentNames(Object.fromEntries(agents.map((agent) => [agent.id, agent.name])));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const now = Date.now();
  const outcomes = [...new Set(conversations.map((item) => item.outcome).filter((value): value is string => Boolean(value)))];
  const shown = outcomeFilter === "all" ? conversations : conversations.filter((item) => item.outcome === outcomeFilter);
  return (
    <main className="page-shell dash-main">
      <Link className="dash-back" href="/agents">← Agents</Link>
      <div className="dash-head">
        <div>
          <p className="eyebrow">History</p>
          <h1>Conversations</h1>
          <p className="page-intro">Review persisted transcripts and runtime lifecycle events.</p>
        </div>
      </div>
      {error && <p role="alert">Could not refresh conversations: {error}</p>}
      {outcomes.length > 0 && <div className="ws-toolbar" role="group" aria-label="Filter by outcome">
        <button className={outcomeFilter === "all" ? "chip is-active" : "chip"} data-bare type="button" aria-pressed={outcomeFilter === "all"} onClick={() => setOutcomeFilter("all")}>All outcomes</button>
        {outcomes.map((value) => <button key={value} className={outcomeFilter === value ? "chip is-active" : "chip"} data-bare type="button" aria-pressed={outcomeFilter === value} onClick={() => setOutcomeFilter(value)}>{outcomeLabel(value)} <b>{conversations.filter((item) => item.outcome === value).length}</b></button>)}
      </div>}
      {!loaded ? <p>Loading conversations…</p> : conversations.length === 0 && error ? null : conversations.length === 0 ? (
        <div className="dash-empty">
          <AgentOrb hue={20} size={64} />
          <h3>Nothing here yet</h3>
          <p>No conversations yet. Start one from an agent’s Voice Playground.</p>
        </div>
      ) : (
        <ul className="convo-list">
          {shown.map((conversation, index) => {
            const length = duration(conversation.started_at, conversation.ended_at);
            return (
              <li className="convo-row" key={conversation.id} style={{ "--i": Math.min(index, 12) } as CSSProperties}>
                <AgentOrb hue={agentHue(conversation.agent_id)} size={40} />
                <div className="convo-row-main">
                  <Link className="convo-row-link" href={`/conversations/${conversation.id}`}>Conversation {conversation.id.slice(0, 8)}</Link>
                  <span className="convo-row-meta">
                    <Link href={`/agents/${conversation.agent_id}`}>{agentNames[conversation.agent_id] ?? `Agent ${conversation.agent_id.slice(0, 8)}`}</Link>
                    <span title={new Date(conversation.started_at).toLocaleString()}> · Started {relativeTime(conversation.started_at, now)}</span>
                    {length && <span> · {length}</span>}
                  </span>
                </div>
                {conversation.outcome && <Badge tone={outcomeTone(conversation.outcome)}>{outcomeLabel(conversation.outcome)}</Badge>}
                {conversation.channel && conversation.channel !== "web" && <Badge>{channelLabel(conversation.channel)}</Badge>}
                <span className={`convo-status is-${conversation.status}`}>{conversation.status}</span>
              </li>
            );
          })}
        </ul>
      )}
      <button className="mini-action convo-refresh" data-bare type="button" onClick={() => void refresh()}>Refresh now</button>
    </main>
  );
}
