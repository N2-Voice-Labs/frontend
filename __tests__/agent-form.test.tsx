import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useParams } from "next/navigation";
import { beforeEach, expect, test, vi } from "vitest";
import NewAgent from "@/app/(dashboard)/agents/new/page";
import EditAgent from "@/app/(dashboard)/agents/[id]/edit/page";
import { getAgent, getProviders, saveAgent, type ProviderConfig } from "@/lib/platform";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/platform", () => ({
  getAgent: vi.fn(),
  getProviders: vi.fn(),
  saveAgent: vi.fn(),
}));

const providers: ProviderConfig[] = [
  { id: "stt-1", kind: "stt", provider: "deepgram", enabled: true },
  { id: "stt-2", kind: "stt", provider: "faster-whisper", enabled: true },
  { id: "llm-1", kind: "llm", provider: "openai-compatible", enabled: true },
  { id: "llm-2", kind: "llm", provider: "openai", enabled: true },
  { id: "tts-1", kind: "tts", provider: "cartesia", enabled: true },
];

const agent = {
  id: "agent-1",
  name: "Korea immigration helper",
  description: "English and Russian support",
  system_prompt: "Answer from approved immigration sources.",
  enabled_languages: ["en", "ru"],
  stt_provider_id: "stt-1",
  llm_provider_id: "llm-1",
  tts_provider_id: "tts-1",
  voice_id: "voice-1",
  status: "enabled",
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(useParams).mockReturnValue({ id: agent.id });
  vi.mocked(getAgent).mockResolvedValue(agent);
  vi.mocked(getProviders).mockResolvedValue(providers);
  vi.mocked(saveAgent).mockImplementation(async (_data, id) => ({ ...agent, id: id ?? "agent-created" }));
});

test("creates an agent with selected providers and enabled languages", async () => {
  render(<NewAgent />);

  fireEvent.change(await screen.findByLabelText("Agent name"), {
    target: { value: "Korea immigration helper" },
  });
  fireEvent.change(screen.getByLabelText("Speech-to-text provider"), {
    target: { value: "stt-1" },
  });
  fireEvent.change(screen.getByLabelText("Language model provider"), {
    target: { value: "llm-1" },
  });
  fireEvent.change(screen.getByLabelText("Text-to-speech provider"), {
    target: { value: "tts-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

  await waitFor(() => {
    expect(saveAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Korea immigration helper",
        enabled_languages: ["en", "ru"],
        stt_provider_id: "stt-1",
        llm_provider_id: "llm-1",
        tts_provider_id: "tts-1",
      }),
      undefined,
    );
  });
  expect(mocks.push).toHaveBeenCalledWith("/agents/agent-created");
});

test("does not offer providers without a Runtime integration as selectable choices", async () => {
  render(<NewAgent />);

  const unavailable = await screen.findByRole("option", { name: "faster-whisper (not supported by Runtime)" });
  expect((unavailable as HTMLOptionElement).disabled).toBe(true);
});

test("edits an agent provider assignment without dropping its other settings", async () => {
  render(<EditAgent />);

  await screen.findByRole("option", { name: "openai" });
  fireEvent.change(await screen.findByLabelText("Language model provider"), {
    target: { value: "llm-2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => {
    expect(saveAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: agent.name,
        system_prompt: agent.system_prompt,
        enabled_languages: ["en", "ru"],
        llm_provider_id: "llm-2",
      }),
      agent.id,
    );
    expect(saveAgent).toHaveBeenCalledWith(
      expect.not.objectContaining({ llm_provider_id: expect.anything(), tts_provider_id: expect.anything() }),
      agent.id,
    );
  });
  expect(mocks.push).toHaveBeenCalledWith(`/agents/${agent.id}`);
});

test("leaves unchanged provider assignments out of ordinary agent updates", async () => {
  render(<EditAgent />);
  await screen.findByRole("option", { name: "openai" });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => expect(saveAgent).toHaveBeenCalledWith(
    expect.not.objectContaining({
      stt_provider_id: expect.anything(),
      llm_provider_id: expect.anything(),
      tts_provider_id: expect.anything(),
    }),
    agent.id,
  ));
});

test("the live preview follows what you type and prompt templates fill the prompt", async () => {
  const { container } = render(<NewAgent />);
  const preview = () => container.querySelector(".form-preview-card")!;
  expect(preview().textContent).toContain("Untitled agent");

  fireEvent.change(await screen.findByLabelText("Agent name"), { target: { name: "name", value: "Immigration guide" } });
  expect(preview().textContent).toContain("Immigration guide");

  fireEvent.click(screen.getByRole("button", { name: "Bilingual EN/RU" }));
  expect((screen.getByLabelText("System prompt") as HTMLTextAreaElement).value).toContain("bilingual assistant");
  expect(preview().textContent).toMatch(/\d+ words/);

  fireEvent.click(screen.getByRole("checkbox", { name: "Russian" }));
  expect(container.querySelectorAll(".form-preview-card .lang-chip")).toHaveLength(1);
});

test("shows an unsaved-changes marker and asks the browser to confirm leaving only when dirty", async () => {
  render(<NewAgent />);
  const input = await screen.findByLabelText("Agent name");
  const leave = () => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
  expect(leave()).toBe(false);

  fireEvent.change(input, { target: { name: "name", value: "Draft" } });
  expect(screen.getByText("Unsaved changes")).toBeTruthy();
  expect(leave()).toBe(true);
});
