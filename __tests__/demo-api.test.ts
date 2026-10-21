import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/demo/session/route";
import { demoAgentId, memoryLimit, sameOrigin } from "@/lib/demo/server";

const AGENT = "11111111-1111-4111-8111-111111111111";
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/demo/session", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.stubEnv("DEMO_AGENTS", JSON.stringify({ concierge: AGENT }));
  vi.stubEnv("PLATFORM_URL", "http://platform.test");
  vi.stubEnv("PLATFORM_API_KEY", "admin-key");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("demo session route", () => {
  it("creates a Platform session server-side and returns only what the browser needs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ session_id: "s1", connection_status: "configured", connection: { url: "wss://lk", token: "jwt" }, session_token: "vls_abc", room_name: "r", conversation_id: "c" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ agentId: "concierge" }, { "x-forwarded-for": "1.1.1.1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "wss://lk", token: "jwt", sessionId: "s1", endToken: "vls_abc", maxSeconds: 180 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://platform.test/voice/sessions");
    expect(JSON.parse(init.body)).toEqual({ agent_id: AGENT });
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer admin-key");
  });

  it("only starts allow-listed agents", async () => {
    const res = await POST(req({ agentId: AGENT }, { "x-forwarded-for": "2.2.2.2" }));
    expect(res.status).toBe(404);
  });

  it("returns 503 when LiveKit is not configured on the Platform", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ session_id: "s1", connection_status: "not_configured", connection: { url: "", token: "" } })));
    const res = await POST(req({ agentId: "concierge" }, { "x-forwarded-for": "3.3.3.3" }));
    expect(res.status).toBe(503);
  });

  it("rejects cross-site requests", async () => {
    const res = await POST(req({ agentId: "concierge" }, { origin: "https://evil.example", "x-forwarded-for": "4.4.4.4" }));
    expect(res.status).toBe(403);
  });

  it("rate-limits per IP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await POST(req({ agentId: "concierge" }, { "x-forwarded-for": "5.5.5.5" }))).status);
    expect(codes).toEqual([503, 503, 503, 503, 429]);
  });
});

describe("helpers", () => {
  it("memory limiter uses a sliding 60 s window", () => {
    for (let i = 0; i < 4; i++) expect(memoryLimit("k", 1000 + i)).toBe(true);
    expect(memoryLimit("k", 2000)).toBe(false);
    expect(memoryLimit("k", 62_000)).toBe(true);
  });
  it("same-origin check", () => {
    expect(sameOrigin(new Request("http://a.test/x", { headers: { origin: "http://a.test" } }))).toBe(true);
    expect(sameOrigin(new Request("http://a.test/x", { headers: { origin: "http://b.test" } }))).toBe(false);
  });
  it("agent map", () => {
    expect(demoAgentId("concierge")).toBe(AGENT);
    expect(demoAgentId("nope")).toBeNull();
    expect(demoAgentId(42)).toBeNull();
  });
});
