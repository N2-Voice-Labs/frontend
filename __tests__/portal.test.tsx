import { cleanup, fireEvent, render, screen, waitFor, within, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AssistantPanel } from "@/components/features/portal/assistant-panel";
import { PortalHome } from "@/components/features/portal/portal-home";
import { AssistantDock } from "@/components/features/portal/assistant-dock";
import { PortalHeader } from "@/components/features/portal/portal-chrome";
import { StaffConsole } from "@/components/features/portal/staff-console";

const mocks = vi.hoisted(() => ({
  start: vi.fn(), handoff: vi.fn(), chat: vi.fn(), messages: vi.fn(), conversation: vi.fn(), end: vi.fn(),
  list: vi.fn(), accept: vi.fn(), transcript: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), mic: vi.fn(),
  callbacks: {} as Record<string, (...args: any[]) => void>,
}));
vi.mock("@/lib/platform", () => ({
  getMessages: mocks.messages, getConversation: mocks.conversation, endVoiceSession: mocks.end,
}));
vi.mock("@/lib/portal", () => ({
  startDemoSession: mocks.start, createHandoff: mocks.handoff, sendDemoChat: mocks.chat,
  listStaffHandoffs: mocks.list, acceptHandoff: mocks.accept, getHandoffTranscript: mocks.transcript,
  STAFF_LANGUAGE: "ko",
}));
vi.mock("livekit-client", () => ({
  Room: class {
    localParticipant = { setMicrophoneEnabled: mocks.mic };
    on(event: string, cb: (...args: any[]) => void) { mocks.callbacks[event] = cb; return this; }
    connect = mocks.connect; disconnect = mocks.disconnect;
  },
  RoomEvent: new Proxy({}, { get: (_t, key) => String(key) }),
  Track: { Kind: { Audio: "audio" } },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/inha" }));
vi.mock("@/components/features/portal/handoff-call", () => ({ HandoffCall: () => <div>HandoffCall rendered</div> }));

const session = { session_id: "s1", conversation_id: "c1", room_name: "r1", connection_status: "configured", runtime_status: "accepted", connection: { url: "ws://lk", token: "lk-token" }, session_token: "bearer-s1" };
const handoff = { ...session, handoff_id: "h1" };
const queueItem = { id: "h1", status: "waiting", requester_name: "Sam", requester_language: "en", staff_language: "ko", reason: "Needs help", created_at: new Date().toISOString(), call_session_id: "c2", from_conversation_id: "c1", invite_code: "MUST_NOT_RENDER" };
beforeEach(() => {
  vi.clearAllMocks(); mocks.callbacks = {};
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  mocks.start.mockResolvedValue(session); mocks.handoff.mockResolvedValue(handoff); mocks.chat.mockResolvedValue({ conversation_id: "chat1", reply: "Helpful answer" });
  mocks.messages.mockResolvedValue([{ id: "m1", role: "user", content: "Question" }, { id: "m2", role: "assistant", content: "Polled answer" }]);
  mocks.conversation.mockResolvedValue({ outcome: null, status: "active" }); mocks.connect.mockResolvedValue(undefined); mocks.mic.mockResolvedValue(undefined); mocks.disconnect.mockResolvedValue(undefined); mocks.end.mockResolvedValue({});
  mocks.list.mockResolvedValue([queueItem]); mocks.accept.mockResolvedValue({ invite_code: "abc.def", call_session_id: "c2" }); mocks.transcript.mockResolvedValue([{ id: "t1", role: "user", content: "Student turn" }, { id: "t2", role: "assistant", content: "Assistant turn" }]);
  // Like current Chromium, scrollIntoView returns a Promise; effects must not hand it to React as a cleanup.
  Element.prototype.scrollIntoView = vi.fn(() => Promise.resolve()) as unknown as Element["scrollIntoView"];
});
afterEach(cleanup);

const renderHome = () => render(<><PortalHeader /><AssistantDock><PortalHome /></AssistantDock></>);

async function startCall() {
  fireEvent.click(screen.getByRole("button", { name: /Start AI Voice Call/ }));
  await screen.findByRole("button", { name: "Mute" });
}

test("idle assistant offers voice, name, and chat; live session controls and polled transcript render", async () => {
  render(<AssistantPanel />);
  expect(screen.getByRole("button", { name: "Start AI Voice Call" })).toBeTruthy();
  expect(screen.getByLabelText(/Your name/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open the chat" })).toBeTruthy();
  await startCall();
  expect(screen.getByRole("button", { name: "End call" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Connect to Admissions Officer" })).toBeTruthy();
  await screen.findByText("Polled answer");
  expect(mocks.messages).toHaveBeenCalledWith("c1", "bearer-s1", expect.any(AbortSignal));
});

test("escalation opens confirmation and confirmation creates English handoff with session bearer", async () => {
  mocks.conversation.mockResolvedValue({ outcome: "escalated", status: "active" });
  render(<AssistantPanel />); await startCall();
  await screen.findByRole("alertdialog");
  fireEvent.click(screen.getByRole("button", { name: "Connect to Admissions Officer" }));
  await screen.findByText("HandoffCall rendered");
  expect(mocks.handoff).toHaveBeenCalledWith({ session_id: "s1", language: "en", name: null, reason: "Suggested by the assistant" }, "bearer-s1");
});

test("microphone denial and 429 start failures show friendly messages", async () => {
  const getUserMedia = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  const { unmount } = render(<AssistantPanel />); fireEvent.click(screen.getByRole("button", { name: "Start AI Voice Call" }));
  await screen.findByText(/Microphone access was blocked/); unmount();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
  mocks.start.mockRejectedValue(Object.assign(new Error("rate"), { status: 429 }));
  render(<AssistantPanel />); fireEvent.click(screen.getByRole("button", { name: "Start AI Voice Call" }));
  await screen.findByText(/Too many calls were started/);
});

test("chat sends and renders reply, offers voice after escalation, and reports rate limit", async () => {
  render(<AssistantPanel />); fireEvent.click(screen.getByRole("tab", { name: "Chat" }));
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Deadlines?" } });
  mocks.chat.mockResolvedValueOnce({ conversation_id: "chat1", reply: "Apply soon", handoff_suggested: true });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Apply soon"); expect(mocks.chat).toHaveBeenCalledWith("Deadlines?", null);
  fireEvent.click(screen.getByRole("button", { name: "Start a voice call" }));
  expect(screen.getByRole("tab", { name: "Voice call" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: "Chat" }));
  mocks.chat.mockRejectedValueOnce(Object.assign(new Error("limit"), { status: 429 }));
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Another?" } }); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText(/chat has reached its limit/);
});

test("PortalHome topic fills chat question and switches tabs", async () => {
  renderHome();
  fireEvent.click(screen.getByRole("button", { name: /Required documents/ }));
  expect(screen.getByRole("tab", { name: "Chat" }).getAttribute("aria-selected")).toBe("true");
  await waitFor(() => expect((screen.getByLabelText("Your question") as HTMLTextAreaElement).value).toBe("What documents do I need to apply?"));
});

test("staff key persists, waiting queue hides invite code, transcript peek renders turns, and pickup navigates", async () => {
  render(<StaffConsole />); fireEvent.change(screen.getByLabelText("Staff key"), { target: { value: "staff-secret" } }); fireEvent.click(screen.getByRole("button", { name: "Open the queue" }));
  await screen.findByText("Sam"); expect(sessionStorage.getItem("portal-staff-key")).toBe("staff-secret"); expect(document.body.textContent).not.toContain("MUST_NOT_RENDER");
  fireEvent.click(screen.getByRole("button", { name: "Read AI conversation" })); await screen.findByText("Student turn"); expect(screen.getByText("Assistant turn")).toBeTruthy();
  const assign = vi.fn(); Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
  fireEvent.click(screen.getByRole("button", { name: "Pick up" })); await waitFor(() => expect(assign).toHaveBeenCalledWith("/join#c=abc.def")); expect(mocks.accept).toHaveBeenCalledWith("staff-secret", "h1");
});

test("401 signs out with message and 409 reports an already claimed student", async () => {
  sessionStorage.setItem("portal-staff-key", "bad-key"); mocks.list.mockRejectedValueOnce(Object.assign(new Error("unauthorized"), { status: 401 }));
  const { unmount } = render(<StaffConsole />); await screen.findByText("That staff key wasn't accepted."); expect(sessionStorage.getItem("portal-staff-key")).toBeNull(); unmount();
  mocks.list.mockResolvedValue([queueItem]); sessionStorage.setItem("portal-staff-key", "staff-secret"); render(<StaffConsole />); await screen.findByText("Sam"); mocks.accept.mockRejectedValueOnce(Object.assign(new Error("claimed"), { status: 409 })); fireEvent.click(screen.getByRole("button", { name: "Pick up" })); await screen.findByText(/already picked up/);
});

test("a saved chat is restored for the tab, and malformed saved data is ignored", async () => {
  const { loadSavedChat } = await import("@/components/features/portal/assistant-panel");
  sessionStorage.setItem("portal-chat", JSON.stringify({ conversationId: "c9", lines: [
    { id: "u1", role: "user", text: "Tuition?" }, { id: "x", role: "system", text: "nope" }, { nope: true },
  ] }));
  expect(loadSavedChat()).toEqual({ conversationId: "c9", lines: [{ id: "u1", role: "user", text: "Tuition?" }] });
  sessionStorage.setItem("portal-chat", "{not json");
  expect(loadSavedChat()).toEqual({ conversationId: null, lines: [] });
  sessionStorage.clear();
});

test("chat answers show their [n] citations as links to the cited official pages, and drop unknown markers", async () => {
  const { AnswerText, SourceList } = await import("@/components/features/portal/assistant-panel");
  const sources = [{ n: 1, title: "Tuition", heading: "Undergraduate", url: "https://apply.inha.ac.kr/x", snippet: "₩5,462,000" },
                   { n: 2, title: "Bad", url: "javascript:alert(1)" }];
  const { container } = render(<><AnswerText text="Engineering is ₩5,462,000 [1]. Other [3]." sources={sources} idPrefix="a1" /><SourceList sources={sources} idPrefix="a1" /></>);
  const cites = container.querySelectorAll("a.portal-cite");
  expect(cites).toHaveLength(1);
  expect(cites[0].getAttribute("href")).toBe("#a1-src-1");
  expect(container.textContent).not.toContain("[3]");
  expect(screen.getByRole("link", { name: "Tuition — Undergraduate" }).getAttribute("href")).toBe("https://apply.inha.ac.kr/x");
  expect(screen.queryByRole("link", { name: "Bad" })).toBeNull();
});


test("portal navigation stays under /inha and omits the website widget", () => {
  renderHome();
  expect(screen.getByRole("link", { name: /demo home/ }).getAttribute("href")).toBe("/inha");
  expect(screen.getByRole("link", { name: "Staff" }).getAttribute("href")).toBe("/inha/staff");
  expect(screen.queryByRole("link", { name: "For your website" })).toBeNull();
});

test("the mascot greets on the home page and in the empty chat, decoratively", () => {
  const { container } = renderHome();
  const wave = container.querySelector('img[src="/portal/mascot/wave-320.webp"]');
  expect(wave).not.toBeNull();
  expect(wave?.getAttribute("alt")).toBe("");
  expect(wave?.getAttribute("srcset")).toContain("wave-640.webp 640w");
  fireEvent.click(screen.getByRole("tab", { name: "Chat" }));
  expect(container.querySelector('img[src="/portal/mascot/reading-320.webp"]')).not.toBeNull();
});

test("the portal 404 shows the confused dragon and a way back", async () => {
  const { default: PortalNotFound } = await import("@/app/(portal)/inha/not-found");
  render(<PortalNotFound />);
  expect(screen.getByRole("heading", { name: "We couldn't find that page" })).toBeTruthy();
  expect(screen.getByAltText(/confused/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to the admissions portal" }).getAttribute("href")).toBe("/inha");
});
