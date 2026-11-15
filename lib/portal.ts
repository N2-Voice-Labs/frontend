import { request, withBearer, type ConversationMessage, type VoiceSession } from "./platform";

/**
 * Platform routes behind the customer portal (the Inha Admissions demo): a public demo agent, the
 * human handoff into a translated call, the staff queue, and text chat. All generic on the Platform side
 * (`/demo/agents/{key}`, `/handoffs`, `/staff/handoffs`); the portal only chooses the agent key.
 */

/** Platform `PLATFORM_DEMO_AGENTS` key of the portal's assistant. */
export const PORTAL_AGENT_KEY = process.env.NEXT_PUBLIC_PORTAL_AGENT_KEY ?? "inha-admissions";
/** Language the admissions officer speaks; the student picks their own. */
export const STAFF_LANGUAGE = process.env.NEXT_PUBLIC_STAFF_LANGUAGE ?? "ko";

export type DemoAgent = { key: string; name: string; description: string; enabled_languages: string[] };

export const getDemoAgent = (key = PORTAL_AGENT_KEY) => request<DemoAgent>(`/demo/agents/${encodeURIComponent(key)}`);

/** Opens an AI voice session (same reply as `POST /voice/sessions`). */
export const startDemoSession = (name?: string | null, key = PORTAL_AGENT_KEY) =>
  request<VoiceSession>(`/demo/agents/${encodeURIComponent(key)}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: name || null }),
  });

/** The student's side of a handoff: their connection to the new translated call (like `POST /calls`). */
export type Handoff = VoiceSession & { handoff_id: string };

/**
 * Ends the AI session and opens a translated call that waits for staff. Authorised by the AI session's own
 * token, so only the student who is in that session can ask.
 */
export const createHandoff = (
  body: { session_id: string; language: string; staff_language?: string; name?: string | null; reason?: string | null },
  sessionToken?: string | null,
) =>
  request<Handoff>(
    "/handoffs",
    withBearer({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ staff_language: STAFF_LANGUAGE, ...body }) }, sessionToken),
  );

export type StaffHandoff = {
  id: string;
  status: "waiting" | "accepted" | "ended" | "expired";
  requester_name: string | null;
  requester_language: string;
  staff_language: string;
  reason: string | null;
  created_at: string;
  call_session_id: string;
  from_conversation_id: string | null;
};

const staff = (key: string, init?: RequestInit): RequestInit => ({ ...init, headers: { ...(init?.headers ?? {}), "x-staff-key": key } });

export const listStaffHandoffs = (key: string, signal?: AbortSignal) =>
  request<StaffHandoff[]>("/staff/handoffs", { ...staff(key), signal });

/** Claims a waiting student. The code goes straight into the existing `/join` flow. */
export const acceptHandoff = (key: string, id: string) =>
  request<{ invite_code: string; call_session_id: string }>(`/staff/handoffs/${encodeURIComponent(id)}/accept`, staff(key, { method: "POST" }));

/** What the student and the AI said before the handoff. */
export const getHandoffTranscript = (key: string, id: string) =>
  request<ConversationMessage[]>(`/staff/handoffs/${encodeURIComponent(id)}/transcript`, staff(key));

/** A knowledge passage the answer cites as [n]; url is the official page it came from. */
export type ChatSource = { n: number; title: string; heading?: string; url?: string; snippet?: string };
export type ChatReply = { conversation_id: string; reply: string; handoff_suggested?: boolean; sources?: ChatSource[] };

export const sendDemoChat = (message: string, conversationId?: string | null, key = PORTAL_AGENT_KEY) =>
  request<ChatReply>(`/demo/agents/${encodeURIComponent(key)}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, conversation_id: conversationId ?? null }),
  });
