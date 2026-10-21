const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL ?? "http://localhost:8000";

export type VoiceSession = {
  session_id: string;
  conversation_id: string;
  room_name: string;
  connection_status: "configured" | "not_configured";
  runtime_status: string;
  connection: { url: string; token: string };
  /**
   * Bearer token scoped to this session (`vls_…`). Lets the creator read the conversation and end the
   * session on an auth-enabled Platform. Optional: an older Platform does not return it.
   */
  session_token?: string;
};

/** `interpreter` block of an agent with `mode: "interpreter"` (backend `InterpreterConfig`). */
export type InterpreterConfig = {
  /** Exactly two distinct interpreter languages (lib/languages.ts `interpreterLanguages`). */
  languages: string[];
  /** `auto` only when both languages can code-switch; Korean, Chinese, Turkish and Polish need `one_way`. */
  direction?: "auto" | "one_way";
  /** Two-person calls need `cascaded`. Always send it: `instant` pace silently picks `realtime` otherwise. */
  engine?: "cascaded" | "realtime";
  /** UI word: "Translation pace" (Fast / Balanced / Careful). */
  latency_mode?: "instant" | "balanced" | "accurate";
  /** UI words: "Also hear their real voice". */
  hear_original?: boolean;
  glossary?: Array<Record<string, unknown>>;
};

/** A person in a two-person interpreter call (backend `ParticipantIn`). */
export type SessionParticipantInput = {
  /** Must be one of the interpreter's two languages, and differ from the other person's. */
  language: string;
  /** A ready voice from the Voice library; their translated words are spoken in it. */
  voice_profile_id?: string | null;
  /** Max 100 characters. Names the speaker in the other person's transcript. */
  display_name?: string | null;
};

/** `POST /voice/sessions/{id}/participants`: the guest's own LiveKit connection and session token. */
export type SessionParticipant = {
  participant_identity: string;
  connection: { url: string; token: string };
  session_token: string;
};

export type VoiceSessionDetail = {
  id: string;
  conversation_id: string;
  status: string;
  room_name: string;
  transport?: string;
  started_at: string | null;
  ended_at: string | null;
};

export type Agent = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  enabled_languages: string[];
  stt_provider_id: string | null;
  llm_provider_id: string | null;
  tts_provider_id: string | null;
  voice_id: string | null;
  /** The shared voice from the Voice library (`/voices`) this agent speaks with. */
  voice_profile_id?: string | null;
  /** Optional so older Platform responses and test fixtures still type-check; absent means "agent". */
  mode?: "agent" | "interpreter";
  interpreter?: InterpreterConfig | null;
  /** Agent + translator config (backend TR-040); absent for ordinary agents. */
  translation?: Record<string, unknown> | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type ProviderConfig = {
  id: string;
  kind: "stt" | "llm" | "tts";
  provider: string;
  enabled: boolean;
};

/** A recorded result of a call. The Platform accepts exactly these values (`OUTCOMES`). */
export type ConversationAction = { type?: string; reason?: string | null; target?: string | null; [key: string]: unknown };

export type Conversation = {
  id: string;
  agent_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  // Added by the outcomes work; optional so an older Platform response still type-checks.
  deployment_id?: string | null;
  channel?: string | null;
  outcome?: string | null;
  summary?: string | null;
  intent?: string | null;
  actions?: ConversationAction[];
  outcome_recorded_at?: string | null;
  metadata?: Record<string, unknown>;
};

export type ConversationMessage = {
  id: string;
  role: string;
  content: string;
  primary_language: string | null;
  detected_languages: string[];
  created_at: string;
};

export type ConversationRuntimeEvent = {
  event_id: string;
  event_type: string;
  schema_version: number;
  payload: Record<string, unknown>;
  received_at: string;
};

export type ConversationRuntimeState = {
  session_id: string | null;
  session_status: string | null;
  events: ConversationRuntimeEvent[];
};

/**
 * Adds `Authorization: Bearer <token>` for session-scoped routes. Without a token the init is returned
 * unchanged, so existing calls send exactly what they sent before (no CORS preflight added).
 */
export function withBearer(init: RequestInit | undefined, token?: string | null): RequestInit | undefined {
  if (!token) return init;
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/** The one place that talks to the Platform. Every other `lib/*` module builds on it. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${platformUrl}${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    let detail = `Platform returned ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
      // FastAPI validation errors arrive as a list of { loc, msg }.
      else if (Array.isArray(body.detail)) detail = body.detail.map((item: { loc?: unknown[]; msg?: string }) => [item.loc?.filter((part) => part !== "body").join("."), item.msg].filter(Boolean).join(": ")).join("; ") || detail;
    } catch {
      // Keep the status message when the server did not return JSON.
    }
    throw Object.assign(new Error(detail), { status: response.status });
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const getAgents = () => request<Agent[]>("/agents");
export const getAgent = (id: string) => request<Agent>(`/agents/${encodeURIComponent(id)}`);
export const getProviders = () => request<ProviderConfig[]>("/providers");
export const saveAgent = (data: Partial<Agent> & Pick<Agent, "name">, id?: string) =>
  request<Agent>(id ? `/agents/${id}` : "/agents", {
    method: id ? "PATCH" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
export const getConversations = () => request<Conversation[]>("/conversations");
// The optional `token` is a session token (creator or guest); see `withBearer`.
// `signal` lets the call poll abort a hung request (timeout) and stop on unmount.
const withSignal = (init: RequestInit | undefined, signal?: AbortSignal) => (signal ? { ...init, signal } : init);
export const getConversation = (id: string, token?: string | null, signal?: AbortSignal) =>
  request<Conversation>(`/conversations/${encodeURIComponent(id)}`, withSignal(withBearer(undefined, token), signal));
export const getConversationRuntimeState = (id: string, token?: string | null) =>
  request<ConversationRuntimeState>(`/conversations/${encodeURIComponent(id)}/runtime-state`, withBearer(undefined, token));
export const getMessages = (id: string, token?: string | null, signal?: AbortSignal) =>
  request<ConversationMessage[]>(`/conversations/${encodeURIComponent(id)}/messages`, withSignal(withBearer(undefined, token), signal));
export const endVoiceSession = (id: string, token?: string | null) =>
  request<{ status: string }>(`/voice/sessions/${encodeURIComponent(id)}/end`, withBearer({ method: "POST" }, token));
export const ensureVoiceSessionRunning = (id: string, token?: string | null, signal?: AbortSignal) => request<{ session_status: string; runtime_status: string }>(
  `/voice/sessions/${encodeURIComponent(id)}/ensure-running`,
  withSignal(withBearer({ method: "POST" }, token), signal),
);
export const getVoiceSession = (id: string, token?: string | null) =>
  request<VoiceSessionDetail>(`/voice/sessions/${encodeURIComponent(id)}`, withBearer(undefined, token));

/**
 * Creates a voice session. Pass `participant` to start a two-person interpreter call as its creator
 * (the agent must be a cascaded interpreter, and `language` one of its two languages).
 */
export async function createVoiceSession(agentId: string, participant?: SessionParticipantInput): Promise<VoiceSession> {
  return request<VoiceSession>("/voice/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(participant ? { agent_id: agentId, participant } : { agent_id: agentId }),
  });
}

/**
 * Adds the second person to a two-person call (creator only). Uses up the session's only guest slot
 * at once, even if nobody joins with the returned token (409 `session_full` on a second try).
 */
export const addSessionParticipant = (sessionId: string, participant: SessionParticipantInput, token?: string | null) =>
  request<SessionParticipant>(
    `/voice/sessions/${encodeURIComponent(sessionId)}/participants`,
    withBearer({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(participant) }, token),
  );

/** Records how a call ended. `outcome` must be one of `OUTCOMES` (lib/outcomes.ts). */
export const setConversationOutcome = (id: string, body: { outcome: string; summary?: string | null; intent?: string | null; actions?: ConversationAction[] | null }) =>
  request<Conversation>(`/conversations/${encodeURIComponent(id)}/outcome`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
