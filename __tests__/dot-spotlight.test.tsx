import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DotSpotlight } from "@/components/shared/dot-spotlight";
import { pointer } from "@/lib/landing/pointer";
import { updateSpotlights } from "@/lib/landing/spotlight";

function box(rect: { left: number; top: number; width: number; height: number }) {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON() {} }) as DOMRect;
  return el;
}

afterEach(() => { Object.assign(pointer, { x: -1e4, y: -1e4, mouse: false, speed: 0 }); });

describe("dot spotlight", () => {
  it("sets --spot, --mx and --my when the cursor is over the texture", () => {
    const el = box({ left: 100, top: 50, width: 400, height: 300 });
    Object.assign(pointer, { x: 160, y: 90, mouse: true });
    updateSpotlights([el]);
    expect(el.style.getPropertyValue("--spot")).toBe("1");
    expect(el.style.getPropertyValue("--mx")).toBe("60px");
    expect(el.style.getPropertyValue("--my")).toBe("40px");
  });

  it("turns off outside the texture", () => {
    const el = box({ left: 100, top: 50, width: 400, height: 300 });
    Object.assign(pointer, { x: 20, y: 90, mouse: true });
    updateSpotlights([el]);
    expect(el.style.getPropertyValue("--spot")).toBe("0");
  });

  it("row mode counts the whole row, sideways outside the box included", () => {
    const el = box({ left: 100, top: 50, width: 400, height: 300 });
    Object.assign(pointer, { x: 20, y: 90, mouse: true });
    updateSpotlights([el], true);
    expect(el.style.getPropertyValue("--spot")).toBe("1");
  });

  it("does nothing for touch (no cursor)", () => {
    const el = box({ left: 0, top: 0, width: 400, height: 300 });
    Object.assign(pointer, { x: 10, y: 10, mouse: false });
    updateSpotlights([el]);
    expect(el.style.getPropertyValue("--spot")).toBe("0");
    expect(el.style.getPropertyValue("--mx")).toBe("");
  });

  it("mounts and unmounts without errors", () => {
    const { unmount } = render(<DotSpotlight selector=".dots" />);
    unmount();
  });
});
