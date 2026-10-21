"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { MobileMenu } from "@/components/shared/mobile-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ROUTES } from "@/lib/landing/config";

/** The page's search field registers with this id; ⌘K / Ctrl+K and the Search button focus it. */
export const WORKSPACE_SEARCH_ID = "workspace-search";
/** Opens the command palette on pages that have one (components/features/agents/command-palette.tsx). */
const OPEN_PALETTE_EVENT = "voice-labs:open-palette";

const LINKS = [
  { label: "Call", href: ROUTES.call },
  { label: "Conversations", href: ROUTES.conversations },
  { label: "Agents", href: ROUTES.agents },
  { label: "Voices", href: ROUTES.voices },
  { label: "Usage", href: ROUTES.usage },
];

/** Agent-builder and outbound tools, grouped under More (as in the previous workspace header). */
const MORE = [
  { label: "Campaigns", href: "/campaigns" },
  { label: "Knowledge", href: "/knowledge" },
  { label: "Tools", href: "/tools" },
];

const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Focuses the page's search field, or opens the command palette when the page has no search. */
function openSearch() {
  const field = document.getElementById(WORKSPACE_SEARCH_ID);
  if (field) field.focus();
  else window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

export function WorkspaceNav() {
  const pathname = usePathname() ?? "";
  const more = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    // ⌘K on pages with a search field. Pages with the command palette handle ⌘K themselves.
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && document.getElementById(WORKSPACE_SEARCH_ID)) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape" && more.current?.open) {
        more.current.open = false;
        more.current.querySelector("summary")?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (more.current?.open && !more.current.contains(e.target as Node)) more.current.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const moreCurrent = MORE.some((l) => isCurrent(pathname, l.href));

  return (
    <header className="nav">
      <div className="nav-pill">
        <div className="nav-left">
          <a href={ROUTES.home} className="logo"><span className="logo-mark">V<span>.</span></span><span className="logo-word">VOICE LABS</span></a>
          <span className="ws-tag">WORKSPACE</span>
        </div>
        <nav className="links" aria-label="Workspace">
          {LINKS.map((l) => <a key={l.label} href={l.href} aria-current={isCurrent(pathname, l.href) ? "page" : undefined}>{l.label}</a>)}
          <details className="more" ref={more}>
            <summary aria-current={moreCurrent ? "page" : undefined}>More</summary>
            <div className="more-sheet">
              {MORE.map((l) => <a key={l.label} href={l.href} aria-current={isCurrent(pathname, l.href) ? "page" : undefined}>{l.label}</a>)}
            </div>
          </details>
        </nav>
        <div className="nav-right">
          <button type="button" className="kbd-search" data-bare aria-label="Search (Ctrl or Command + K)" onClick={openSearch}>
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
            links={[...LINKS, ...MORE].map((l) => ({ ...l, current: isCurrent(pathname, l.href) }))}
            action={<a href={ROUTES.call} className="btn btn-primary">Start a call</a>}
          />
        </div>
      </div>
    </header>
  );
}
