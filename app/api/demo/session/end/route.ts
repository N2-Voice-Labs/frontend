import { endDemoSession, sameOrigin } from "@/lib/demo/server";

/** POST /api/demo/session/end  { sessionId, endToken }. Best effort; the browser does not wait for it. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown; endToken?: unknown } | null;
  try {
    const ok = await endDemoSession(body?.sessionId, body?.endToken);
    return new Response(null, { status: ok ? 204 : 400 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
