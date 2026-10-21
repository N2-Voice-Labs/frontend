"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { ThemeToggle } from "@/components/features/landing/theme/theme-toggle";
import { OPEN_PALETTE_EVENT } from "./command-palette";

/** Primary sections, Call first (UX spec §3.1). The Usage page is the analytics view. */
export const primaryLinks = [
  { href: "/call", label: "Call" },
  { href: "/conversations", label: "Conversations" },
  { href: "/agents", label: "Agents" },
  { href: "/voices", label: "Voices" },
  { href: "/usage", label: "Usage" },
];

/** Agent-builder and outbound tools, grouped under More. */
export const moreLinks = [
  { href: "/campaigns", label: "Campaigns" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/tools", label: "Tools" },
];

export const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Desktop section links with the More ▾ group. Shared by the workspace header and the call pages' header
 * so both navigate the same way (hidden below 1024 px, where the menu sheet takes over).
 */
export function WorkspaceNav({ pathname }: { pathname: string }) {
  const more = useRef<HTMLDetailsElement>(null);
  const moreCurrent = moreLinks.some((link) => isCurrent(pathname, link.href));

  // Close the More menu on outside click and Esc.
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (more.current?.open && !more.current.contains(event.target as Node)) more.current.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && more.current?.open) {
        more.current.open = false;
        more.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const closeMore = (event: MouseEvent<HTMLAnchorElement>) => event.currentTarget.closest("details")?.removeAttribute("open");

  return (
    <nav className="dash-nav" aria-label="Workspace navigation">
      {primaryLinks.map((link) => (
        <Link key={link.href} className="dash-link" href={link.href} aria-current={isCurrent(pathname, link.href) ? "page" : undefined}>{link.label}</Link>
      ))}
      <details className="dash-more" ref={more}>
        <summary className="dash-link" aria-current={moreCurrent ? "true" : undefined}>More <span aria-hidden="true">▾</span></summary>
        <div className="dash-more-menu">
          {moreLinks.map((link) => (
            <Link key={link.href} className="dash-more-link" href={link.href} onClick={closeMore} aria-current={isCurrent(pathname, link.href) ? "page" : undefined}>{link.label}</Link>
          ))}
        </div>
      </details>
    </nav>
  );
}

/** Opens the menu sheet below 1024 px. */
export function MenuButton({ expanded, onOpen }: { expanded: boolean; onOpen: () => void }) {
  return (
    <button className="dash-menu-button" data-bare type="button" aria-label="Menu" aria-haspopup="dialog" aria-expanded={expanded} onClick={onOpen}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      <span>Menu</span>
    </button>
  );
}

export function DashboardHeader() {
  const pathname = usePathname();
  const [shortcut, setShortcut] = useState("Ctrl K");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘K");
  }, []);

  return (
    <header className="dash-header">
      <Link className="marketing-brand dash-brand" href="/" aria-label="Voice Labs home">
        <span className="brand-glyph">v<span>.</span></span><span>voice labs</span><em>Workspace</em>
      </Link>
      <WorkspaceNav pathname={pathname} />
      <div className="dash-actions">
        <button className="palette-trigger" data-bare type="button" onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))} aria-label="Search agents and pages">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <span>Search</span><kbd aria-hidden="true">{shortcut}</kbd>
        </button>
        <ThemeToggle />
        {!isCurrent(pathname, "/call") && (
          <Link className="dash-start" href="/call" aria-label="Start a call">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" /></svg>
            <span>Start a call</span>
          </Link>
        )}
        <MenuButton expanded={menuOpen} onOpen={() => setMenuOpen(true)} />
      </div>
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} />
    </header>
  );
}

/**
 * Tablet/phone navigation (UX spec §3.2–3.3): a native <dialog> sheet from the top, grouped as
 * Communicate / Build / Account. Links render only while open, so the closed sheet adds nothing to the
 * accessibility tree. No bottom tab bar: the bottom of the screen belongs to the call dock.
 */
export function MenuSheet({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      opener.current = document.activeElement as HTMLElement | null;
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onClose();
    opener.current?.focus?.();
  }, [onClose]);

  useEffect(() => {
    const element = dialog.current;
    element?.addEventListener("close", handleClose);
    return () => element?.removeEventListener("close", handleClose);
  }, [handleClose]);

  // Navigating closes the sheet.
  useEffect(() => {
    if (dialog.current?.open) dialog.current.close();
  }, [pathname]);

  const groups = [
    { title: "Communicate", links: [{ href: "/call", label: "Start a call" }, { href: "/conversations", label: "Conversations" }] },
    { title: "Build", links: [{ href: "/agents", label: "Agents" }, { href: "/voices", label: "Voices" }, ...moreLinks] },
    { title: "Account", links: [{ href: "/usage", label: "Usage" }] },
  ];

  return (
    <dialog ref={dialog} className="dash-menu-sheet" aria-label="Menu" onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}>
      {open && (
        <div className="dash-menu-panel">
          <div className="dash-menu-head">
            <span className="dash-menu-title">Menu</span>
            <button className="dash-menu-close" data-bare type="button" onClick={() => dialog.current?.close()} aria-label="Close menu">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Menu navigation">
            {groups.map((group) => (
              <div className="dash-menu-group" key={group.title}>
                <p className="dash-menu-group-title">{group.title}</p>
                {group.links.map((link) => (
                  <Link key={link.href} className="dash-menu-link" href={link.href} onClick={() => dialog.current?.close()} aria-current={isCurrent(pathname, link.href) ? "page" : undefined}>{link.label}</Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
      )}
    </dialog>
  );
}
