import { expect, test } from "vitest";
import { LatencyRecorder, LIMITATIONS, VoicedOnsetDetector, latencyDiagnosticsEnabled, type VoicedChange } from "@/lib/audio-latency";

/** Feeds a synthetic level every `stepMs`: `[level, durationMs]` stretches, starting at `startMs`. */
function run(detector: VoicedOnsetDetector, stretches: Array<[number, number]>, startMs = 0, stepMs = 20): VoicedChange[] {
  const out: VoicedChange[] = [];
  let t = startMs;
  for (const [level, duration] of stretches) {
    for (let elapsed = 0; elapsed < duration; elapsed += stepMs) {
      const change = detector.feed(level, t);
      if (change) out.push(change);
      t += stepMs;
    }
  }
  return out;
}

test("silence and near-silence never count as voiced audio", () => {
  const detector = new VoicedOnsetDetector();
  expect(run(detector, [[0, 2000], [0.01, 2000], [0.03, 1000]])).toEqual([]);
  expect(detector.utterances).toBe(0);
});

test("a click shorter than the minimum is not an utterance", () => {
  const detector = new VoicedOnsetDetector();
  expect(run(detector, [[0, 200], [0.5, 20], [0, 1000]])).toEqual([]);
});

test("an utterance starts at its first voiced sample and ends at its last, after the gap", () => {
  const detector = new VoicedOnsetDetector();
  const changes = run(detector, [[0, 1000], [0.3, 600], [0, 1000]]);
  expect(changes).toEqual([
    { type: "onset", seq: 1, at: 1000 },
    { type: "end", seq: 1, at: 1580 },
  ]);
});

test("consecutive translations to the same listener are separate, numbered utterances", () => {
  const detector = new VoicedOnsetDetector();
  const changes = run(detector, [[0, 500], [0.2, 800], [0, 700], [0.25, 400], [0, 700]]);
  expect(changes.map((change) => [change.type, change.seq])).toEqual([["onset", 1], ["end", 1], ["onset", 2], ["end", 2]]);
  expect(changes[2].at - changes[1].at).toBeGreaterThan(300);
});

test("a short pause inside one utterance does not split it", () => {
  const detector = new VoicedOnsetDetector();
  const changes = run(detector, [[0.2, 500], [0, 200], [0.2, 500], [0, 800]]);
  expect(changes.map((change) => change.type)).toEqual(["onset", "end"]);
  expect(detector.utterances).toBe(1);
});

test("a long translation on listener A's track does not touch listener B's measurements", () => {
  const a = new VoicedOnsetDetector();
  const b = new VoicedOnsetDetector();
  const out: Record<string, VoicedChange[]> = { a: [], b: [] };
  // A's track is voiced from 1.0 s to 4.0 s; B's short utterance is voiced from 1.5 s to 1.9 s; interleaved sample by sample.
  for (let t = 0; t <= 6000; t += 20) {
    const levelA = t >= 1000 && t < 4000 ? 0.3 : 0;
    const levelB = t >= 1500 && t < 1900 ? 0.3 : 0;
    const ca = a.feed(levelA, t);
    const cb = b.feed(levelB, t);
    if (ca) out.a.push(ca);
    if (cb) out.b.push(cb);
  }
  expect(out.b.map((change) => [change.type, change.at])).toEqual([["onset", 1500], ["end", 1880]]);
  expect(out.a[0]).toEqual({ type: "onset", seq: 1, at: 1000 });
  expect(out.a[1].at).toBe(3980); // A's end is A's own; B's onset at 1.5 s was not delayed by A's 3 s
});

test("non-finite levels are treated as silence", () => {
  const detector = new VoicedOnsetDetector();
  expect(run(detector, [[Number.NaN, 500], [Number.POSITIVE_INFINITY, 20]])).toEqual([]);
});

test("diagnostics are off unless asked for, by query or by stored flag", () => {
  expect(latencyDiagnosticsEnabled("")).toBe(false);
  expect(latencyDiagnosticsEnabled("?latency=0")).toBe(false);
  expect(latencyDiagnosticsEnabled("?latency=1")).toBe(true);
  expect(latencyDiagnosticsEnabled("", { getItem: () => "1" })).toBe(true);
  expect(latencyDiagnosticsEnabled("", { getItem: () => { throw new Error("blocked"); } })).toBe(false);
});

test("a disabled recorder records nothing; an enabled one is bounded and carries who and which track", () => {
  const off = new LatencyRecorder({ enabled: false });
  off.record("playback_started");
  expect(off.snapshot()).toEqual([]);

  let now = 10;
  const on = new LatencyRecorder({ enabled: true, max: 3, now: () => (now += 5) });
  on.context = { listener: "browser-s1", speaker: "guest-1", track: "translation-for-browser-s1" };
  on.record("translated_track_subscribed");
  on.record("browser_first_voiced_audio", { seq: 1, at: 99 });
  on.record("playback_started");
  on.record("element_waiting");
  const events = on.snapshot();
  expect(events).toHaveLength(3); // the oldest was dropped
  expect(events[0]).toMatchObject({ name: "browser_first_voiced_audio", at: 99, seq: 1, listener: "browser-s1", speaker: "guest-1", track: "translation-for-browser-s1" });
});

test("the export names its clock and limits, and holds no speech or credentials", () => {
  const recorder = new LatencyRecorder({ enabled: true });
  recorder.context = { listener: "browser-s1", speaker: null, track: "translation-for-browser-s1" };
  recorder.record("playback_failed", { detail: { reason: "NotAllowedError" } });
  const text = recorder.export();
  const parsed = JSON.parse(text);
  expect(parsed.clock).toMatch(/performance\.now/);
  expect(typeof parsed.time_origin_epoch_ms).toBe("number"); // for same-host validation only (see the export's limitations)
  expect(parsed.limitations).toEqual([...LIMITATIONS]);
  expect(parsed.limitations.join(" ")).toMatch(/not confirmed audibility/);
  expect(text).not.toMatch(/vls_|token|transcript/i);
});
