import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AssignmentPanel } from "@/components/features/agents/assignment-panel";
import { LanguageTags } from "@/components/features/conversations/language-tags";
import { OutcomePanel } from "@/components/features/conversations/outcome-panel";
import { CloneForm } from "@/components/features/voices/clone-form";
import { comingSoon, isEnabled } from "@/lib/capabilities";
import { parseTargets, TRANSITIONS } from "@/lib/campaigns";
import { E164 } from "@/lib/deployments";
import { latestLatency } from "@/lib/latency";
import { handoffOf, outcomeLabel } from "@/lib/outcomes";
import { describeError } from "@/lib/platform-errors";
import { setConversationOutcome, type Conversation } from "@/lib/platform";
import { cloneVoice, voiceActions } from "@/lib/voices";

vi.mock("@/lib/platform", async () => {
  const actual = await vi.importActual<typeof import("@/lib/platform")>("@/lib/platform");
  return { ...actual, getProviders: vi.fn().mockResolvedValue([{ id: "tts-1", kind: "tts", provider: "cartesia", enabled: true }]), setConversationOutcome: vi.fn() };
});
vi.mock("@/lib/voices", async () => {
  const actual = await vi.importActual<typeof import("@/lib/voices")>("@/lib/voices");
  return { ...actual, cloneVoice: vi.fn() };
});

beforeEach(() => { cleanup(); vi.clearAllMocks(); });
afterEach(() => vi.restoreAllMocks());

test("backend error codes become plain sentences", () => {
  expect(describeError(new Error("voice_consent_required"))).toMatch(/consent is required/i);
  expect(describeError(new Error("campaign_requires_sip_deployment"))).toMatch(/phone \(SIP\) deployment/);
  expect(describeError(new Error("something_new"))).toBe("something_new");
  expect(describeError(new TypeError("Failed to fetch"))).toMatch(/Can’t reach the Platform/);
});

test("features the backend does not run yet are off and explained", () => {
  for (const key of ["voicePreview", "liveLatency", "providerCloning", "sipDialing", "liveTransfer", "toolExecution", "knowledgeSearch"] as const) {
    expect(isEnabled(key)).toBe(false);
    expect(comingSoon[key].note.length).toBeGreaterThan(10);
  }
});

test("campaign moves match the Platform's status flow", () => {
  expect(TRANSITIONS.draft).toEqual(["scheduled", "cancelled"]);
  expect(TRANSITIONS.running).toContain("paused");
  expect(TRANSITIONS.completed).toEqual([]);
  expect(TRANSITIONS.cancelled).toEqual([]);
});

test("pasted phone numbers split into valid targets and invalid lines", () => {
  const { targets, invalid } = parseTargets("+14155550123, Ada\n\n0123\n+442071838750", (phone) => E164.test(phone));
  expect(targets).toEqual([{ phone_number: "+14155550123", name: "Ada" }, { phone_number: "+442071838750", name: "" }]);
  expect(invalid).toEqual(["0123"]);
});

test("a recorded handoff is read from the call's actions", () => {
  expect(handoffOf({ actions: [{ type: "handoff_requested", reason: "Asked for a person", target: "support" }] })).toEqual({ reason: "Asked for a person", target: "support" });
  expect(handoffOf({ actions: [] })).toBeNull();
  expect(outcomeLabel("callback_requested")).toBe("Callback requested");
  expect(outcomeLabel(null)).toBe("Not recorded");
});

test("latency comes only from LatencyMeasured events, in any of the documented shapes", () => {
  expect(latestLatency([
    { event_type: "TurnCompleted", payload: {} },
    { event_type: "LatencyMeasured", payload: { metric: "stt", value_ms: 181.4 } },
    { event_type: "LatencyMeasured", payload: { stage: "LLM", latency_ms: 640 } },
  ])).toEqual({ stt: 181, llm: 640 });
  expect(latestLatency([])).toEqual({});
});

test("voices offer only the status moves a person can make", () => {
  expect(voiceActions.ready?.to).toBe("disabled");
  expect(voiceActions.disabled?.to).toBe("ready");
  expect(voiceActions.failed?.to).toBe("pending");
  expect(voiceActions.processing).toBeUndefined();
});

test("a message that mixes languages is tagged as a switch", () => {
  const { container } = render(<LanguageTags primary="ru" detected={["ru", "en"]} />);
  expect(container.querySelectorAll(".lang-tag").length).toBe(2);
  expect(container.querySelector("[data-primary='true']")?.textContent).toBe("RU");
  expect(screen.getByText("switch")).toBeTruthy();
});

test("cloning needs consent before it can be sent, then shows the saved voice", async () => {
  vi.mocked(cloneVoice).mockResolvedValue({ id: "v-1", name: "My voice", source: "clone", status: "pending", tts_provider_id: null, provider_voice_id: null, languages: ["en"], style: {}, design_prompt: null, sample_reference: "https://a.b/c.wav", consent: null, failure_reason: null, created_at: "", updated_at: "" });
  render(<CloneForm />);

  const submit = screen.getByRole("button", { name: "Clone voice" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My voice" } });
  fireEvent.change(screen.getByLabelText(/Link to a clean recording/), { target: { value: "https://a.b/c.wav" } });
  fireEvent.change(screen.getByLabelText("Speaker’s full name"), { target: { value: "Ada Lovelace" } });
  fireEvent.click(screen.getByLabelText(/I confirm this consent/));
  expect(submit.disabled).toBe(false);
  fireEvent.click(submit);

  expect(await screen.findByText("My voice is saved")).toBeTruthy();
  expect(cloneVoice).toHaveBeenCalledWith(expect.objectContaining({
    sample_reference: "https://a.b/c.wav",
    consent: expect.objectContaining({ confirmed: true, subject_name: "Ada Lovelace", method: "self" }),
  }));
  expect(screen.getByText("Queued")).toBeTruthy();
});

test("a bad sample link is caught before anything is sent", async () => {
  render(<CloneForm />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
  fireEvent.change(screen.getByLabelText(/Link to a clean recording/), { target: { value: "not a link" } });
  fireEvent.change(screen.getByLabelText("Speaker’s full name"), { target: { value: "Ada" } });
  fireEvent.click(screen.getByLabelText(/I confirm this consent/));
  fireEvent.click(screen.getByRole("button", { name: "Clone voice" }));

  expect((await screen.findByRole("alert")).textContent).toMatch(/must be a link/);
  expect(cloneVoice).not.toHaveBeenCalled();
});

test("an outcome can be set on a conversation and shows the handoff when one was recorded", async () => {
  const conversation: Conversation = { id: "c-1", agent_id: "a-1", status: "ended", started_at: "2026-01-01T00:00:00Z", ended_at: null, outcome: "escalated", channel: "sip", actions: [{ type: "handoff_requested", reason: "Asked for a person", target: "queue" }] };
  const onSaved = vi.fn();
  vi.mocked(setConversationOutcome).mockResolvedValue({ ...conversation, outcome: "resolved" });
  render(<OutcomePanel conversation={conversation} onSaved={onSaved} />);

  expect(screen.getByText("Escalated to a person", { selector: "strong" })).toBeTruthy();
  expect(screen.getByText(/Reason: Asked for a person/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Change outcome" }));
  fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "resolved" } });
  fireEvent.click(screen.getByRole("button", { name: "Save outcome" }));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(setConversationOutcome).toHaveBeenCalledWith("c-1", { outcome: "resolved", summary: null, intent: null });
});

test("tools or documents are saved as the agent's whole selection, and only when changed", async () => {
  const save = vi.fn().mockResolvedValue([]);
  render(<AssignmentPanel title="Tools" intro="Pick." manageHref="/tools" manageLabel="Manage tools" soon="toolExecution" save={save} loadError=""
    items={[{ id: "t1", title: "check", note: "", enabled: true }, { id: "t2", title: "book", note: "", enabled: true }, { id: "t3", title: "old", note: "", enabled: false }]}
    assignedIds={["t1"]} />);

  const saveButton = screen.getByRole("button", { name: "Save selection" }) as HTMLButtonElement;
  await waitFor(() => expect((screen.getByLabelText(/check/) as HTMLInputElement).checked).toBe(true));
  expect(saveButton.disabled).toBe(true);
  expect((screen.getByLabelText(/old/) as HTMLInputElement).disabled).toBe(true);

  fireEvent.click(screen.getByLabelText(/book/));
  expect(saveButton.disabled).toBe(false);
  fireEvent.click(saveButton);

  await waitFor(() => expect(save).toHaveBeenCalledWith(["t1", "t2"]));
  expect(screen.getByText("Coming soon")).toBeTruthy();
});
