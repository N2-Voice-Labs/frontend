"use client";

import { useCallback } from "react";
import { getAgentKnowledge, getDocuments, setAgentKnowledge } from "@/lib/knowledge";
import { useResource } from "@/lib/use-resource";
import { AssignmentPanel } from "./assignment-panel";

export function AgentKnowledgePanel({ agentId }: Readonly<{ agentId: string }>) {
  const all = useResource(getDocuments);
  const assigned = useResource(useCallback(() => getAgentKnowledge(agentId), [agentId]));
  const items = all.data?.map((doc) => ({ id: doc.id, title: doc.title, note: `${doc.content_length.toLocaleString()} characters${doc.source ? ` · ${doc.source}` : ""}`, enabled: doc.enabled })) ?? null;
  return <AssignmentPanel
    title="Knowledge"
    intro="Choose the documents this agent should know about."
    items={items}
    assignedIds={assigned.data?.map((doc) => doc.id) ?? null}
    loadError={all.error || assigned.error}
    save={(ids) => setAgentKnowledge(agentId, ids)}
    manageHref="/knowledge"
    manageLabel="Manage documents"
    soon="knowledgeSearch" />;
}
