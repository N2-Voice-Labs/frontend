import { allowRequest, clientIp, createDemoSession, demoAgentId, sameOrigin } from "@/lib/demo/server";

/**
 * POST /api/demo/session  { agentId: "concierge" }  →  { url, token, sessionId, endToken, maxSeconds }
 * Public: same-origin only, rate-limited per IP, and limited to the agents in DEMO_AGENTS.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!(await allowRequest(clientIp(request)))) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  }
  const body = (await request.json().catch(() => null)) as { agentId?: unknown } | null;
  const agentId = demoAgentId(body?.agentId);
  if (!agentId) return Response.json({ error: "unknown_agent" }, { status: 404 });
  try {
    const session = await createDemoSession(agentId);
    if (!session) return Response.json({ error: "unavailable" }, { status: 503 });
    return Response.json(session, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
