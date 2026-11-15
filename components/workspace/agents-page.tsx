"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { listAgents, type AgentView } from "@/lib/agents/view";
import { ROUTES } from "@/lib/landing/config";
import { AgentCard, LangDot } from "./agent-card";
import { AgentInspector } from "./agent-inspector";
import { WORKSPACE_SEARCH_ID } from "./workspace-nav";

type Phase = "loading" | "error" | "empty" | "ready";
type StatusFilter = "all" | "ready" | "draft";
type SortKey = "name" | "updated";
const SORTS: { id: SortKey; label: string }[] = [{ id: "name", label: "Name" }, { id: "updated", label: "Updated" }];
const STATUSES: { id: StatusFilter; label: string }[] = [{ id: "all", label: "All" }, { id: "ready", label: "Ready" }, { id: "draft", label: "Drafts" }];
const LANGS = ["EN", "RU", "KO"];

const PLUS = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

function StateOrb({ error }: { error?: boolean }) {
  return (
    <div className={error ? "state-orb err" : "state-orb"} aria-hidden="true">
      {[14, 26, 18, 30, 12].map((h, i) => <i key={i} style={{ height: h }} />)}
    </div>
  );
}

/** Share of the fleet that is live, as a small ring. */
function Ring({ value }: { value: number }) {
  const r = 15, c = 2 * Math.PI * r;
  return (
    <svg className="ring" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r={r} className="ring-track" />
      <circle cx="20" cy="20" r={r} className="ring-value" strokeDasharray={`${(c * value).toFixed(2)} ${c.toFixed(2)}`} />
    </svg>
  );
}

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Workspace Agents page: overview, search + filters, grid/list of agents and the inspector. */
export function AgentsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [langs, setLangs] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<SortKey>("name");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // "/" focuses the search (as in most tools), unless you are already typing somewhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || !searchRef.current?.offsetParent) return;
      e.preventDefault();
      searchRef.current.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => (status === "all" || (status === "ready") === a.ready)
      && langs.every((l) => a.langs.includes(l))
      && (!q || `${a.name} ${a.purpose} ${a.langs.join(" ")}`.toLowerCase().includes(q)))
      .sort(sort === "name"
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => (b.updatedAt ?? -Infinity) - (a.updatedAt ?? -Infinity)); // most recent first
  }, [agents, query, status, langs, sort]);

  /**
   * Arrow keys move between cards (Up/Down by a whole row in grid view), Home/End jump to the ends.
   * Selection follows focus, so the inspector updates as you move.
   */
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("ag-select")) return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(".ag-select")];
    const i = buttons.indexOf(target as HTMLButtonElement);
    const cols = view === "list" ? 1 : getComputedStyle(e.currentTarget).gridTemplateColumns.split(" ").length;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: buttons.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const to = buttons[Math.max(0, Math.min(buttons.length - 1, next))];
    to.focus();
    to.click();
  };

  // Keep a visible agent selected (the first one when the selection is filtered out).
  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  const loaded = phase === "ready" || phase === "empty";
  const stat = (n: number) => (loaded ? n : "—");
  const waiting = phase === "error" ? "Unavailable" : "Loading…";
  const ready = agents.filter((a) => a.ready).length;
  const drafts = agents.length - ready;
  const languages = LANGS.filter((l) => agents.some((a) => a.langs.includes(l)))
    .concat([...new Set(agents.flatMap((a) => a.langs))].filter((l) => !LANGS.includes(l)));
  const share = agents.length ? ready / agents.length : 0;
  const counts: Record<StatusFilter, number> = { all: agents.length, ready, draft: drafts };
  const filtering = query.trim() !== "" || status !== "all" || langs.length > 0;
  const clear = () => { setQuery(""); setStatus("all"); setLangs([]); };
  const toggleStatus = (s: StatusFilter) => setStatus((cur) => (cur === s ? "all" : s));
  const live = { loading: "Connecting to the platform…", error: "Platform offline", empty: "Platform connected", ready: "Platform connected" }[phase];

  return (
    <main className="page">
      <div className="page-bg" aria-hidden="true" />
      <div className="page-glow" aria-hidden="true" />
      <div className="wrap">
        <header className="head">
          <div className="head-copy">
            <div className="head-meta">
              <span className="mono crumb">Workspace / Agents</span>
              <span className="live" data-phase={phase} role="status"><i aria-hidden="true" />{live}</span>
            </div>
            <h1>Agents{loaded && <sup className="head-count" aria-hidden="true">{agents.length}</sup>}</h1>
            <p>Create, test and tune the voice agents that answer your calls — in English, Russian, Korean, or all of them at once.</p>
          </div>
          <div className="head-actions">
            <a href={ROUTES.voices} className="btn btn-ghost">Voice library</a>
            <a href={ROUTES.newAgent} className="btn btn-primary">{PLUS}New agent</a>
          </div>
        </header>

        <div className="stats" aria-label="Summary">
          <button type="button" className="stat" aria-pressed={loaded && status === "all"} disabled={!loaded} onClick={() => setStatus("all")}>
            <span className="stat-top"><span className="mono sm">Agents</span></span>
            <b>{stat(agents.length)}</b>
            <span className="meter" aria-hidden="true"><i style={{ width: `${share * 100}%` }} /></span>
            <span className="stat-note">{loaded ? `${ready} live · ${drafts} in draft` : waiting}</span>
          </button>
          <button type="button" className="stat" aria-pressed={status === "ready"} disabled={!loaded} onClick={() => toggleStatus("ready")}>
            <span className="stat-top"><span className="mono sm">Ready</span><Ring value={share} /></span>
            <b>{stat(ready)}</b>
            <span className="stat-note">{loaded ? `${Math.round(share * 100)}% of agents can take calls` : waiting}</span>
          </button>
          <button type="button" className="stat stat-draft" aria-pressed={status === "draft"} disabled={!loaded} onClick={() => toggleStatus("draft")}>
            <span className="stat-top"><span className="mono sm">Drafts</span><span className="stat-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg></span></span>
            <b>{stat(drafts)}</b>
            <span className="stat-note">{loaded ? (drafts ? "Finish setup to go live" : "Everything is live") : waiting}</span>
          </button>
          <div className="stat stat-static">
            <span className="stat-top"><span className="mono sm">Languages</span></span>
            <b>{stat(languages.length)}</b>
            <span className="stat-langs">{loaded ? languages.map((l) => <span key={l} className="lang-tag"><LangDot lang={l} />{l}</span>) : <span className="stat-note">{waiting}</span>}</span>
          </div>
        </div>

        <section className="win" aria-labelledby="listTitle">
          <div className="win-bar">
            <div className="win-left">
              <span className="win-dots" aria-hidden="true"><i /><i /><i /></span>
              <h2 className="mono sm win-path" id="listTitle">workspace <span aria-hidden="true">/</span> <b>{phase === "ready" && selected ? `agents / ${selected.id}` : "agents"}</b></h2>
            </div>
            <div className="win-right">
              {phase === "ready" && <p className="mono sm count" aria-live="polite">{filtered.length} of {agents.length} agents</p>}
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
            <div className="tools-row">
              <label className="search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input ref={searchRef} id={WORKSPACE_SEARCH_ID} type="search" placeholder="Search by name, purpose or language" aria-label="Search agents" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
                <kbd aria-hidden="true">/</kbd>
              </label>
              <div className="segmented" role="group" aria-label="Status">
                {STATUSES.map((s) => (
                  <button key={s.id} type="button" className="filter" aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>
                    {s.label}<span className="seg-count" aria-hidden="true">{counts[s.id]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="tools-row tools-sub">
              <div className="chips" role="group" aria-label="Languages">
                <span className="mono sm tools-label" aria-hidden="true">Speaks</span>
                {LANGS.map((l) => (
                  <button key={l} type="button" className="chip" aria-pressed={langs.includes(l)} onClick={() => setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))}><LangDot lang={l} />{l}</button>
                ))}
              </div>
              <div className="tools-end">
                {filtering && <button type="button" className="clear" onClick={clear}>Clear filters</button>}
                <div className="sort" role="group" aria-label="Sort by">
                  <span className="mono sm tools-label" aria-hidden="true">Sort</span>
                  {SORTS.map((s) => (
                    <button key={s.id} type="button" className="filter" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {phase === "loading" && (
            <div className="body" aria-busy="true" aria-label="Loading agents">
              <div className="grid"><div className="skel" /><div className="skel" /><div className="skel" /></div>
              <div className="skel-panel" aria-hidden="true" />
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
            <div className="state state-empty">
              {/* Inha's dragon (same picture as the landing film's finale) waves you in. */}
              <img className="state-dragon" src="/brand/inha-dragon.webp" width={552} height={640} alt="" />
              <h2>No agents yet</h2>
              <p>Give an agent a purpose, its languages and a voice — then talk to it in the playground before it takes a call.</p>
              <a href={ROUTES.newAgent} className="btn btn-primary">{PLUS}Create your first agent</a>
            </div>
          )}

          {phase === "ready" && (
            <div className="body" data-view={view} data-inspector={selected ? "on" : "off"}>
              <div className="list-col">
                <div className="grid" onKeyDown={onGridKey}>
                  {filtered.map((a) => (
                    <AgentCard key={a.id} agent={a} n={agents.indexOf(a) + 1} selected={a.id === selected?.id} onSelect={() => setSelectedId(a.id)} />
                  ))}
                  {filtered.length > 0 && (
                    <a className="new-card" href={ROUTES.newAgent}>
                      <span className="new-card-icon">{PLUS}</span>
                      <span>New agent</span>
                      <span className="mono sm">Purpose · languages · voice</span>
                    </a>
                  )}
                </div>
                {filtered.length === 0 && (
                  <div className="no-match">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M8.5 11h5" /></svg>
                    <h3>No agents match</h3>
                    <p>Try another search, or clear the filters to see all {agents.length} agents.</p>
                    <button type="button" className="btn btn-ghost" onClick={clear}>Show all agents</button>
                  </div>
                )}
              </div>
              {selected && <AgentInspector agent={selected} />}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
