import { request } from "./platform";

export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";

export type Campaign = {
  id: string;
  name: string;
  agent_id: string;
  deployment_id: string;
  status: CampaignStatus;
  schedule_start: string | null;
  schedule_end: string | null;
  timezone: string;
  max_attempts: number;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
export type CampaignDetail = Campaign & { target_counts: Record<string, number> };
export type Target = { id: string; campaign_id: string; phone_number: string; name: string; variables: Record<string, unknown>; status: string; attempts: number; conversation_id: string | null; created_at: string; updated_at: string };
export type TargetInput = { phone_number: string; name?: string; variables?: Record<string, unknown> };

/** Mirrors the Platform's allowed moves so the UI only offers buttons that can succeed. */
export const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["draft", "running", "cancelled"],
  running: ["paused", "completed", "cancelled"],
  paused: ["running", "cancelled"],
  completed: [],
  cancelled: [],
};
export const EDITABLE: CampaignStatus[] = ["draft", "scheduled"];
export const TARGETS_EDITABLE: CampaignStatus[] = ["draft", "scheduled", "paused"];

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const getCampaigns = (filter: { agent_id?: string; status?: CampaignStatus } = {}) => {
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value) as [string, string][]).toString();
  return request<Campaign[]>(`/campaigns${query ? `?${query}` : ""}`);
};
export const getCampaign = (id: string) => request<CampaignDetail>(`/campaigns/${encodeURIComponent(id)}`);
export const createCampaign = (input: { name: string; agent_id: string; deployment_id: string; schedule_start?: string | null; schedule_end?: string | null; timezone?: string; max_attempts?: number }) => request<CampaignDetail>("/campaigns", json("POST", input));
export const updateCampaign = (id: string, patch: { name?: string; schedule_start?: string | null; schedule_end?: string | null; timezone?: string; max_attempts?: number }) => request<CampaignDetail>(`/campaigns/${encodeURIComponent(id)}`, json("PATCH", patch));
export const addTargets = (id: string, targets: TargetInput[]) => request<{ added: number; skipped_duplicates: number }>(`/campaigns/${encodeURIComponent(id)}/targets`, json("POST", { targets }));
export const getTargets = (id: string, options: { status?: string; limit?: number; offset?: number } = {}) => {
  const query = new URLSearchParams(Object.entries(options).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString();
  return request<Target[]>(`/campaigns/${encodeURIComponent(id)}/targets${query ? `?${query}` : ""}`);
};
export const setCampaignStatus = (id: string, status: CampaignStatus) => request<CampaignDetail>(`/campaigns/${encodeURIComponent(id)}/status`, json("POST", { status }));

/** Pasted lines like `+14155550123, Ada` → targets. Invalid lines come back separately so they can be shown. */
export function parseTargets(text: string, isValid: (phone: string) => boolean): { targets: TargetInput[]; invalid: string[] } {
  const targets: TargetInput[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [phone, ...rest] = line.split(/[,;\t]/).map((part) => part.trim());
    if (isValid(phone)) targets.push({ phone_number: phone, name: rest.join(", ") });
    else invalid.push(line);
  }
  return { targets, invalid };
}
