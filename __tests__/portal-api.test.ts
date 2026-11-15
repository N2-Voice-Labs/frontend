import { afterEach, expect, test, vi } from "vitest";
import { acceptHandoff, createHandoff, getDemoAgent, getHandoffTranscript, listStaffHandoffs, sendDemoChat, startDemoSession } from "@/lib/portal";

afterEach(() => vi.restoreAllMocks());

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const call = (spy: ReturnType<typeof vi.spyOn>) => {
  const [url, init] = spy.mock.calls.at(-1) as [string, RequestInit];
  return { url: String(url), init, header: (name: string) => new Headers(init.headers).get(name), body: init.body ? JSON.parse(String(init.body)) : undefined };
};

test("the demo agent routes use the portal's agent key and need no credentials", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => ok({}));
  await getDemoAgent();
  expect(call(spy).url).toMatch(/\/demo\/agents\/inha-admissions$/);
  await startDemoSession("Aigerim");
  const started = call(spy);
  expect(started.url).toMatch(/\/demo\/agents\/inha-admissions\/sessions$/);
  expect(started.init.method).toBe("POST");
  expect(started.body).toEqual({ name: "Aigerim" });
  expect(started.header("authorization")).toBeNull();
});

test("a handoff is authorised by the AI session's own token and defaults the officer to Korean", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => ok({ handoff_id: "h1" }));
  await createHandoff({ session_id: "s1", language: "en", name: null }, "vls_abc");
  const { url, init, header, body } = call(spy);
  expect(url).toMatch(/\/handoffs$/);
  expect(init.method).toBe("POST");
  expect(header("authorization")).toBe("Bearer vls_abc");
  expect(body).toEqual({ staff_language: "ko", session_id: "s1", language: "en", name: null });
});

test("staff routes send the staff key header and never a bearer token", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => ok([]));
  await listStaffHandoffs("k1");
  expect(call(spy).url).toMatch(/\/staff\/handoffs$/);
  expect(call(spy).header("x-staff-key")).toBe("k1");
  await acceptHandoff("k1", "h/1");
  expect(call(spy).url).toMatch(/\/staff\/handoffs\/h%2F1\/accept$/);
  expect(call(spy).init.method).toBe("POST");
  expect(call(spy).header("authorization")).toBeNull();
  await getHandoffTranscript("k1", "h1");
  expect(call(spy).url).toMatch(/\/staff\/handoffs\/h1\/transcript$/);
});

test("chat continues an existing conversation when given its id", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => ok({ conversation_id: "c1", reply: "Hi" }));
  await sendDemoChat("What documents do I need?");
  expect(call(spy).body).toEqual({ message: "What documents do I need?", conversation_id: null });
  await sendDemoChat("And deadlines?", "c1");
  expect(call(spy).url).toMatch(/\/demo\/agents\/inha-admissions\/chat$/);
  expect(call(spy).body).toEqual({ message: "And deadlines?", conversation_id: "c1" });
});

test("a refused staff key surfaces as a 401 the console can sign out on", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ detail: "invalid_staff_key" }), { status: 401 }));
  await expect(listStaffHandoffs("bad")).rejects.toMatchObject({ status: 401, message: "invalid_staff_key" });
});
