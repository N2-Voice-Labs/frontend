import type { Metadata } from "next";
import { CommandPalette } from "@/components/features/agents/command-palette";
import { RootHtml } from "@/components/shared/root-html";
import { WorkspaceFooter } from "@/components/workspace/workspace-footer";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { siteFonts } from "@/lib/fonts/site";
import { baseMetadata } from "@/lib/site-metadata";
import "@/styles/legacy/tokens.css";
import "@/styles/legacy/globals.css";
import "@/styles/legacy/theme-shared.css";
import "./dashboard.css";
import "./dashboard-dark.css";
import "./workspace.css";
import "@/styles/legacy/restyle.css";
import "../nav-shared.css";
import "../shell.css";

export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: "Voice Labs Workspace", template: "%s · Voice Labs" },
};

/**
 * Root layout for the workspace pages ported from the previous app. Their page content keeps its own
 * components and CSS, restyled through styles/legacy/restyle.css; the nav and footer are the new shell,
 * kept outside .dash-root so the previous app's element styles never reach them.
 */
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootHtml fonts={siteFonts}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <WorkspaceNav />
      <div className="dash-root">
        <CommandPalette />
        <div id="main-content" tabIndex={-1} className="dash-content">{children}</div>
      </div>
      <WorkspaceFooter />
    </RootHtml>
  );
}
