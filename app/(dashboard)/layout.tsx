import type { Metadata } from "next";
import { RootHtml } from "@/components/shared/root-html";
import { legacyFonts } from "@/lib/fonts/legacy";
import { baseMetadata } from "@/lib/site-metadata";
import "@/styles/legacy/tokens.css";
import "@/styles/legacy/globals.css";
import "@/styles/legacy/theme-shared.css";
import "./dashboard.css";
import "./dashboard-dark.css";
import "./workspace.css";
import "./navigation.css";
import { CommandPalette } from "@/components/features/agents/command-palette";
import { DashboardHeader } from "@/components/features/agents/dashboard-header";
import { DashboardBackground } from "@/components/features/network/network-background";

export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: "Voice Labs Workspace", template: "%s · Voice Labs" },
};

/** Root layout for the workspace pages ported from the previous app. */
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml fonts={legacyFonts} scrollBehavior><div className="dash-root">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <DashboardBackground />
    <DashboardHeader />
    <CommandPalette />
    <div id="main-content" tabIndex={-1} className="dash-content">{children}</div>
    <footer className="site-footer">Voice Labs <span>·</span> Voice agent workspace</footer>
  </div></RootHtml>;
}
