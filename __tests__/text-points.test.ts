import { describe, expect, it } from "vitest";
import { EMPTY_POINTS, sampleTextPoints } from "@/lib/cinematic/text-points";

describe("sampleTextPoints", () => {
  it("returns no points without a canvas 2D context", () => {
    const root = document.createElement("p");
    root.className = "ct";
    root.innerHTML = `<span class="ct-line"><span class="ct-w"><span class="ct-i">We</span></span> <span class="ct-w"><span class="ct-i">speak</span></span></span>`;
    document.body.appendChild(root);
    const pts = sampleTextPoints(root, 800);
    expect(pts.count).toBe(0);
    expect(pts.xy.length).toBe(0);
    root.remove();
  });

  it("returns EMPTY_POINTS for an element without words", () => {
    const root = document.createElement("div");
    expect(sampleTextPoints(root, 800)).toBe(EMPTY_POINTS);
    expect(sampleTextPoints(root, 800).count).toBe(0);
  });
});
