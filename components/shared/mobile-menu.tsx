"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** `current`: true marks the current page; "location" marks the section in view (in-page links). */
export type MenuLink = { label: string; href: string; current?: boolean | "location" };

/**
 * Menu button + sheet for narrow screens, where the nav links are hidden (under 900px). Closes on Escape
 * (returning focus to the button), on an outside click, and after a link is chosen. `action` renders the
 * primary call to action at the bottom of the sheet.
 */
export function MobileMenu({ links, label, action }: { links: MenuLink[]; label: string; action?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); button.current?.focus(); }
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="menu" ref={root}>
      <button ref={button} type="button" className="icon-btn menu-btn" data-bare aria-expanded={open} aria-controls={id} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div id={id} className="menu-sheet" hidden={!open} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        <nav aria-label={label}>
          {links.map((l) => <a key={l.label} href={l.href} aria-current={l.current ? (l.current === "location" ? "location" : "page") : undefined}>{l.label}</a>)}
        </nav>
        {action && <div className="menu-action">{action}</div>}
      </div>
    </div>
  );
}
