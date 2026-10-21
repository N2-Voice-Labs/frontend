"use client";

import { useCallback } from "react";
import { getAgentTools, getTools, setAgentTools } from "@/lib/tools";
import { useResource } from "@/lib/use-resource";
import { AssignmentPanel } from "./assignment-panel";

export function AgentToolsPanel({ agentId }: Readonly<{ agentId: string }>) {
  const all = useResource(getTools);
  const assigned = useResource(useCallback(() => getAgentTools(agentId), [agentId]));
  const items = all.data?.map((tool) => ({ id: tool.id, title: tool.name, note: tool.description, enabled: tool.enabled })) ?? null;
  return <AssignmentPanel
    title="Tools"
    intro="Choose what this agent is allowed to do during a call, such as checking availability or booking a slot."
    items={items}
    assignedIds={assigned.data?.map((tool) => tool.id) ?? null}
    loadError={all.error || assigned.error}
    save={(ids) => setAgentTools(agentId, ids)}
    manageHref="/tools"
    manageLabel="Manage tools"
    soon="toolExecution" />;
}
