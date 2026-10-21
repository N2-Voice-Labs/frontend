import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoSession, MESSAGES } from "@/lib/demo/session-store";

/** An AnalyserNode stand-in whose RMS level we control (levelOf scales RMS by 4). */
function fakeAnalyser() {
  const node = { level: 0, getByteTimeDomainData(buf: Uint8Array) { buf.fill(128 + Math.round((node.level / 4) * 128)); }, getByteFrequencyData() {} };
  return node;
}

function liveSession() {
  const s = new DemoSession({ tokenEndpoint: "/api/demo/session", agentId: "concierge", maxSessionSeconds: 180 });
  const mic = fakeAnalyser(), agent = fakeAnalyser();
  s.micAnalyser = mic as unknown as AnalyserNode;
  s.agentAnalyser = agent as unknown as AnalyserNode;
  // Put the store in a live state without a real connection.
  (s as unknown as { set(p: object): void }).set({ state: "listening" });
  return { s, mic, agent };
}

afterEach(() => vi.restoreAllMocks());

describe("turn timing", () => {
  it("measures end of the user's speech → first agent audio", () => {
    const { s, mic, agent } = liveSession();
    mic.level = 0.5;
    s.tick(1000); // user speaking
    mic.level = 0;
    s.tick(1300); // quiet: waiting for the reply
    expect(s.isWaiting(1300)).toBe(true);
    expect(s.getSnapshot().stats.label).toBe("Responding…");
    agent.level = 0.5;
    s.tick(1850); // agent answers 850 ms after the user stopped
    expect(s.getSnapshot().medianTurn).toBeCloseTo(0.85);
    expect(s.flashAt).toBe(1850);
  });

  it("does not count audio while the agent is already talking", () => {
    const { s, mic, agent } = liveSession();
    agent.level = 0.5;
    s.tick(1000);
    mic.level = 0.5; // echo / talking over the agent
    s.tick(1100);
    s.tick(1500);
    expect(s.getSnapshot().medianTurn).toBeNull();
  });
});

describe("errors", () => {
  it("reports an unreachable backend and returns to idle", async () => {
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn() }, configurable: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const s = new DemoSession({ tokenEndpoint: "/api/demo/session", agentId: "concierge", maxSessionSeconds: 180 });
    s.start();
    expect(s.getSnapshot().state).toBe("connecting");
    await vi.waitFor(() => expect(s.getSnapshot().state).toBe("idle"));
    expect(s.getSnapshot().message).toBe(MESSAGES.unreachable);
  });

  it("reports a blocked microphone in preview mode", async () => {
    const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn().mockRejectedValue(denied) }, configurable: true });
    const s = new DemoSession({ tokenEndpoint: "", agentId: "concierge", maxSessionSeconds: 180 });
    s.start();
    await vi.waitFor(() => expect(s.getSnapshot().message).toBe(MESSAGES.blocked));
    expect(s.getSnapshot().state).toBe("idle");
  });
});
