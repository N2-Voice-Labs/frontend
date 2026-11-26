import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WorkspaceKeyGate } from "@/components/workspace/workspace-key-gate";
import { getAgents, getConversation, withBearer } from "@/lib/platform";
import { readWorkspaceKey, storeWorkspaceKey } from "@/lib/workspace-key";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const authOf = (call: unknown[]) => new Headers((call[1] as RequestInit | undefined)?.headers).get("authorization");

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

test("sends the workspace key as a bearer token", async () => {
  storeWorkspaceKey("vlk_test");
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json([]));
  await getAgents();
  expect(authOf(fetchSpy.mock.calls[0])).toBe("Bearer vlk_test");
});

test("a session token wins over the workspace key", async () => {
  storeWorkspaceKey("vlk_test");
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ id: "c1" }));
  await getConversation("c1", "vls_session");
  expect(authOf(fetchSpy.mock.calls[0])).toBe("Bearer vls_session");
  expect(withBearer(undefined, null)).toBeUndefined();
});

test("forgets the key when the Platform rejects it", async () => {
  storeWorkspaceKey("vlk_old");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ detail: "invalid_api_key" }, 401));
  await expect(getAgents()).rejects.toMatchObject({ status: 401 });
  expect(readWorkspaceKey()).toBe("");
});

test("opens without asking when the Platform needs no key", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(json([]));
  render(<WorkspaceKeyGate><p>inside</p></WorkspaceKeyGate>);
  expect(await screen.findByText("inside")).toBeTruthy();
});

test("asks for a key on 401 and opens once the Platform accepts it", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) =>
    authOf([_url, init]) === "Bearer vlk_good" ? json([]) : json({ detail: "authentication_required" }, 401));
  render(<WorkspaceKeyGate><p>inside</p></WorkspaceKeyGate>);
  const input = await screen.findByLabelText("Platform API key");

  fireEvent.change(input, { target: { value: "vlk_bad" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Open workspace" })); });
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(readWorkspaceKey()).toBe("");

  fireEvent.change(input, { target: { value: "vlk_good" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Open workspace" })); });
  await waitFor(() => expect(screen.getByText("inside")).toBeTruthy());
  expect(readWorkspaceKey()).toBe("vlk_good");
  expect(fetchSpy).toHaveBeenCalled();
});
