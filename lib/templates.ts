import { request } from "./platform";

export type AgentTemplate = {
  key: string;
  name: string;
  description: string;
  system_prompt: string;
  enabled_languages: string[];
  suggested_tools: string[];
};

export type AgentFromTemplate = { id: string; name: string; description: string; system_prompt: string; enabled_languages: string[]; status: string; template_key: string };

export const getAgentTemplates = () => request<AgentTemplate[]>("/agent-templates");
/** One call creates the agent; every field is optional and overrides the template's. */
export const createAgentFromTemplate = (key: string, overrides: { name?: string; description?: string; system_prompt?: string; enabled_languages?: string[] } = {}) =>
  request<AgentFromTemplate>(`/agent-templates/${encodeURIComponent(key)}/agents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(overrides) });
