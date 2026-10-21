"use client";

import { WorkspaceNav } from "@/components/workspace/workspace-nav";

/**
 * Header for the call pages when no call is live (setup, ended): the workspace nav, so people can leave
 * /call for any page. The live call screen keeps its own header without navigation: leaving the page
 * would drop the call, so End is the way out.
 */
export function CallNav() {
  return <WorkspaceNav />;
}
