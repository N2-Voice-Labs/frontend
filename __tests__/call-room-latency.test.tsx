import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useCallRoom, type CallCredentials } from "@/components/features/call/use-call-room";

type Handlers = Record<string, (...args: unknown[]) => void>;

const mocks = vi.hoisted(() => ({
  rooms: [] as Array<{ name: string; handlers: Record<string, (...args: unknown[]) => void> }>,
  connect: vi.fn(),
  disconnect: vi.fn(),
  endCall: vi.fn(),
  setMicrophoneEnabled: vi.fn(),
  samplers: [] as Array<{ onLevel: (level: number) => void; start: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; track: unknown }>,
}));

vi.mock("@/lib/platform", () => ({ endCall: mocks.endCall }));
vi.mock("@/components/features/call/level-store", async (original) => ({
  ...(await original<typeof import("@/components/features/call/level-store")>()),
  createLevelSampler: (track: unknown, _context: unknown, onLevel: (level: number) => void) => {
    const sampler = { onLevel, track, start: vi.fn(), stop: vi.fn(), dispose: vi.fn(), running: false };
    mocks.samplers.push(sampler);
    return sampler;
  },
}));
vi.mock("livekit-client", () => ({
  Room: class {
    localParticipant = { identity: "browser-s1", setMicrophoneEnabled: mocks.setMicrophoneEnabled, getTrackPublication: () => undefined };
    remoteParticipants = new Map();
    canPlaybackAudio = true;
    handlers: Handlers = {};
    constructor() { mocks.rooms.push({ name: `room-${mocks.rooms.length}`, handlers: this.handlers }); }
    on(event: string, callback: (...args: unknown[]) => void) { this.handlers[event] = callback; return this; }
    connect = (...args: unknown[]) => mocks.connect(...args);
    disconnect = (...args: unknown[]) => mocks.disconnect(...args);
    startAudio = vi.fn().mockResolvedValue(undefined);
    removeAllListeners() {}
  },
  RoomEvent: new Proxy({}, { get: (_target, key) => String(key) }),
  Track: { Kind: { Audio: "audio" }, Source: { Microphone: "microphone" } },
}));

const credentials: CallCredentials = {
  url: "ws://livekit.test",
  token: "session-token",
  listen: { url: "ws://livekit.test", token: "listen-token", room_name: "voice-labs-s1--listen-browser-s1", track: "translation-for-browser-s1" },
  sessionId: "s1",
  sessionToken: "vls_creator",
  tokenExpiresAt: Math.floor(Date.now() / 1000) + 600,
};

let now = 0;
let playResult: () => Promise<void>;

function audioTrack(name: string, mediaTrack: object = { id: name }) {
  const element = document.createElement("audio");
  element.play = vi.fn(() => playResult());
  return {
    publication: { trackName: name },
    track: {
      kind: "audio",
      mediaStreamTrack: mediaTrack,
      attach: () => element,
      detach: () => [element],
      getReceiverStats: vi.fn().mockResolvedValue({ bytesReceived: 900, concealedSamples: 0 }),
    },
    element,
  };
}

const other = { identity: "guest-1a2b", isAgent: false, getTrackPublication: () => undefined };
const agent = { identity: "voice-labs-agent-voice-labs-s1", isAgent: true, getTrackPublication: () => undefined };

/** The listen room is the second Room the hook creates; the session room is the first. */
const sessionRoom = () => mocks.rooms[0].handlers;
const listenRoom = () => mocks.rooms[1].handlers;
const emit = (handlers: Handlers, event: string, ...args: unknown[]) => act(() => { handlers[event]?.(...args); });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rooms.length = 0;
  mocks.samplers.length = 0;
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  playResult = () => Promise.resolve();
  mocks.connect.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.setMicrophoneEnabled.mockResolvedValue(undefined);
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: class { state = "running"; resume = vi.fn().mockResolvedValue(undefined); close = vi.fn().mockResolvedValue(undefined); },
  });
  window.history.replaceState(null, "", "/call");
  try { window.localStorage.clear(); } catch { /* ignore */ }
  delete (window as unknown as { __voiceLabsLatency?: unknown }).__voiceLabsLatency;
});
afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll("[data-voice-labs-audio]").forEach((element) => element.remove());
});

async function connect(diagnostics: boolean, creds: CallCredentials = credentials) {
  if (diagnostics) window.history.replaceState(null, "", "/call?latency=1");
  const hook = renderHook(() => useCallRoom({ otherName: "Sam" }));
  await act(async () => { hook.result.current.primeAudio(); await hook.result.current.connect(creds); });
  return hook;
}

const names = (hook: Awaited<ReturnType<typeof connect>>) => hook.result.current.latency.snapshot().map((event) => event.name);

test("the translation is received through the private listen room, with its own token", async () => {
  const hook = await connect(false);
  expect(mocks.connect).toHaveBeenCalledWith("ws://livekit.test", "session-token");
  expect(mocks.connect).toHaveBeenCalledWith("ws://livekit.test", "listen-token");
  expect(mocks.rooms).toHaveLength(2);
  const { publication, track, element } = audioTrack("translation-for-browser-s1");
  emit(listenRoom(), "TrackSubscribed", track, publication, agent);
  expect(document.body.contains(element)).toBe(true); // played through the same element path as before
  expect(element.play).toHaveBeenCalledTimes(1);
  expect(hook.result.current.state.phase).toBe("live");
});

test("without a listen connection (a shared-room session) only the session room is joined", async () => {
  await connect(false, { ...credentials, listen: undefined });
  expect(mocks.rooms).toHaveLength(1);
});

test("diagnostics are off by default: nothing is recorded, nothing is exposed, no analyser is created", async () => {
  const hook = await connect(false);
  const { publication, track } = audioTrack("translation-for-browser-s1");
  emit(listenRoom(), "TrackSubscribed", track, publication, agent);
  expect(hook.result.current.latency.enabled).toBe(false);
  expect(hook.result.current.latency.snapshot()).toEqual([]);
  expect((window as unknown as { __voiceLabsLatency?: unknown }).__voiceLabsLatency).toBeUndefined();
  expect(mocks.samplers).toHaveLength(0);
  expect(track.getReceiverStats).not.toHaveBeenCalled();
});

test("with ?latency=1: room connected, track subscribed, playback and voiced onsets are recorded for this listener", async () => {
  const hook = await connect(true);
  emit(sessionRoom(), "ParticipantConnected", other); // the other person, seen in the session room
  now = 1200;
  const { publication, track, element } = audioTrack("translation-for-browser-s1");
  emit(listenRoom(), "TrackSubscribed", track, publication, agent);
  now = 1250;
  act(() => { element.dispatchEvent(new Event("playing")); });

  expect(names(hook)).toEqual(expect.arrayContaining(["listener_room_connected", "translated_track_subscribed", "playback_started"]));
  const subscribed = hook.result.current.latency.snapshot().find((event) => event.name === "translated_track_subscribed")!;
  expect(subscribed).toMatchObject({ listener: "browser-s1", speaker: "guest-1a2b", track: "translation-for-browser-s1", at: 1200 });

  // The analyser reads the translated track itself (not the microphone), at 20 ms.
  expect(mocks.samplers).toHaveLength(1);
  expect(mocks.samplers[0].track).toBe(track.mediaStreamTrack);
  expect(mocks.samplers[0].start).toHaveBeenCalled();

  // Synthetic levels: silence, a 300 ms translation, silence, a second translation.
  const feed = (level: number, from: number, to: number) => { for (let t = from; t < to; t += 20) { now = t; mocks.samplers[0].onLevel(level); } };
  feed(0, 1260, 2000);
  feed(0.3, 2000, 2300);
  feed(0, 2300, 2900);
  feed(0.25, 3500, 3700);
  feed(0, 3700, 4400);
  const voiced = hook.result.current.latency.snapshot().filter((event) => event.name.startsWith("browser_"));
  expect(voiced.map((event) => [event.name, event.seq, event.at])).toEqual([
    ["browser_first_voiced_audio", 1, 2000],
    ["browser_voiced_audio_ended", 1, 2280],
    ["browser_first_voiced_audio", 2, 3500],
    ["browser_voiced_audio_ended", 2, 3680],
  ]);
  // Silence before the first translation produced nothing.
  expect(voiced.every((event) => event.at >= 2000)).toBe(true);
  expect(typeof (window as unknown as { __voiceLabsLatency: { export: () => string } }).__voiceLabsLatency.export()).toBe("string");
});

test("tracks that are not our translation are never measured (the other person's microphone, our own)", async () => {
  const hook = await connect(true);
  const mic = audioTrack("microphone");
  emit(sessionRoom(), "TrackSubscribed", mic.track, mic.publication, other);
  expect(names(hook)).not.toContain("translated_track_subscribed");
  expect(mocks.samplers).toHaveLength(0);
});

test("a blocked or failed playback is reported with its reason, and the page is told sound is blocked", async () => {
  playResult = () => Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
  const hook = await connect(true);
  const { publication, track } = audioTrack("translation-for-browser-s1");
  await act(async () => { listenRoom().TrackSubscribed?.(track, publication, agent); await Promise.resolve(); });
  const failed = hook.result.current.latency.snapshot().find((event) => event.name === "playback_failed");
  expect(failed?.detail).toEqual({ reason: "NotAllowedError" });
  expect(hook.result.current.state.soundBlocked).toBe(true);
});

test("playback status changes, stalls, errors and reconnects of the listen room are recorded", async () => {
  const hook = await connect(true);
  const { publication, track, element } = audioTrack("translation-for-browser-s1");
  emit(listenRoom(), "TrackSubscribed", track, publication, agent);
  act(() => { element.dispatchEvent(new Event("waiting")); element.dispatchEvent(new Event("stalled")); element.dispatchEvent(new Event("error")); });
  emit(listenRoom(), "Reconnecting");
  emit(listenRoom(), "Reconnected");
  emit(listenRoom(), "TrackUnsubscribed", track);
  expect(names(hook)).toEqual(expect.arrayContaining(["element_waiting", "element_stalled", "element_error", "listener_reconnecting", "listener_reconnected", "translated_track_unsubscribed"]));
});

test("a listen room that cannot connect fails the join and says so; the session room is left again", async () => {
  mocks.connect.mockImplementation(async (_url: string, token: string) => { if (token === "listen-token") throw new Error("could not establish signal connection"); });
  const hook = await connect(true);
  expect(hook.result.current.state.phase).toBe("failed");
  expect(names(hook)).toContain("listener_connect_failed");
  expect(names(hook)).not.toContain("listener_room_connected");
  expect(mocks.disconnect).toHaveBeenCalled();
});

test("losing the listen room unexpectedly tells the person they lost the translation audio", async () => {
  const hook = await connect(false);
  emit(listenRoom(), "Disconnected", 1);
  expect(hook.result.current.state.phase).toBe("disconnected");
});

test("a suspended audio context is reported instead of guessed, and nothing is invented", async () => {
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: class { state = "suspended"; resume = vi.fn().mockResolvedValue(undefined); close = vi.fn().mockResolvedValue(undefined); },
  });
  const hook = await connect(true);
  const { publication, track } = audioTrack("translation-for-browser-s1");
  emit(listenRoom(), "TrackSubscribed", track, publication, agent);
  const unavailable = hook.result.current.latency.snapshot().find((event) => event.name === "analyser_unavailable");
  expect(unavailable?.detail).toEqual({ reason: "audio_context_not_running" });
  expect(names(hook)).not.toContain("browser_first_voiced_audio");
});

test("the RTP receiver is polled for the first bytes and concealed samples only with diagnostics on", async () => {
  vi.useFakeTimers();
  const hook = await connect(true);
  const { publication, track } = audioTrack("translation-for-browser-s1");
  track.getReceiverStats.mockResolvedValueOnce({ bytesReceived: 0, concealedSamples: 0 })
    .mockResolvedValueOnce({ bytesReceived: 400, concealedSamples: 0 })
    .mockResolvedValue({ bytesReceived: 1600, concealedSamples: 480 });
  emit(listenRoom(), "TrackSubscribed", track, publication, agent);
  await act(async () => { await vi.advanceTimersByTimeAsync(800); });
  vi.useRealTimers();
  const events = hook.result.current.latency.snapshot();
  expect(events.filter((event) => event.name === "first_rtp_audio_received")).toHaveLength(1);
  expect(events.find((event) => event.name === "audio_concealment")?.detail).toEqual({ added_samples: 480 });
});
