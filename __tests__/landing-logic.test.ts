import { describe, expect, it } from "vitest";
import { LATENCY_STAGES } from "@/lib/landing/config";
import { barSpecs, median } from "@/lib/landing/math";
import { pinProgress, scrollProgress } from "@/lib/landing/scroll";

describe("scroll progress", () => {
  const vh = 900;
  it("scrubs a tall pinned section from its top to its bottom", () => {
    const height = 2400;
    expect(pinProgress({ top: 100, height }, vh)).toBe(0);
    expect(pinProgress({ top: -(height - vh) / 2, height }, vh)).toBeCloseTo(0.5);
    expect(pinProgress({ top: -(height - vh), height }, vh)).toBe(1);
  });
  it("uses the entering formula once the section is short (stacked under 900px)", () => {
    expect(pinProgress({ top: 900, height: 800 }, vh)).toBe(0);
    expect(pinProgress({ top: 765 - 360, height: 800 }, vh)).toBeCloseTo(0.5);
  });
  it("scrubs over exactly the pinned distance when the panel height is known", () => {
    // 1200px section, 780px sticky panel at top 76px: pinned for 1200 - 780 - 76 = 344px.
    expect(pinProgress({ top: 76, height: 1200 }, vh, 780)).toBe(0);
    expect(pinProgress({ top: 76 - 172, height: 1200 }, vh, 780)).toBeCloseTo(0.5);
    expect(pinProgress({ top: 76 - 344, height: 1200 }, vh, 780)).toBe(1);
    // Not pinned (stacked under 900px: section and panel are the same height): the entering formula.
    expect(pinProgress({ top: 765 - 360, height: 800 }, vh, 800)).toBeCloseTo(0.5);
  });
  it("measures the hero leaving the viewport", () => {
    expect(scrollProgress({ top: -430, height: 860 }, vh, "exit")).toBeCloseTo(0.5);
    expect(scrollProgress({ top: -2000, height: 860 }, vh, "exit")).toBe(1);
  });
});

describe("waveform bars", () => {
  it("are deterministic per seed", () => {
    expect(barSpecs(32, 3, 52)).toEqual(barSpecs(32, 3, 52));
    expect(barSpecs(32, 3, 52)).not.toEqual(barSpecs(32, 4, 52));
    expect(barSpecs(48, 1, 38).every((b) => b.height >= 7 && b.height <= 38)).toBe(true);
  });
});

describe("helpers", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("latency stages are placeholders, never invented numbers", () => {
    expect(LATENCY_STAGES.map((s) => s.id)).toEqual(["T0", "T1", "T2", "T3", "T4", "T5"]);
    expect(LATENCY_STAGES.slice(1).every((s) => s.p50Ms === null)).toBe(true);
  });
});
