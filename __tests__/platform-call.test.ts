import { afterEach, expect, test, vi } from "vitest";
import { interpreterAgentBody, matchesInterpreter, resolveInterpreter } from "@/lib/interpreter";
import { interpreterDirection, interpreterLanguages, languageLabel } from "@/lib/languages";
import {
  addSessionParticipant,
  createVoiceSession,
  endVoiceSession,
  getConversation,
  getVoiceSession,
  withBearer,
  type Agent,
} from "@/lib/platform";

afterEach(() => vi.restoreAllMocks());

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const lastInit = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.at(-1)?.[1] as RequestInit;
const header = (init: RequestInit, name: string) => new Headers(init.headers).get(name);

test("the language list matches the backend's 14 interpreter languages, with native names", () => {
  expect(interpreterLanguages.map((item) => item.id).sort()).toEqual(["de", "en", "es", "fr", "hi", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "zh"]);
  expect(languageLabel("ko")).toBe("Korean · 한국어");
  expect(languageLabel("en")).toBe("English");
  expect(interpreterDirection("en", "ru")).toBe("auto");
  expect(interpreterDirection("ko", "en")).toBe("one_way");
});

test("createVoiceSession sends the creator participant when given, and only agent_id otherwise", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ session_id: "s1", session_token: "vls_x" }));
  await createVoiceSession("a1", { language: "ko", display_name: "Ji-woo" });
  expect(JSON.parse(String(lastInit(fetchSpy).body))).toEqual({ agent_id: "a1", participant: { language: "ko", display_name: "Ji-woo" } });

  fetchSpy.mockResolvedValue(ok({ session_id: "s2" }));
  await createVoiceSession("a1");
  expect(JSON.parse(String(lastInit(fetchSpy).body))).toEqual({ agent_id: "a1" });
});

test("addSessionParticipant posts the guest to the session with the creator's bearer token", async () => {
  const guest = { participant_identity: "guest-1", connection: { url: "ws://lk", token: "t" }, session_token: "vls_guest" };
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(guest));
  await expect(addSessionParticipant("s 1", { language: "en", display_name: "Sam" }, "vls_creator")).resolves.toEqual(guest);
  expect(fetchSpy.mock.calls[0][0]).toMatch(/\/voice\/sessions\/s%201\/participants$/);
  const init = lastInit(fetchSpy);
  expect(init.method).toBe("POST");
  expect(header(init, "authorization")).toBe("Bearer vls_creator");
  expect(header(init, "content-type")).toBe("application/json");
  expect(JSON.parse(String(init.body))).toEqual({ language: "en", display_name: "Sam" });
});

test("session-scoped reads and end send a bearer token only when one is given", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => ok({ status: "ended" }));
  await getConversation("c1", "vls_guest");
  expect(header(lastInit(fetchSpy), "authorization")).toBe("Bearer vls_guest");
  await endVoiceSession("s1", "vls_guest");
  expect(lastInit(fetchSpy).method).toBe("POST");
  expect(header(lastInit(fetchSpy), "authorization")).toBe("Bearer vls_guest");
  await getVoiceSession("s1");
  expect(header(lastInit(fetchSpy), "authorization")).toBeNull();
  // Without a token the request init is exactly what the playground sent before.
  expect(withBearer({ method: "POST" }, undefined)).toEqual({ method: "POST" });
});

test("a 409 from adding a guest keeps the Platform code and status", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ detail: "session_full" }), { status: 409, headers: { "Content-Type": "application/json" } }));
  await expect(addSessionParticipant("s1", { language: "en" })).rejects.toMatchObject({ message: "session_full", status: 409 });
});

const interpreterAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: "i1", name: "Korean ↔ English interpreter", description: "", system_prompt: "", enabled_languages: ["ko", "en"],
  stt_provider_id: null, llm_provider_id: null, tts_provider_id: null, voice_id: null, status: "enabled",
  mode: "interpreter", interpreter: { languages: ["ko", "en"], direction: "one_way", engine: "cascaded", latency_mode: "balanced", hear_original: false },
  ...overrides,
});
const settings = { mine: "en", theirs: "ko", pace: "balanced" as const, hearOriginal: false };

test("new interpreters are cascaded with an explicit engine, and Korean pairs are one_way", () => {
  const body = interpreterAgentBody({ ...settings, pace: "instant" });
  expect(body).toMatchObject({
    mode: "interpreter",
    name: "English ↔ Korean interpreter",
    interpreter: { languages: ["en", "ko"], direction: "one_way", engine: "cascaded", latency_mode: "instant", hear_original: false },
  });
  expect(interpreterAgentBody({ ...settings, theirs: "ru" }).interpreter?.direction).toBe("auto");
});

test("only an enabled cascaded interpreter with the same pair and options is reused", () => {
  expect(matchesInterpreter(interpreterAgent(), settings)).toBe(true);
  expect(matchesInterpreter(interpreterAgent({ interpreter: { languages: ["ko", "en"], engine: "realtime" } }), settings)).toBe(false);
  expect(matchesInterpreter(interpreterAgent({ status: "disabled" }), settings)).toBe(false);
  expect(matchesInterpreter(interpreterAgent(), { ...settings, pace: "accurate" })).toBe(false);
  expect(matchesInterpreter(interpreterAgent(), { ...settings, hearOriginal: true })).toBe(false);
  expect(matchesInterpreter(interpreterAgent({ mode: "agent" }), settings)).toBe(false);
});

test("resolveInterpreter reuses a match, otherwise creates one", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(ok([interpreterAgent({ mode: "agent", interpreter: null }), interpreterAgent()]));
  await expect(resolveInterpreter(settings)).resolves.toMatchObject({ agent: { id: "i1" }, created: false });
  expect(fetchSpy).toHaveBeenCalledTimes(1);

  fetchSpy.mockResolvedValueOnce(ok([])).mockResolvedValueOnce(ok(interpreterAgent({ id: "new" })));
  await expect(resolveInterpreter(settings)).resolves.toMatchObject({ agent: { id: "new" }, created: true });
  const create = lastInit(fetchSpy);
  expect(create.method).toBe("POST");
  expect(JSON.parse(String(create.body)).interpreter.engine).toBe("cascaded");
});
