import { sameOrigin } from "@/lib/demo/server";

/**
 * /api/platform/*: the workspace's way to the Platform. This server adds the Platform API key
 * (the PLATFORM_API_KEY secret), so the workspace works without anyone typing a key and the key
 * never reaches the browser. A request that already carries its own token keeps it.
 * Same-origin only, and only the Platform areas the workspace uses.
 */
const ALLOWED = new Set([
  "agents", "agent-templates", "analytics", "calls", "campaigns", "conversations",
  "deployments", "knowledge", "providers", "tools", "voice", "voices",
]);
const PASS_REQUEST = ["content-type", "accept"];
const PASS_RESPONSE = ["content-type", "content-disposition", "retry-after"];

async function proxy(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!sameOrigin(request)) return Response.json({ detail: "forbidden" }, { status: 403 });
  const { path } = await ctx.params;
  if (!path?.length || !ALLOWED.has(path[0])) return Response.json({ detail: "not_found" }, { status: 404 });
  const base = (process.env.PLATFORM_URL ?? "").replace(/\/$/, "");
  if (!base) return Response.json({ detail: "platform_not_configured" }, { status: 503 });

  const headers = new Headers();
  for (const name of PASS_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const own = request.headers.get("authorization");
  const key = process.env.PLATFORM_API_KEY;
  if (own) headers.set("authorization", own);
  else if (key) headers.set("authorization", `Bearer ${key}`);

  const target = `${base}/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  let upstream: Response;
  try {
    // Voice clone uploads can take a while at the provider.
    upstream = await fetch(target, { method: request.method, headers, body, cache: "no-store", signal: AbortSignal.timeout(90_000) });
  } catch {
    return Response.json({ detail: "platform_unreachable" }, { status: 502 });
  }
  const out = new Headers({ "cache-control": "no-store" });
  for (const name of PASS_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}

export { proxy as DELETE, proxy as GET, proxy as PATCH, proxy as POST, proxy as PUT };
