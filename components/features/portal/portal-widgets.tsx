"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  DOCUMENTS, INTAKES, KOREAN_TRACK_COLLEGES, NOTICES, formatKst, groupNotices, nextDeadline, scheduleStatus,
  type ChecklistItem, type StepStatus,
} from "@/lib/portal-content";
import { useAssistant } from "./assistant-dock";

/** "Now", read only after mount: the pages are prerendered, so server and browser must agree on the first render. */
function useNow(refreshMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), refreshMs);
    return () => window.clearInterval(t);
  }, [refreshMs]);
  return now;
}

/* ---------------- Programs: filter by college + search ---------------- */

export function ProgramsExplorer() {
  const [college, setCollege] = useState("All");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const assistant = useAssistant();
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => KOREAN_TRACK_COLLEGES
      .filter((c) => college === "All" || c.name === college)
      .map((c) => ({ ...c, majors: q ? c.majors.filter((m) => m.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : c.majors }))
      .filter((c) => c.majors.length > 0),
    [college, q],
  );
  const count = shown.reduce((n, c) => n + c.majors.length, 0);

  return (
    <div className="portal-programs">
      <div className="portal-filters">
        <label htmlFor={searchId} className="sr-only">Search majors</label>
        <input id={searchId} type="search" className="portal-search" placeholder="Search majors, e.g. computer" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="portal-chips" role="group" aria-label="College">
          {["All", ...KOREAN_TRACK_COLLEGES.map((c) => c.name)].map((name) => (
            <button key={name} type="button" className="portal-chip" aria-pressed={college === name} onClick={() => setCollege(name)}>{name}</button>
          ))}
        </div>
      </div>
      <p className="portal-fine" role="status">{count} {count === 1 ? "major" : "majors"}</p>
      {shown.length === 0 ? (
        <p className="portal-note">No major matches &ldquo;{query}&rdquo;. <button type="button" className="portal-link" onClick={() => assistant.ask(`Does Inha offer a major in ${query}?`)}>Ask the assistant</button></p>
      ) : (
        <div className="portal-colleges">
          {shown.map((c) => (
            <section key={c.name} className="portal-college" aria-label={`College of ${c.name}`}>
              <h3>{c.name}</h3>
              <ul>{c.majors.map((m) => <li key={m}>{m}</li>)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Apply: document checklist (saved in this browser) ---------------- */

const CHECK_KEY = "inha-portal-checklist";

export function readChecklist(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(CHECK_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
function writeChecklist(value: Record<string, boolean>) {
  try { window.localStorage.setItem(CHECK_KEY, JSON.stringify(value)); } catch { /* storage blocked: ticks last for this visit */ }
}

export function DocumentsChecklist() {
  const [who, setWho] = useState<"freshman" | "transfer">("freshman");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const assistant = useAssistant();
  useEffect(() => setDone(readChecklist()), []);
  const items = DOCUMENTS.filter((d: ChecklistItem) => d.who === "all" || d.who === who);
  const ticked = items.filter((d) => done[d.id]).length;

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeChecklist(next);
      return next;
    });
  }

  return (
    <div className="portal-checklist">
      <div className="portal-chips" role="group" aria-label="I am applying as">
        <button type="button" className="portal-chip" aria-pressed={who === "freshman"} onClick={() => setWho("freshman")}>Freshman</button>
        <button type="button" className="portal-chip" aria-pressed={who === "transfer"} onClick={() => setWho("transfer")}>Transfer</button>
      </div>
      <div className="portal-progress" aria-hidden="true"><i style={{ width: `${(ticked / items.length) * 100}%` }} /></div>
      <p className="portal-fine" role="status">{ticked} of {items.length} ready · saved in this browser only</p>
      <ul>
        {items.map((d) => (
          <li key={d.id} data-done={!!done[d.id]}>
            <label>
              <input type="checkbox" checked={!!done[d.id]} onChange={() => toggle(d.id)} />
              <span><strong>{d.label}</strong>{d.detail && <small>{d.detail}</small>}</span>
            </label>
            <button type="button" className="portal-link" onClick={() => assistant.ask(`Tell me more about this document: ${d.label}`)}>Ask</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Dates: live status per step ---------------- */

const STATUS_LABEL: Record<StepStatus, string> = { open: "Open now", upcoming: "Upcoming", closed: "Closed", done: "Announced" };

export function DatesTimeline() {
  const now = useNow();
  const next = now ? nextDeadline(INTAKES, now) : null;
  return (
    <>
      {next && (
        <div className="portal-next" role="status">
          <strong>Next: {next.intake.term.split(" · ")[0]} · {next.step.label} {next.kind === "closes" ? "closes" : next.kind === "opens" ? "opens" : ""}</strong>
          <span>{formatKst(next.at)}</span>
        </div>
      )}
      <div className="portal-intakes">
        {INTAKES.map((intake) => (
          <section key={intake.id} className="portal-intake" aria-label={intake.term}>
            <h3>{intake.term}</h3>
            <ol className="portal-timeline">
              {intake.steps.map((step) => {
                const status = now ? scheduleStatus(step, now) : null;
                return (
                  <li key={step.id} data-status={status ?? undefined}>
                    <span className="portal-timeline-label">{step.label}</span>
                    <span className="portal-timeline-when">{step.start ? `${formatKst(step.start)} – ${formatKst(step.end)}` : formatKst(step.end)}</span>
                    {status && <span className="portal-status" data-status={status}>{STATUS_LABEL[status]}</span>}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}

/** The Dates dragon's line: the next deadline, worked out in the browser. */
export function NextDeadlineBubble() {
  const now = useNow();
  const next = now ? nextDeadline(INTAKES, now) : null;
  if (!now) return <>Every deadline in Korea time.</>;
  if (!next) return <>New dates are announced in early October and early April.</>;
  const term = next.intake.term.split(" · ")[0];
  const verb = next.kind === "closes" ? "closes" : next.kind === "opens" ? "opens" : "";
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(next.at));
  return <>Next up: <strong>{term} {next.step.label.toLowerCase()}{verb ? ` ${verb}` : ""}</strong>, {day} KST.</>;
}

/* ---------------- Notices ---------------- */

export function NoticesList() {
  const now = useNow();
  const groups = groupNotices(NOTICES, now ?? new Date(0));
  const dateOf = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  const render = (title: string, list: typeof NOTICES) => list.length > 0 && (
    <section className="portal-block" aria-label={title}>
      <h2>{title}</h2>
      <ul className="portal-notices">
        {list.map((n) => (
          <li key={n.title}>
            {n.date && <time dateTime={n.date}>{dateOf(n.date)}</time>}
            <div>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <a className="portal-fine" href={n.source.url} target="_blank" rel="noreferrer noopener">{n.source.label} ↗</a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
  if (!now) return null;
  return <>{render("Coming up", groups.upcoming)}{render("Earlier", groups.past)}{render("Good to know", groups.general)}</>;
}
