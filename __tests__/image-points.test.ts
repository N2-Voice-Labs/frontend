import { describe, expect, it } from "vitest";
import { EMPTY_IMAGE_POINTS, paletteFor, sampleImagePoints } from "@/lib/cinematic/image-points";
import { BRIDGE, EN, INK, KO } from "@/lib/cinematic/visual";

describe("sampleImagePoints", () => {
  it("returns no points for an image that is not loaded or laid out (jsdom)", () => {
    const img = document.createElement("img");
    img.src = "/brand/inha-dragon.webp";
    document.body.appendChild(img);
    expect(sampleImagePoints(img, 800)).toBe(EMPTY_IMAGE_POINTS);
    expect(sampleImagePoints(img, 800).count).toBe(0);
    img.remove();
  });

  it("returns no points for a non-positive target", () => {
    expect(sampleImagePoints(document.createElement("img"), 0)).toBe(EMPTY_IMAGE_POINTS);
  });
});

describe("paletteFor", () => {
  it("maps the dragon's colours onto the Inha film palette", () => {
    expect(paletteFor(150, 186, 230)).toBe(KO); // blue body → Sky Blue
    expect(paletteFor(230, 220, 195)).toBe(BRIDGE); // cream horns → Gold
    expect(paletteFor(205, 208, 216)).toBe(EN); // grey cloud-wings → Silver
    expect(paletteFor(232, 160, 178)).toBe(INK); // pink cheeks
    expect(paletteFor(30, 28, 30)).toBe(INK); // dark lines
  });
});
