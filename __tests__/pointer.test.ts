import { describe, expect, it, vi } from "vitest";
import { onBackgroundClick, pointer, pointerActive, rippleRadius, trackPointer } from "@/lib/landing/pointer";

const move = (type: string, x: number, y: number) =>
  window.dispatchEvent(Object.assign(new Event("pointermove"), { pointerType: type, clientX: x, clientY: y }));
const down = (target: Element, type = "mouse") => {
  const e = Object.assign(new Event("pointerdown", { bubbles: true }), { pointerType: type, clientX: 5, clientY: 6 });
  target.dispatchEvent(e);
};

describe("shared pointer tracker", () => {
  it("tracks mouse and pen, and drops the cursor on touch so touch never drives the backgrounds", () => {
    trackPointer();
    move("mouse", 100, 200);
    expect(pointer).toMatchObject({ x: 100, y: 200, mouse: true });
    expect(pointerActive()).toBe(true);
    move("touch", 300, 300);
    expect(pointer.mouse).toBe(false);
    move("pen", 10, 20);
    expect(pointer.mouse).toBe(true);
  });

  it("reports background clicks but not clicks on controls or touches", () => {
    const fn = vi.fn();
    const off = onBackgroundClick(fn);
    const bg = document.createElement("div");
    const btn = document.createElement("button");
    const inLink = document.createElement("span");
    const link = document.createElement("a");
    link.append(inLink);
    document.body.append(bg, btn, link);
    down(bg);
    down(btn);
    down(inLink);
    down(bg, "touch");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(5, 6);
    off();
    down(bg);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("never returns a negative ripple radius (rAF time can precede the click)", () => {
    expect(rippleRadius(1000, 1010, 0.55)).toBe(0);
    expect(rippleRadius(1100, 1000, 0.5)).toBe(50);
  });
});
