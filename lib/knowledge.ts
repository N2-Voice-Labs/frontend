import { request } from "./platform";

export type KnowledgeDocument = { id: string; title: string; source: string; content_length: number; metadata: Record<string, unknown>; version: number; enabled: boolean; created_at: string; updated_at: string };

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const getDocuments = () => request<KnowledgeDocument[]>("/knowledge/documents");
export const createDocument = (input: { title: string; source?: string; content: string }) => request<KnowledgeDocument>("/knowledge/documents", json("POST", input));
export const updateDocument = (id: string, patch: { title?: string; enabled?: boolean }) => request<KnowledgeDocument>(`/knowledge/documents/${encodeURIComponent(id)}`, json("PATCH", patch));
export const deleteDocument = (id: string) => request<void>(`/knowledge/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
export const getAgentKnowledge = (agentId: string) => request<KnowledgeDocument[]>(`/agents/${encodeURIComponent(agentId)}/knowledge`);
/** Replaces the agent's whole set. */
export const setAgentKnowledge = (agentId: string, documentIds: string[]) => request<KnowledgeDocument[]>(`/agents/${encodeURIComponent(agentId)}/knowledge`, json("PUT", { document_ids: documentIds }));

export const MAX_CONTENT_CHARS = 1_000_000;
