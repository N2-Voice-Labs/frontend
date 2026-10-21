"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { isLiveStatus, languageLabel, statusLabel, type AgentCardData } from "@/lib/agent-view";
import { AgentOrb } from "./agent-orb";

type Sort = "recent" | "name";

const providerLayers = [
  { key: "stt", label: "Speech" },
  { key: "llm", label: "Language" },
  { key: "tts", label: "Voice" },
] as const;

const languageNames: Record<string, string> = { en: "english", ru: "russian" };

function matches(agent: AgentCardData, query: string) {
  const languages = agent.languages.map((language) => `${language} ${languageNames[language] ?? ""}`).join(" ");
  const haystack = `${agent.name} ${agent.description} ${agent.status} ${languages}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

function byRecent(a: AgentCardData, b: AgentCardData) {
  if (a.lastActiveAt === b.lastActiveAt) return a.name.localeCompare(b.name);
  if (a.lastActiveAt === null) return 1;
  if (b.lastActiveAt === null) return -1;
  return b.lastActiveAt - a.lastActiveAt;
}

/** Search, status filter, sort, and the card grid. Press "/" to search. */
export function AgentBrowser({ agents }: Readonly<{ agents: AgentCardData[] }>) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Sort>("recent");
  const search = useRef<HTMLInputElement>(null);

  const statuses = useMemo(() => [...new Set(agents.map((agent) => agent.status))], [agents]);
  const counts = useMemo(() => Object.fromEntries(statuses.map((value) => [value, agents.filter((agent) => agent.status === value).length])), [agents, statuses]);
  const visible = useMemo(
    () => agents.filter((agent) => (status === "all" || agent.status === status) && matches(agent, query)).toSorted(sort === "name" ? (a, b) => a.name.localeCompare(b.name) : byRecent),
    [agents, query, status, sort],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function moveLight(event: PointerEvent<HTMLUListElement>) {
    if (event.pointerType !== "mouse") return;
    const card = (event.target as Element).closest<HTMLElement>(".agent-card");
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - box.left}px`);
    card.style.setProperty("--my", `${event.clientY - box.top}px`);
  }

  const filtered = query.trim() !== "" || status !== "all";

  return (
    <section aria-label="Your agents">
      <div className="dash-toolbar">
        <label className="dash-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <span className="sr-only">Search agents</span>
          <input ref={search} type="search" placeholder="Search agents" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
          <kbd aria-hidden="true">/</kbd>
        </label>
        {statuses.length > 1 && (
          <div className="dash-chips" role="group" aria-label="Filter by status">
            <button className={status === "all" ? "chip is-active" : "chip"} data-bare type="button" aria-pressed={status === "all"} onClick={() => setStatus("all")}>All <b>{agents.length}</b></button>
            {statuses.map((value) => (
              <button className={status === value ? "chip is-active" : "chip"} data-bare type="button" aria-pressed={status === value} key={value} onClick={() => setStatus(value)}>
                {statusLabel(value)} <b>{counts[value]}</b>
              </button>
            ))}
          </div>
        )}
        <label className="dash-sort">
          <span className="sr-only">Sort agents</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="recent">Recent activity</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      <p className="dash-result-count" role="status">{filtered ? `Showing ${visible.length} of ${agents.length} agents` : `${agents.length} ${agents.length === 1 ? "agent" : "agents"}`}</p>

      {visible.length === 0 ? (
        <div className="dash-empty">
          <AgentOrb hue={20} size={64} />
          <h3>No agents match your search</h3>
          <p>Try a different word, or clear the filters.</p>
          <button className="mini-action" data-bare type="button" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</button>
        </div>
      ) : (
        <ul className="agent-grid" onPointerMove={moveLight}>
          {visible.map((agent, index) => (
            <li className="agent-card" key={agent.id} style={{ "--i": Math.min(index, 12) } as CSSProperties}>
              <div className="agent-card-top">
                <AgentOrb hue={agent.hue} />
                <div className="agent-card-title">
                  <h3><Link className="agent-card-link" href={`/agents/${agent.id}`}>{agent.name}</Link></h3>
                  <span className={isLiveStatus(agent.status) ? "agent-status is-live" : "agent-status"}><i />{statusLabel(agent.status)}</span>
                </div>
              </div>
              <p className="agent-desc">{agent.description || "No description yet."}</p>
              <div className="agent-meta">
                {agent.languages.length === 0 ? <span className="lang-chip is-empty">No language</span> : agent.languages.map((language) => <span className="lang-chip" key={language}>{languageLabel(language)}</span>)}
                <span className="provider-dots" role="img" aria-label={providerLayers.map(({ key, label }) => `${label}: ${agent.overrides[key] ? "custom provider" : "runtime default"}`).join(", ")}>
                  {providerLayers.map(({ key, label }) => <span key={key} title={`${label}: ${agent.overrides[key] ? "custom provider" : "runtime default"}`}><i className={agent.overrides[key] ? "is-custom" : ""} />{key.toUpperCase()}</span>)}
                </span>
              </div>
              <div className="agent-card-foot">
                <span className="agent-activity">{agent.conversations === 0 ? "No conversations yet" : `${agent.conversations} ${agent.conversations === 1 ? "conversation" : "conversations"}${agent.lastActive ? ` · ${agent.lastActive}` : ""}`}</span>
                <span className="agent-actions">
                  <Link className="mini-action" href={`/agents/${agent.id}/edit`} aria-label={`Edit ${agent.name}`}>Edit</Link>
                  <Link className="mini-action primary" href={`/agents/${agent.id}/test`} aria-label={`Talk to ${agent.name}`}>Talk <span aria-hidden="true">↗</span></Link>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="dash-legend" aria-hidden="true"><i className="is-custom" /> custom provider <i /> runtime default</p>
    </section>
  );
}
