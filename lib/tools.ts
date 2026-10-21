import { request } from "./platform";

export type Tool = {
  id: string;
  name: string;
  description: string;
  tool_type: "http" | "builtin" | string;
  input_schema: Record<string, unknown>;
  configuration: Record<string, unknown>;
  enabled: boolean;
};

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const getTools = () => request<Tool[]>("/tools");
/** `name` must match ^[a-z][a-z0-9_]{0,63}$. Secrets never go in `configuration`. */
export const createTool = (input: { name: string; description: string; tool_type?: "http" | "builtin"; input_schema?: Record<string, unknown>; configuration?: Record<string, unknown>; enabled?: boolean }) => request<Tool>("/tools", json("POST", input));
export const updateTool = (id: string, patch: { description?: string; enabled?: boolean }) => request<Tool>(`/tools/${encodeURIComponent(id)}`, json("PATCH", patch));
export const deleteTool = (id: string) => request<void>(`/tools/${encodeURIComponent(id)}`, { method: "DELETE" });
export const getAgentTools = (agentId: string) => request<Tool[]>(`/agents/${encodeURIComponent(agentId)}/tools`);
/** Replaces the agent's whole set. */
export const setAgentTools = (agentId: string, toolIds: string[]) => request<Tool[]>(`/agents/${encodeURIComponent(agentId)}/tools`, json("PUT", { tool_ids: toolIds }));

export const TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;
