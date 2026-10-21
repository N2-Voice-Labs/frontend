"use client";

import { useState } from "react";
import { Waveform } from "@/components/shared/waveform";
import { GALLERY_AGENTS, GALLERY_FILTERS, type GalleryCategory } from "@/lib/landing/showcase-data";
import { useDemoSession } from "./demo-session";

const PLAY = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;

/** Sample agents with search + category filters. Play starts a real demo session with that agent. */
export function ShowcaseGallery() {
  const session = useDemoSession();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GalleryCategory | "all">("all");

  const q = query.trim().toLowerCase();
  const list = GALLERY_AGENTS.filter((a) => (filter === "all" || a.cat === filter)
    && (!q || `${a.name} ${a.role} ${a.langs.join(" ")}`.toLowerCase().includes(q)));

  const talkTo = (agent: (typeof GALLERY_AGENTS)[number]) => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    session.talkTo({ id: agent.id, name: agent.name });
  };

  return (
    <>
      <div className="ag-tools">
        <label className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" placeholder="Search agents…" aria-label="Search agents" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="filters" role="group" aria-label="Filter agents">
          {GALLERY_FILTERS.map((f) => (
            <button key={f.id} type="button" className="filter" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="ag-grid">
        {list.map((a) => {
          const i = GALLERY_AGENTS.indexOf(a);
          return (
            <article key={a.id} className="ag">
              <div className="ag-head">
                <span className="mono sm">{String(i + 1).padStart(2, "0")}</span>
                <button type="button" className="round-btn" aria-label={`Speak to ${a.name}`} onClick={() => talkTo(a)}>{PLAY}</button>
              </div>
              <h3>{a.name}</h3>
              <span className="mono sm">{a.role} / {a.cat}</span>
              <div className="ag-foot">
                <Waveform seed={50 + i} n={40} max={22} className="static" />
                <span className="langs">{a.langs.map((l) => <span key={l}>{l}</span>)}</span>
              </div>
            </article>
          );
        })}
        {!list.length && <p className="ag-empty">No agents match that search.</p>}
      </div>
      <p className="mono sm ag-count" aria-live="polite">{list.length} of {GALLERY_AGENTS.length} sample agents · build your own in the workspace</p>
    </>
  );
}
