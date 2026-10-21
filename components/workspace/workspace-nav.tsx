"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { MobileMenu } from "@/components/shared/mobile-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ROUTES } from "@/lib/landing/config";

/** The page's search field registers with this id; ⌘K / Ctrl+K and the Search button focus it. */
export const WORKSPACE_SEARCH_ID = "workspace-search";

const LINKS = [
  { label: "Call", href: ROUTES.call },
  { label: "Conversations", href: ROUTES.conversations },
  { label: "Agents", href: ROUTES.agents },
  { label: "Voices", href: ROUTES.voices },
  { label: "Usage", href: ROUTES.usage },
];

const focusSearch = () => document.getElementById(WORKSPACE_SEARCH_ID)?.focus();

export function WorkspaceNav() {
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && document.getElementById(WORKSPACE_SEARCH_ID)) {
        e.preventDefault();
        focusSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="nav">
      <div className="nav-pill">
        <div className="nav-left">
          <a href={ROUTES.home} className="logo"><span className="logo-mark">V<span>.</span></span><span className="logo-word">VOICE LABS</span></a>
          <span className="ws-tag">WORKSPACE</span>
        </div>
        <nav className="links" aria-label="Workspace">
          {LINKS.map((l) => <a key={l.label} href={l.href} aria-current={l.href === pathname ? "page" : undefined}>{l.label}</a>)}
        </nav>
        <div className="nav-right">
          <button type="button" className="kbd-search" aria-label="Search agents (Ctrl or Command + K)" onClick={focusSearch}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <span>Search</span><kbd>⌘K</kbd>
          </button>
          <ThemeToggle />
          <a href={ROUTES.call} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>
            Start a call
          </a>
          <MobileMenu
            label="Workspace"
            links={LINKS.map((l) => ({ ...l, current: l.href === pathname }))}
            action={<a href={ROUTES.call} className="btn btn-primary">Start a call</a>}
          />
        </div>
      </div>
    </header>
  );
}
