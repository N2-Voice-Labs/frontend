import { afterEach, expect, test, vi } from "vitest";
import { SILENCE_VOICES, VoicePlayer } from "@/lib/cinematic/voice-cues";

const node = () => ({ connect: vi.fn((n: unknown) => n), disconnect: vi.fn() });
const fakeCtx = () =>
  ({
    createGain: () => ({ ...node(), gain: { value: 1 } }),
    createStereoPanner: () => ({ ...node(), pan: { value: 0 } }),
    createBufferSource: () => ({ ...node(), buffer: null, start: vi.fn(), stop: vi.fn(), onended: null }),
    decodeAudioData: vi.fn(() => Promise.reject(new Error("no"))),
  }) as unknown as AudioContext;

const cues = Object.values(SILENCE_VOICES);

afterEach(() => {
  vi.unstubAllGlobals();
});

test("preload with a failing fetch does not throw", async () => {
  const fetchMock = vi.fn(() => Promise.resolve({ ok: false }));
  vi.stubGlobal("fetch", fetchMock);
  const ctx = fakeCtx();
  const player = new VoicePlayer(ctx, node() as unknown as AudioNode);
  expect(() => player.preload(cues)).not.toThrow();
  expect(() => player.preload(cues)).not.toThrow();
  await new Promise((r) => setTimeout(r, 0));
  expect(fetchMock).toHaveBeenCalledTimes(cues.length);
  expect(ctx.decodeAudioData).not.toHaveBeenCalled();
});

test("play falls back without throwing when speechSynthesis is undefined", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
  vi.stubGlobal("speechSynthesis", undefined);
  const player = new VoicePlayer(fakeCtx(), node() as unknown as AudioNode);
  player.preload(cues);
  expect(() => player.play(SILENCE_VOICES.koHello)).not.toThrow();
  await new Promise((r) => setTimeout(r, 0));
  expect(() => player.play(SILENCE_VOICES.enHello)).not.toThrow();
});

test("stop does not throw", () => {
  vi.stubGlobal("speechSynthesis", undefined);
  const player = new VoicePlayer(fakeCtx(), node() as unknown as AudioNode);
  expect(() => player.stop()).not.toThrow();
});
