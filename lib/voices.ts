import { request } from "./platform";

export type VoiceStatus = "pending" | "processing" | "ready" | "failed" | "disabled";
export type VoiceSource = "library" | "clone" | "design";
export type VoiceStyle = { energy?: number; warmth?: number; speed?: number; style?: string };
export type VoiceConsentInput = { confirmed: boolean; subject_name: string; statement: string; method: "self" | "authorized" };

export type Voice = {
  id: string;
  name: string;
  source: VoiceSource;
  status: VoiceStatus;
  tts_provider_id: string | null;
  provider_voice_id: string | null;
  languages: string[];
  style: VoiceStyle;
  design_prompt: string | null;
  sample_reference: string | null;
  consent: (VoiceConsentInput & { recorded_at?: string }) | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type Base = { name: string; tts_provider_id?: string | null; languages: string[]; style?: VoiceStyle };
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const getVoices = (filter: { status?: VoiceStatus; source?: VoiceSource } = {}) => {
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value) as [string, string][]).toString();
  return request<Voice[]>(`/voices${query ? `?${query}` : ""}`);
};
export const getVoice = (id: string) => request<Voice>(`/voices/${encodeURIComponent(id)}`);
/** Consent is required: the Platform answers `voice_consent_required` without a confirmed consent. */
export const cloneVoice = (input: Base & { sample_reference: string; consent: VoiceConsentInput }) => request<Voice>("/voices/clone", json("POST", input));
export const designVoice = (input: Base & { design_prompt: string }) => request<Voice>("/voices/design", json("POST", input));
export const updateVoice = (id: string, patch: { name?: string; languages?: string[]; style?: VoiceStyle }) => request<Voice>(`/voices/${encodeURIComponent(id)}`, json("PATCH", patch));
export const setVoiceStatus = (id: string, status: VoiceStatus, extra: { provider_voice_id?: string; failure_reason?: string } = {}) =>
  request<Voice>(`/voices/${encodeURIComponent(id)}/status`, json("POST", { status, ...extra }));
/** The Platform disables rather than deletes, so agents that use the voice keep a record of it. */
export const disableVoice = (id: string) => request<void>(`/voices/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Statuses a person can move a voice to from the UI (a provider moves it through processing → ready). */
export const voiceActions: Partial<Record<VoiceStatus, { to: VoiceStatus; label: string }>> = {
  ready: { to: "disabled", label: "Disable" },
  disabled: { to: "ready", label: "Enable" },
  failed: { to: "pending", label: "Retry" },
};

/**
 * PROPOSED contract for the Runtime's voice preview (not built yet; see lib/capabilities.ts → voicePreview).
 * Adjust the path and body to match the endpoint when it ships. Returns audio to play.
 */
export async function previewVoice(id: string, text: string): Promise<Blob> {
  const base = process.env.NEXT_PUBLIC_PLATFORM_URL ?? "http://localhost:8000";
  const response = await fetch(`${base}/voices/${encodeURIComponent(id)}/preview`, { ...json("POST", { text }), cache: "no-store" });
  if (!response.ok) throw Object.assign(new Error(`Platform returned ${response.status}`), { status: response.status });
  return response.blob();
}
