import { afterEach, expect, test, vi } from "vitest";
import { getConversation, getProviders } from "@/lib/platform";

afterEach(() => vi.restoreAllMocks());

test("preserves the HTTP status when a Platform request fails", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ detail: "conversation_not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }),
  );

  await expect(getConversation("missing-conversation")).rejects.toMatchObject({
    message: "conversation_not_found",
    status: 404,
  });
});

test("loads provider choices from the Platform provider endpoint", async () => {
  const providers = [
    { id: "stt-1", kind: "stt", provider: "deepgram", enabled: true },
  ];
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(providers), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  await expect(getProviders()).resolves.toEqual(providers);
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringMatching(/\/providers$/),
    expect.objectContaining({ cache: "no-store" }),
  );
});
