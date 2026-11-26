import type { Metadata } from "next";
import { DotSpotlight } from "@/components/shared/dot-spotlight";
import { RootHtml } from "@/components/shared/root-html";
import { WorkspaceFooter } from "@/components/workspace/workspace-footer";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { siteFonts } from "@/lib/fonts/site";
import { baseMetadata } from "@/lib/site-metadata";
import "../tokens.css";
import "../nav-shared.css";
import "../shell.css";
import "./workspace.css";

export const metadata: Metadata = { ...baseMetadata, title: "Voice Labs Workspace" };

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootHtml fonts={siteFonts}>
      <WorkspaceNav />
      {children}
      <WorkspaceFooter />
      {/* The agents page texture fades out sideways, so it lights up anywhere along its rows. */}
      <DotSpotlight selector=".page-bg" rows />
    </RootHtml>
  );
}
