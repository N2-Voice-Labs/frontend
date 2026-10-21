/**
 * Server side of the public demo, imported only by app/api route handlers. Talks to the Platform with a
 * server-only key, so nothing secret reaches the browser. Only agents listed in DEMO_AGENTS can be started.
 */

export const DEMO_MAX_SECONDS = 180;

type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

/* ---------- Per-IP rate limit ---------- */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 4; // keep in step with wrangler.jsonc "ratelimits"
const memoryHits = new Map<string, number[]>();

/** In-memory sliding window. Per process/isolate only: the fallback for `next dev` and `next start`. */
export function memoryLimit(key: string, now = Date.now()) {
  const recent = (memoryHits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    memoryHits.set(key, recent);
    return false;
  }
  recent.push(now);
  memoryHits.set(key, recent);
  if (memoryHits.size > 10_000) memoryHits.clear(); // bound memory under a flood of distinct IPs
  return true;
}

/** Uses the Cloudflare rate-limit binding (shared across isolates) when deployed, memory otherwise. */
export async function allowRequest(ip: string) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const limiter = (env as unknown as { DEMO_RATE_LIMITER?: Limiter }).DEMO_RATE_LIMITER;
    if (limiter) return (await limiter.limit({ key: `demo:${ip}` })).success;
  } catch {
    // Not running on Cloudflare.
  }
  return memoryLimit(ip);
}

export function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

/** Rejects cross-site browser requests, so other sites can't spend our demo minutes. */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients are still covered by the rate limit
  try {
    return new URL(origin).host === new URL(request.url).host || origin === process.env.NEXT_PUBLIC_SITE_URL;
  } catch {
    return false;
  }
}

/* ---------- Platform ---------- */

export function demoAgentId(slug: unknown): string | null {
  if (typeof slug !== "string") return null;
  try {
    const map = JSON.parse(process.env.DEMO_AGENTS ?? "{}") as Record<string, unknown>;
    const id = map[slug];
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

function platform(path: string, init: RequestInit, bearer?: string) {
  const base = (process.env.PLATFORM_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("PLATFORM_URL is not configured");
  const headers = new Headers(init.headers);
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return fetch(`${base}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
}

type PlatformSession = {
  session_id: string;
  connection_status: "configured" | "not_configured";
  connection: { url: string; token: string };
  session_token?: string;
};

export type DemoSessionResponse = { url: string; token: string; sessionId: string; endToken?: string; maxSeconds: number };

/** Creates a Platform voice session (room + agent dispatch) and returns only what the browser needs. */
export async function createDemoSession(agentId: string): Promise<DemoSessionResponse | null> {
  const res = await platform("/voice/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: agentId }),
  }, process.env.PLATFORM_API_KEY || undefined);
  if (!res.ok) return null;
  const s = (await res.json()) as PlatformSession;
  if (s.connection_status !== "configured" || !s.connection?.url || !s.connection?.token) return null;
  return { url: s.connection.url, token: s.connection.token, sessionId: s.session_id, endToken: s.session_token, maxSeconds: DEMO_MAX_SECONDS };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ends a session with its own session-scoped token (only the visitor who started it has it). */
export async function endDemoSession(sessionId: unknown, endToken: unknown) {
  if (typeof sessionId !== "string" || !UUID.test(sessionId) || typeof endToken !== "string" || !endToken.startsWith("vls_")) return false;
  const res = await platform(`/voice/sessions/${sessionId}/end`, { method: "POST" }, endToken);
  return res.ok;
}
