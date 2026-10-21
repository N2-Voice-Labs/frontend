"use client";

import { useState } from "react";
import { MobileMenu } from "@/components/shared/mobile-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useScrollEffect } from "@/lib/landing/scroll";
import { SpeakShortcut } from "./demo-session";

export const SECTION_LINKS = [
  { label: "How it works", href: "#bridge" },
  { label: "Languages", href: "#languages" },
  { label: "Product", href: "#workspace" },
  { label: "Latency", href: "#latency" },
];

/** The nav section whose area covers the line 40% down the viewport, read in the shared scroll frame. */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);
  useScrollEffect((vh) => {
    const line = vh * 0.4;
    const hit = SECTION_LINKS.find((l) => {
      const r = document.querySelector(l.href)?.getBoundingClientRect();
      return r && r.top <= line && r.bottom > line;
    });
    const next = hit?.href ?? null;
    setActive((prev) => (prev === next ? prev : next));
  });
  return active;
}

export function Nav() {
  const active = useActiveSection();
  const links = SECTION_LINKS.map((l) => ({ ...l, current: l.href === active ? ("location" as const) : undefined }));
  return (
    <header className="nav">
      <div className="nav-pill">
        <a href="#top" className="logo"><span className="logo-mark">V<span>.</span></span><span className="logo-word">VOICE LABS</span></a>
        <nav className="links" aria-label="Main">
          {links.map((l) => <a key={l.href} href={l.href} aria-current={l.current}>{l.label}</a>)}
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <SpeakShortcut className="btn btn-primary">Speak to it</SpeakShortcut>
          <MobileMenu label="Main" links={links} action={<SpeakShortcut className="btn btn-primary">Speak to it</SpeakShortcut>} />
        </div>
      </div>
    </header>
  );
}
