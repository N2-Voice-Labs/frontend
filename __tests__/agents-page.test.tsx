import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentsPage } from "@/components/workspace/agents-page";
import { toAgentView } from "@/lib/agents/view";
import type { Agent } from "@/lib/platform";

const base: Agent = {
  id: "a1", name: "Concierge", description: "Travel and stays", system_prompt: "", enabled_languages: ["en", "ru"],
  stt_provider_id: "p-stt", llm_provider_id: null, tts_provider_id: "p-tts", voice_id: null, voice_profile_id: "v1",
  mode: "agent", interpreter: null, status: "enabled", updated_at: new Date(Date.now() - 2 * 86400e3).toISOString(),
};
const interpreter: Agent = {
  ...base, id: "a2", name: "Interpreter", description: "", status: "disabled", voice_profile_id: null,
  mode: "interpreter", interpreter: { languages: ["ko", "en"], engine: "realtime", latency_mode: "instant", glossary: [{}, {}, {}] },
};
const providers = [{ id: "p-stt", kind: "stt", provider: "deepgram", enabled: true }, { id: "p-tts", kind: "tts", provider: "cartesia", enabled: true }];
const voices = [{ id: "v1", name: "Warm concierge", status: "ready", languages: ["en"] }];

function mockPlatform(agents: Agent[] | "down") {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (agents === "down") throw new TypeError("Failed to fetch");
    const path = new URL(url).pathname;
    const body = path === "/agents" ? agents : path === "/providers" ? providers : voices;
    return Response.json(body);
  }));
}

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

describe("agent view mapping", () => {
  it("maps Platform fields onto the card and inspector", () => {
    const v = toAgentView(base, providers as never, voices as never, Date.now());
    expect(v).toMatchObject({
      purpose: "Travel and stays", ready: true, statusLabel: "Ready", langs: ["EN", "RU"], voice: "Warm concierge", mode: "Agent",
      providers: { speech: "Deepgram", language: "Default", voice: "Cartesia" }, glossary: 0, updated: "2 days ago", greeting: null, sample: null,
    });
    const i = toAgentView(interpreter, providers as never, voices as never, Date.now());
    expect(i).toMatchObject({ ready: false, statusLabel: "Disabled", langs: ["KO", "EN"], mode: "Realtime · Instant", glossary: 3, purpose: "Live interpreter" });
  });
});

describe("Agents page", () => {
  it("loads agents, computes the summary and filters", async () => {
    mockPlatform([base, interpreter]);
    render(<AgentsPage />);
    await screen.findByRole("button", { name: "Concierge" });
    const stats = [...document.querySelectorAll(".stat b")].map((b) => b.textContent);
    expect(stats).toEqual(["2", "1", "1", "3"]);
    expect(screen.getByRole("complementary", { name: "Agent details" }).textContent).toContain("Warm concierge");
    fireEvent.click(screen.getByRole("button", { name: "KO" }));
    expect(screen.queryByRole("button", { name: "Concierge" })).toBeNull();
    expect(screen.getByText("1 of 2 agents")).toBeTruthy();
    // the selection follows the filter
    expect(screen.getByRole("heading", { level: 2, name: "Interpreter" })).toBeTruthy();
  });

  it("says “No preview yet” instead of a dead play button when there is no real sample", async () => {
    mockPlatform([base]);
    render(<AgentsPage />);
    expect(await screen.findByText("No preview yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play voice preview" })).toBeNull();
  });

  it("sorts by name or by last updated", async () => {
    const older = { ...base, id: "a3", name: "Alpha", updated_at: new Date(Date.now() - 30 * 86400e3).toISOString() };
    const newest = { ...base, id: "a4", name: "Zulu", updated_at: new Date().toISOString() };
    mockPlatform([base, older, newest]);
    render(<AgentsPage />);
    await screen.findByRole("button", { name: "Concierge" });
    const names = () => [...document.querySelectorAll(".ag-select")].map((b) => b.textContent);
    expect(names()).toEqual(["Alpha", "Concierge", "Zulu"]);
    fireEvent.click(screen.getByRole("button", { name: "Updated" }));
    expect(names()).toEqual(["Zulu", "Concierge", "Alpha"]);
  });

  it("moves between cards with the arrow keys and selects the focused one", async () => {
    mockPlatform([base, interpreter]);
    render(<AgentsPage />);
    const first = await screen.findByRole("button", { name: "Concierge" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("button", { name: "Interpreter" });
    expect(document.activeElement).toBe(second);
    expect(screen.getByRole("heading", { level: 2, name: "Interpreter" })).toBeTruthy();
    fireEvent.keyDown(second, { key: "Home" });
    expect(document.activeElement).toBe(first);
  });

  it("links actions to the playground, call and edit routes", async () => {
    mockPlatform([base]);
    render(<AgentsPage />);
    await screen.findByRole("link", { name: "Test in playground" });
    expect(screen.getByRole("link", { name: "Test in playground" }).getAttribute("href")).toBe("/playground?agent=a1");
    expect(screen.getByRole("link", { name: "Start a call" }).getAttribute("href")).toBe("/call?agent=a1");
    expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe("/agents/a1");
  });

  it("shows “Can't reach the platform” and retries", async () => {
    mockPlatform("down");
    render(<AgentsPage />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Can’t reach the platform")).toBeTruthy();
    mockPlatform([base]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("button", { name: "Concierge" });
  });

  it("previews the empty and loading states with ?state=", async () => {
    mockPlatform([base]);
    window.history.replaceState(null, "", "/agents?state=empty");
    const { unmount } = render(<AgentsPage />);
    expect(await screen.findByText("No agents yet")).toBeTruthy();
    unmount();
    window.history.replaceState(null, "", "/agents?state=loading");
    render(<AgentsPage />);
    await waitFor(() => expect(document.querySelectorAll(".skel")).toHaveLength(3));
    expect(fetch).not.toHaveBeenCalled();
  });
});
