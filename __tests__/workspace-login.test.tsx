import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET as proxyGet } from "@/app/api/platform/[...path]/route";
import { DELETE, GET, POST } from "@/app/api/workspace/login/route";
import { WorkspaceLogin } from "@/components/workspace/workspace-login";
import { createSession, isSignedIn, SESSION_SECONDS } from "@/lib/workspace-auth";

const SITE = "https://site.test";
const login = (password: unknown, ip = "1.1.1.1") =>
  POST(new Request(`${SITE}/api/workspace/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ password }),
  }));
const withCookie = (path: string, cookie: string) => new Request(`${SITE}${path}`, { headers: { cookie } });
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

beforeEach(() => {
  vi.stubEnv("WORKSPACE_PASSWORD", "team-pass");
  vi.stubEnv("PLATFORM_URL", "https://platform.test");
  vi.stubEnv("PLATFORM_API_KEY", "server-key");
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

test("the right password sets an HttpOnly session cookie that opens the proxy", async () => {
  const res = await login("team-pass", "10.0.0.1");
  expect(res.status).toBe(204);
  expect(res.headers.get("set-cookie")).toMatch(/ws_session=\d+\.[0-9a-f]{64}; Path=\/; HttpOnly; SameSite=Lax/);

  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));
  const ok = await proxyGet(withCookie("/api/platform/agents", cookieOf(res)), { params: Promise.resolve({ path: ["agents"] }) });
  expect(ok.status).toBe(200);
  expect(spy).toHaveBeenCalledOnce();
  expect(await (await GET(withCookie("/api/workspace/login", cookieOf(res)))).json()).toEqual({ signedIn: true, configured: true });
});

test("a wrong password is refused and the proxy stays closed", async () => {
  expect((await login("nope", "10.0.0.2")).status).toBe(401);
  const spy = vi.spyOn(globalThis, "fetch");
  const res = await proxyGet(new Request(`${SITE}/api/platform/agents`), { params: Promise.resolve({ path: ["agents"] }) });
  expect(res.status).toBe(401);
  expect(spy).not.toHaveBeenCalled();
});

test("tampered, expired or old-password cookies are refused", async () => {
  const now = Date.now();
  const good = await createSession(now);
  const req = (value: string) => withCookie("/", `ws_session=${value}`);
  expect(await isSignedIn(req(good), now)).toBe(true);
  expect(await isSignedIn(req(good.replace(/.$/, (c) => (c === "0" ? "1" : "0"))), now)).toBe(false);
  expect(await isSignedIn(req(good), now + (SESSION_SECONDS + 1) * 1000)).toBe(false);
  vi.stubEnv("WORKSPACE_PASSWORD", "new-pass");
  expect(await isSignedIn(req(good), now)).toBe(false);
});

test("login attempts are rate-limited per IP", async () => {
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await login("wrong", "10.0.0.3")).status);
  expect(statuses.slice(0, 4)).toEqual([401, 401, 401, 401]);
  expect(statuses[4]).toBe(429);
});

test("without a password the workspace is locked in production and open in development", async () => {
  vi.stubEnv("WORKSPACE_PASSWORD", "");
  vi.stubEnv("NODE_ENV", "production");
  expect(await isSignedIn(new Request(SITE))).toBe(false);
  expect((await login("anything", "10.0.0.4")).status).toBe(503);
  vi.stubEnv("NODE_ENV", "development");
  expect(await isSignedIn(new Request(SITE))).toBe(true);
});

test("sign-out clears the cookie and cross-site logins are refused", async () => {
  const out = await DELETE(new Request(`${SITE}/api/workspace/login`, { method: "DELETE" }));
  expect(out.headers.get("set-cookie")).toMatch(/ws_session=; .*Max-Age=0/);
  const cross = new Request(`${SITE}/api/workspace/login`, { method: "POST", headers: { origin: "https://evil.test" }, body: "{}" });
  expect((await POST(cross)).status).toBe(403);
});

test("the screen asks for the password and opens after a correct one", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    if (!init?.method) return Response.json({ signedIn: false, configured: true });
    const { password } = JSON.parse(String(init.body)) as { password: string };
    return password === "team-pass" ? new Response(null, { status: 204 }) : Response.json({ error: "wrong_password" }, { status: 401 });
  });
  render(<WorkspaceLogin><p>inside</p></WorkspaceLogin>);
  const input = await screen.findByLabelText("Password");
  fireEvent.change(input, { target: { value: "bad" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });
  expect((await screen.findByRole("alert")).textContent).toBe("Wrong password.");
  fireEvent.change(input, { target: { value: "team-pass" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });
  expect(await screen.findByText("inside")).toBeTruthy();
});
