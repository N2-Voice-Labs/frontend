import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CommandPalette, OPEN_PALETTE_EVENT } from "@/components/features/agents/command-palette";
import { getAgents } from "@/lib/platform";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/platform", () => ({ getAgents: vi.fn() }));

const agent = (id: string, name: string) => ({ id, name, description: "", system_prompt: "", enabled_languages: ["en"], stt_provider_id: null, llm_provider_id: null, tts_provider_id: null, voice_id: null, status: "active" });

beforeEach(() => {
  push.mockReset();
  vi.mocked(getAgents).mockReset();
  vi.mocked(getAgents).mockResolvedValue([agent("a1", "Concierge"), agent("a2", "Immigration guide")]);
});
afterEach(cleanup);

async function openPalette() {
  render(<CommandPalette />);
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  await waitFor(() => expect(screen.getByText("Talk to Concierge")).toBeTruthy());
  return screen.getByRole("combobox", { name: "Search agents and pages" });
}

test("opens with Ctrl+K, loads agents once, and filters as you type", async () => {
  const input = await openPalette();
  expect(getAgents).toHaveBeenCalledTimes(1);
  expect(screen.getByText("New agent")).toBeTruthy();

  fireEvent.change(input, { target: { value: "immig" } });
  expect(screen.queryByText("Talk to Concierge")).toBeNull();
  expect(screen.getByText("Talk to Immigration guide")).toBeTruthy();

  fireEvent.change(input, { target: { value: "nothing here" } });
  expect(screen.getByText(/Nothing matches/)).toBeTruthy();
});

test("arrow keys move the selection and Enter navigates", async () => {
  const input = await openPalette();
  fireEvent.change(input, { target: { value: "concierge" } });
  const options = () => screen.getAllByRole("option");
  expect(options()[0].getAttribute("aria-selected")).toBe("true");

  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(options()[1].getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(push).toHaveBeenCalledWith("/agents/a1");
});

test("the header button event opens it and pages still work when agents fail to load", async () => {
  vi.mocked(getAgents).mockRejectedValue(new Error("down"));
  render(<CommandPalette />);
  act(() => { window.dispatchEvent(new Event(OPEN_PALETTE_EVENT)); });
  await waitFor(() => expect(screen.getByText(/Agents unavailable: down/)).toBeTruthy());

  fireEvent.click(screen.getByText("Conversations"));
  expect(push).toHaveBeenCalledWith("/conversations");
});
