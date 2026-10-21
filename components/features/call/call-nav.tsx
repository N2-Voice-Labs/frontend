"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MenuButton, MenuSheet, WorkspaceNav } from "@/components/features/agents/dashboard-header";
import { ThemeToggle } from "@/components/features/landing/theme/theme-toggle";

/**
 * Header for the call pages when no call is live (setup, ended). Uses the same section links and menu
 * sheet as the workspace, so people can leave /call for any page. The live call screen keeps its own
 * header without navigation: leaving the page would drop the call, so End is the way out.
 */
export function CallNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="call-setup-header call-nav">
      <Link className="marketing-brand" href="/" aria-label="Voice Labs home"><span className="brand-glyph">v<span>.</span></span><span>voice labs</span></Link>
      <WorkspaceNav pathname={pathname} />
      <div className="call-setup-header-actions">
        <ThemeToggle />
        <MenuButton expanded={menuOpen} onOpen={() => setMenuOpen(true)} />
      </div>
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} />
    </header>
  );
}
