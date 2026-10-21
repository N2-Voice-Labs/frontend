import { request } from "./platform";

export type Channel = "web" | "sip" | "api";
export type DeploymentStatus = "active" | "paused" | "archived";

export type Deployment = {
  id: string;
  agent_id: string;
  name: string;
  channel: Channel;
  status: DeploymentStatus;
  phone_number: string | null;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const getDeployments = (filter: { agent_id?: string; channel?: Channel; status?: DeploymentStatus } = {}) => {
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value) as [string, string][]).toString();
  return request<Deployment[]>(`/deployments${query ? `?${query}` : ""}`);
};
/** A phone (SIP) deployment needs `phone_number` in E.164 form; other channels must not have one. Never put secrets in `configuration`. */
export const createDeployment = (input: { agent_id: string; name: string; channel: Channel; phone_number?: string | null; configuration?: Record<string, unknown> }) => request<Deployment>("/deployments", json("POST", input));
export const updateDeployment = (id: string, patch: { name?: string; status?: DeploymentStatus; phone_number?: string | null; configuration?: Record<string, unknown> }) => request<Deployment>(`/deployments/${encodeURIComponent(id)}`, json("PATCH", patch));
export const archiveDeployment = (id: string) => request<void>(`/deployments/${encodeURIComponent(id)}`, { method: "DELETE" });

export const E164 = /^\+[1-9]\d{6,14}$/;
export const channelOrder: Channel[] = ["web", "sip", "api"];
