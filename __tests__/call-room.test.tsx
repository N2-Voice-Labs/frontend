import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PEER_GRACE_MS, TRANSLATING_TIMEOUT_MS } from "@/lib/call-state";
import { useCallRoom, type CallCredentials } from "@/components/features/call/use-call-room";

const mocks = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    handlers,
    connect: vi.fn(),
    disconnect: vi.fn(),
    startAudio: vi.fn(),
    switchActiveDevice: vi.fn(),
    setMicrophoneEnabled: vi.fn(),
    endVoiceSession: vi.fn(),
    roomOptions: [] as unknown[],
    instances: [] as Array<Record<string, (...args: unknown[]) => void>>,
    remoteParticipants: new Map<string, unknown>(),
  };
});

vi.mock("@/lib/platform", () => ({ endVoiceSession: mocks.endVoiceSession }));
vi.mock("livekit-client", () => ({
  Room: class {
    localParticipant = { identity: "browser-s1", setMicrophoneEnabled: mocks.setMicrophoneEnabled, getTrackPublication: () => undefined };
    remoteParticipants = mocks.remoteParticipants;
    canPlaybackAudio = true;
    own: Record<string, (...args: unknown[]) => void> = {};
    constructor(options: unknown) { mocks.roomOptions.push(options); mocks.instances.push(this.own); }
    on(event: string, callback: (...args: unknown[]) => void) { mocks.handlers[event] = callback; this.own[event] = callback; return this; }
    connect = mocks.connect;
    disconnect = mocks.disconnect;
    startAudio = mocks.startAudio;
    switchActiveDevice = mocks.switchActiveDevice;
  },
  RoomEvent: {
    ActiveSpeakersChanged: "activeSpeakersChanged",
    AudioPlaybackStatusChanged: "audioPlaybackChanged",
    ConnectionQualityChanged: "connectionQualityChanged",
    Disconnected: "disconnected",
    ParticipantConnected: "participantConnected",
    ParticipantDisconnected: "participantDisconnected",
    Reconnected: "reconnected",
    Reconnecting: "reconnecting",
    SignalReconnecting: "signalReconnecting",
    TrackMuted: "trackMuted",
    TrackSubscribed: "trackSubscribed",
    TrackUnmuted: "trackUnmuted",
    TrackUnsubscribed: "trackUnsubscribed",
  },
  Track: { Kind: { Audio: "audio" }, Source: { Microphone: "microphone" } },
}));

const credentials: CallCredentials = {
  url: "ws://livekit.test",
  token: "creator-token",
  sessionId: "s1",
  sessionToken: "vls_creator",
  tokenExpiresAt: Math.floor(Date.now() / 1000) + 600,
};

const guest = { identity: "guest-1a2b3c4d", isAgent: false, audioLevel: 0.6, getTrackPublication: () => undefined };
const interpreter = { identity: "voice-labs-agent-voice-labs-s1", isAgent: true, audioLevel: 0.4, getTrackPublication: () => undefined };
const me = { identity: "browser-s1", isLocal: true, audioLevel: 0.5 };
const emit = (event: string, ...args: unknown[]) => act(() => { mocks.handlers[event]?.(...args); });

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(mocks.handlers)) delete mocks.handlers[key];
  mocks.remoteParticipants.clear();
  mocks.roomOptions.length = 0;
  mocks.instances.length = 0;
  mocks.connect.mockResolvedValue(undefined);
  mocks.setMicrophoneEnabled.mockResolvedValue(undefined);
  mocks.startAudio.mockResolvedValue(undefined);
  mocks.endVoiceSession.mockResolvedValue({ status: "ended" });
  // A real Room emits Disconnected when disconnect() is called; the hook must treat that as intentional.
  mocks.disconnect.mockImplementation(async () => { mocks.handlers.disconnected?.(1); });
});
afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll("[data-voice-labs-audio]").forEach((element) => element.remove());
});

async function connected() {
  const hook = renderHook(() => useCallRoom({ otherName: "Ji-woo" }));
  await act(async () => { await hook.result.current.connect(credentials); });
  return hook;
}

test("joins LiveKit with the chosen mic, turns the mic on, and classifies who is in the room", async () => {
  const { result } = await connected();
  expect(mocks.connect).toHaveBeenCalledWith("ws://livekit.test", "creator-token");
  expect(mocks.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  expect(result.current.state.phase).toBe("live");
  expect(result.current.state.other.presence).toBe("waiting");

  emit("participantConnected", interpreter);
  expect(result.current.state.interpreter.present).toBe(true);
  expect(result.current.state.other.presence).toBe("waiting");

  emit("participantConnected", guest);
  expect(result.current.state.other.presence).toBe("present");
  expect(result.current.state.other.identity).toBe("guest-1a2b3c4d");
});

test("a missing LiveKit token fails without creating a room", async () => {
  const { result } = renderHook(() => useCallRoom());
  await act(async () => { await result.current.connect({ ...credentials, token: "" }); });
  expect(result.current.state.phase).toBe("failed");
  expect(result.current.state.error).toMatch(/aren’t set up/);
  expect(mocks.roomOptions).toHaveLength(0);
});

test("speaking, then silence before the interpreter speaks, is an inferred 'translating' that times out", async () => {
  vi.useFakeTimers();
  const { result } = await connected();
  emit("participantConnected", interpreter);
  emit("participantConnected", guest);

  emit("activeSpeakersChanged", [guest]);
  expect(result.current.state.other.speaking).toBe(true);
  expect(result.current.state.translating).toBeNull();

  emit("activeSpeakersChanged", []);
  expect(result.current.state.translating?.toward).toBe("self");

  act(() => { vi.advanceTimersByTime(TRANSLATING_TIMEOUT_MS + 10); });
  expect(result.current.state.translating).toBeNull();

  // Interpreter starting to speak ends the inferred state immediately.
  emit("activeSpeakersChanged", [me]);
  emit("activeSpeakersChanged", []);
  expect(result.current.state.translating?.toward).toBe("other");
  emit("activeSpeakersChanged", [interpreter]);
  expect(result.current.state.translating).toBeNull();
  expect(result.current.state.interpreter.speaking).toBe(true);
});

test("an unexpected drop never ends the call for the other person, and rejoin reconnects with the same token", async () => {
  const { result } = await connected();
  emit("disconnected", 0);
  expect(result.current.state.phase).toBe("disconnected");
  expect(mocks.endVoiceSession).not.toHaveBeenCalled();
  expect(result.current.canRejoin()).toBe(true);

  await act(async () => { await result.current.rejoin(); });
  expect(mocks.connect).toHaveBeenCalledTimes(2);
  expect(result.current.state.phase).toBe("live");
});

test("the same invite opened elsewhere is reported, not treated as a normal drop", async () => {
  const { result } = await connected();
  emit("disconnected", 2);
  expect(result.current.state.inUseElsewhere).toBe(true);
});

test("when the other person drops they show as reconnecting, then the call ends after the grace period", async () => {
  vi.useFakeTimers();
  const { result } = await connected();
  emit("participantConnected", guest);
  emit("participantDisconnected", guest);
  expect(result.current.state.other.presence).toBe("reconnecting");

  // Coming back within the grace period keeps the call.
  emit("participantConnected", guest);
  expect(result.current.state.other.presence).toBe("present");
  emit("participantDisconnected", guest);

  await act(async () => { await vi.advanceTimersByTimeAsync(PEER_GRACE_MS + 10); });
  expect(mocks.endVoiceSession).toHaveBeenCalledWith("s1", "vls_creator");
  expect(result.current.state.phase).toBe("ended");
  expect(result.current.state.endReason).toBe("peer-lost");
});

test("End disconnects, then ends the session for both with the session token; a failure can be retried", async () => {
  const { result } = await connected();
  mocks.endVoiceSession.mockRejectedValueOnce(new Error("Platform returned 503"));
  await act(async () => { await result.current.end(); });
  expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  expect(result.current.state.endError).toBe("Platform returned 503");
  expect(result.current.state.phase).toBe("disconnected");

  await act(async () => { await result.current.end(); });
  expect(mocks.endVoiceSession).toHaveBeenLastCalledWith("s1", "vls_creator");
  expect(result.current.state.phase).toBe("ended");
  expect(result.current.state.endReason).toBe("self");
  expect(mocks.disconnect).toHaveBeenCalledTimes(1);
});

test("the server deleting the room ends the call without another /end", async () => {
  const { result } = await connected();
  emit("disconnected", 5);
  expect(result.current.state.phase).toBe("ended");
  expect(mocks.endVoiceSession).not.toHaveBeenCalled();
});

test("unmounting disconnects but sends no /end, like closing the tab", async () => {
  const { unmount } = await connected();
  unmount();
  expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  expect(mocks.endVoiceSession).not.toHaveBeenCalled();
});

test("audio tracks are attached with the shared data attribute; blocked playback is surfaced and recoverable", async () => {
  const { result } = await connected();
  const element = document.createElement("audio");
  element.play = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
  const track = { kind: "audio", attach: () => element, detach: () => [element], mediaStreamTrack: {} };
  await act(async () => {
    mocks.handlers.trackSubscribed(track, { trackName: "translation-for-browser-s1" }, interpreter);
    await Promise.resolve();
  });
  expect(document.querySelectorAll("audio[data-voice-labs-audio]")).toHaveLength(1);
  expect(result.current.state.soundBlocked).toBe(true);

  element.play = vi.fn().mockResolvedValue(undefined);
  await act(async () => { await result.current.startAudio(); });
  expect(mocks.startAudio).toHaveBeenCalled();
  expect(result.current.state.soundBlocked).toBe(false);

  emit("trackUnsubscribed", track);
  expect(document.querySelectorAll("audio[data-voice-labs-audio]")).toHaveLength(0);
});

test("mute, remote mute, connection quality and reconnecting flow into state", async () => {
  const { result } = await connected();
  emit("participantConnected", guest);
  await act(async () => { await result.current.setMuted(true); });
  expect(mocks.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
  expect(result.current.state.self.muted).toBe(true);

  emit("trackMuted", { source: "microphone" }, guest);
  expect(result.current.state.other.muted).toBe(true);
  emit("connectionQualityChanged", "poor", me);
  expect(result.current.state.self.quality).toBe("poor");
  emit("reconnecting");
  expect(result.current.state.phase).toBe("reconnecting");
  emit("reconnected");
  expect(result.current.state.phase).toBe("live");
});

test("livekit-client is loaded lazily inside connect(), not at import time", async () => {
  const { result } = renderHook(() => useCallRoom());
  expect(mocks.roomOptions).toHaveLength(0);
  await act(async () => { await result.current.connect(credentials); });
  expect(mocks.roomOptions).toHaveLength(1);
});

test("without a running AudioContext the bridge never guesses who is hearing the translation", async () => {
  const { result } = await connected();
  emit("participantConnected", interpreter);
  emit("participantConnected", guest);
  const element = document.createElement("audio");
  element.play = vi.fn().mockResolvedValue(undefined);
  await act(async () => {
    mocks.handlers.trackSubscribed({ kind: "audio", attach: () => element, detach: () => [element], mediaStreamTrack: {} }, { trackName: "translation-for-browser-s1" }, interpreter);
    await Promise.resolve();
  });
  emit("activeSpeakersChanged", [interpreter]);
  expect(result.current.state.interpreter.speaking).toBe(true);
  expect(result.current.state.hearingTranslation).toBeNull();
});

test("a superseded room's late Disconnected does not tear down the current call", async () => {
  const { result } = await connected();
  const first = mocks.instances[0];
  emit("disconnected", 0);
  const connectedAt = result.current.state.connectedAt;
  await act(async () => { await result.current.rejoin(); });
  expect(result.current.state.phase).toBe("live");
  // Rejoin keeps the call timer.
  expect(result.current.state.connectedAt).toBe(connectedAt);
  act(() => { first.disconnected(0); });
  expect(result.current.state.phase).toBe("live");
});

test("End pressed while connecting is reported, so the caller does not show a connect error", async () => {
  let finish!: () => void;
  mocks.connect.mockReturnValue(new Promise<void>((done) => { finish = done; }));
  const { result } = renderHook(() => useCallRoom());
  let ok: boolean | undefined;
  await act(async () => { void result.current.connect(credentials).then((value) => { ok = value; }); await Promise.resolve(); await Promise.resolve(); });
  await act(async () => { await result.current.end(); });
  await act(async () => { finish(); await Promise.resolve(); });
  expect(ok).toBe(false);
  expect(result.current.wasEnded()).toBe(true);
  expect(result.current.state.phase).toBe("ended");
});
