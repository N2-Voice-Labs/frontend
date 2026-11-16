"use client";

import { RETRIEVED, type Source } from "@/lib/portal-content";
import { useAssistant } from "./assistant-dock";
import { Mascot, type MascotPose } from "./mascot";

/**
 * Shared shell for a portal tab: a full-width hero band where the tab's dragon is the main visual and says one
 * true line from the sources, "On this page" links, the sections, and where the facts come from.
 */
export function PortalPage({ eyebrow, title, lead, pose, bubble, onThisPage, sources, children }: {
  eyebrow: string;
  title: string;
  lead: React.ReactNode;
  pose: MascotPose;
  bubble: React.ReactNode;
  onThisPage?: { id: string; label: string }[];
  sources: Source[];
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="portal-main portal-tabpage">
      <header className="portal-hero-band">
        <div className="portal-hero-band-copy">
          <p className="portal-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="portal-pagehead-lead">{lead}</p>
          {onThisPage?.length ? (
            <nav className="portal-onpage" aria-label="On this page">
              {onThisPage.map((l) => <a key={l.id} href={`#${l.id}`}>{l.label}</a>)}
            </nav>
          ) : null}
        </div>
        <Mascot pose={pose} width={320} priority speech={bubble} className="portal-hero-sticker" />
      </header>
      <div className="portal-tabpage-body">
        {children}
        <SourceFooter sources={sources} />
      </div>
    </main>
  );
}

export function PortalSection({ title, asks, children, id }: { title: string; asks?: string[]; children: React.ReactNode; id?: string }) {
  return (
    <section className="portal-block" id={id} aria-label={title} tabIndex={-1}>
      <h2>{title}</h2>
      {children}
      {asks?.length ? <AskChips questions={asks} /> : null}
    </section>
  );
}

/** Questions that open the assistant's chat with the text filled in. */
export function AskChips({ questions }: { questions: string[] }) {
  const assistant = useAssistant();
  return (
    <div className="portal-asks">
      <span className="portal-asks-label">Ask the assistant</span>
      {questions.map((q) => (
        <button key={q} type="button" className="portal-ask" onClick={() => assistant.ask(q)}>{q}</button>
      ))}
    </div>
  );
}

function SourceFooter({ sources }: { sources: Source[] }) {
  return (
    <section className="portal-sources-foot" aria-label="Sources">
      <p className="portal-fine"><strong>Sources</strong> · retrieved {RETRIEVED}. Always confirm on Inha&apos;s official admissions website.</p>
      <ul>
        {sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer noopener">{s.label} ↗</a></li>)}
      </ul>
    </section>
  );
}
