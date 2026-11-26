import { allowRequest, clientIp, sameOrigin } from "@/lib/demo/server";
import { createSession, isSignedIn, loginDisabled, passwordMatches, sessionCookie, workspacePassword } from "@/lib/workspace-auth";

const noStore = { "cache-control": "no-store" };

/** GET /api/workspace/login → { signedIn, configured } */
export async function GET(request: Request) {
  return Response.json(
    { signedIn: await isSignedIn(request), configured: Boolean(workspacePassword()) || loginDisabled() },
    { headers: noStore },
  );
}

/** POST /api/workspace/login { password } → 204 with the session cookie, 401 for a wrong password. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!workspacePassword()) return Response.json({ error: "not_configured" }, { status: 503 });
  if (!(await allowRequest(clientIp(request), "workspace-login"))) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  }
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const typed = typeof body?.password === "string" ? body.password : "";
  if (!(await passwordMatches(typed))) return Response.json({ error: "wrong_password" }, { status: 401 });
  return new Response(null, { status: 204, headers: { ...noStore, "set-cookie": sessionCookie(await createSession()) } });
}

/** DELETE /api/workspace/login → signs out. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  return new Response(null, { status: 204, headers: { ...noStore, "set-cookie": sessionCookie("", 0) } });
}
