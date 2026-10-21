"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listAgents, type AgentView } from "@/lib/agents/view";
import { ROUTES } from "@/lib/landing/config";
import { AgentCard } from "./agent-card";
import { AgentInspector } from "./agent-inspector";
import { WORKSPACE_SEARCH_ID } from "./workspace-nav";

type Phase = "loading" | "error" | "empty" | "ready";
type StatusFilter = "all" | "ready" | "draft";
const LANGS = ["EN", "RU", "KO"];

function StateOrb({ error }: { error?: boolean }) {
  return (
    <div className={error ? "state-orb err" : "state-orb"} aria-hidden="true">
      {[14, 26, 18, 30, 12].map((h, i) => <i key={i} style={{ height: h }} />)}
    </div>
  );
}

/** Workspace Agents page: summary, search + filters, grid/list of agents and the inspector. */
export function AgentsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [langs, setLangs] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback((isCurrent: () => boolean = () => true) => {
    setPhase("loading");
    listAgents().then(
      (list) => { if (isCurrent()) { setAgents(list); setPhase(list.length ? "ready" : "empty"); } },
      () => { if (isCurrent()) { setAgents([]); setPhase("error"); } },
    );
  }, []);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => (status === "all" || (status === "ready") === a.ready)
      && langs.every((l) => a.langs.includes(l))
      && (!q || `${a.name} ${a.purpose} ${a.langs.join(" ")}`.toLowerCase().includes(q)));
  }, [agents, query, status, langs]);

  // Keep a visible agent selected (the first one when the selection is filtered out).
  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  const loaded = phase === "ready" || phase === "empty";
  const stat = (n: number) => (loaded ? n : "—");

  return (
    <main className="page">
      <div className="page-bg" aria-hidden="true" />
      <div className="wrap">
        <div className="head">
          <div>
            <div className="mono crumb">Workspace / Agents</div>
            <h1>Agents</h1>
            <p>Create, test and tune the voice agents that answer your calls — in English, Russian, Korean, or all of them at once.</p>
          </div>
          <a href={ROUTES.newAgent} className="btn btn-primary">New agent
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ color: "var(--lime)" }}><path d="M12 5v14M5 12h14" /></svg>
          </a>
        </div>

        <div className="stats" aria-label="Summary">
          <div className="stat"><span className="mono sm">Agents</span><b>{stat(agents.length)}</b></div>
          <div className="stat"><span className="mono sm">Ready</span><b>{stat(agents.filter((a) => a.ready).length)}</b></div>
          <div className="stat"><span className="mono sm">Drafts</span><b>{stat(agents.filter((a) => !a.ready).length)}</b></div>
          <div className="stat"><span className="mono sm">Languages</span><b>{stat(new Set(agents.flatMap((a) => a.langs)).size)}</b></div>
        </div>

        <section className="win" aria-labelledby="listTitle">
          <div className="win-bar">
            <div className="win-left">
              <span className="win-dots" aria-hidden="true"><i /><i /><i /></span>
              <h2 className="mono sm win-path" id="listTitle">workspace <span aria-hidden="true">/</span> <b>{phase === "ready" && selected ? `agents / ${selected.id}` : "agents"}</b></h2>
            </div>
            <div className="win-right">
              <div className="view-toggle" role="group" aria-label="View">
                <button type="button" aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => setView("grid")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
                </button>
                <button type="button" aria-pressed={view === "list"} aria-label="List view" onClick={() => setView("list")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
              </div>
            </div>
          </div>

          <div className="tools" hidden={phase !== "ready"}>
            <label className="search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input id={WORKSPACE_SEARCH_ID} type="search" placeholder="Search agents…" aria-label="Search agents" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="tool-right">
              <div className="filters" role="group" aria-label="Status">
                {(["all", "ready", "draft"] as const).map((s) => (
                  <button key={s} type="button" className="filter" aria-pressed={status === s} onClick={() => setStatus(s)}>{{ all: "All", ready: "Ready", draft: "Drafts" }[s]}</button>
                ))}
              </div>
              <div className="chips" role="group" aria-label="Languages">
                {LANGS.map((l) => (
                  <button key={l} type="button" className="chip" aria-pressed={langs.includes(l)} onClick={() => setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {phase === "loading" && (
            <div className="body" aria-busy="true" aria-label="Loading agents">
              <div className="grid"><div className="skel" /><div className="skel" /><div className="skel" /></div>
            </div>
          )}

          {phase === "error" && (
            <div className="state" role="alert">
              <StateOrb error />
              <h2>Can’t reach the platform</h2>
              <p>The Platform API is unavailable. Check that it’s running, then try again.</p>
              <button type="button" className="btn btn-primary" onClick={() => load()}>Try again</button>
            </div>
          )}

          {phase === "empty" && (
            <div className="state">
              <StateOrb />
              <h2>No agents yet</h2>
              <p>Give an agent a purpose, its languages and a voice — then talk to it in the playground before it takes a call.</p>
              <a href={ROUTES.newAgent} className="btn btn-primary">Create your first agent</a>
            </div>
          )}

          {phase === "ready" && (
            <div className="body" data-view={view}>
              <div>
                <div className="grid">
                  {filtered.map((a) => (
                    <AgentCard key={a.id} agent={a} n={agents.indexOf(a) + 1} selected={a.id === selected?.id} onSelect={() => setSelectedId(a.id)} />
                  ))}
                  <a className="new-card" href={ROUTES.newAgent}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    New agent
                  </a>
                </div>
                <p className="mono sm count" aria-live="polite">{filtered.length} of {agents.length} agents</p>
              </div>
              {selected && <AgentInspector agent={selected} />}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
