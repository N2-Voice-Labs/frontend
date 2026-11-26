import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/platform/[...path]/route";
import { getAgents, platformBase } from "@/lib/platform";

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sentAuth = (spy: ReturnType<typeof vi.spyOn>) =>
  new Headers((spy.mock.calls[0][1] as RequestInit).headers).get("authorization");

beforeEach(() => {
  vi.stubEnv("PLATFORM_URL", "https://platform.test");
  vi.stubEnv("PLATFORM_API_KEY", "server-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

test("adds the server's Platform key and forwards the query", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json([{ id: "a1" }]));
  const res = await GET(new Request("https://site.test/api/platform/agents?limit=5"), ctx("agents"));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual([{ id: "a1" }]);
  expect(spy.mock.calls[0][0]).toBe("https://platform.test/agents?limit=5");
  expect(sentAuth(spy)).toBe("Bearer server-key");
});

test("keeps a request's own token", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({}));
  await GET(new Request("https://site.test/api/platform/conversations/c1", { headers: { authorization: "Bearer vls_x" } }), ctx("conversations", "c1"));
  expect(sentAuth(spy)).toBe("Bearer vls_x");
});

test("forwards a multipart upload body", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ id: "v1" }, 201));
  const form = new FormData();
  form.set("name", "Me");
  const res = await POST(new Request("https://site.test/api/platform/voices/clone/upload", { method: "POST", body: form }), ctx("voices", "clone", "upload"));
  expect(res.status).toBe(201);
  const init = spy.mock.calls[0][1] as RequestInit;
  expect(new Headers(init.headers).get("content-type")).toMatch(/^multipart\/form-data/);
  expect(init.body).toBeInstanceOf(ArrayBuffer);
});

test("refuses other Platform areas and other sites", async () => {
  const spy = vi.spyOn(globalThis, "fetch");
  expect((await GET(new Request("https://site.test/api/platform/api-keys"), ctx("api-keys"))).status).toBe(404);
  const cross = new Request("https://site.test/api/platform/agents", { headers: { origin: "https://evil.test" } });
  expect((await GET(cross, ctx("agents"))).status).toBe(403);
  expect(spy).not.toHaveBeenCalled();
});

test("workspace pages use the proxy, other pages call the Platform directly", async () => {
  window.history.replaceState(null, "", "/agents");
  expect(platformBase()).toBe("/api/platform");
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json([]));
  await getAgents();
  expect(spy.mock.calls[0][0]).toBe("/api/platform/agents");
  window.history.replaceState(null, "", "/inha");
  expect(platformBase()).not.toBe("/api/platform");
});
