"use client";

import { useEffect } from "react";
import { pointer, pointerActive, trackPointer } from "./pointer";

/**
 * Teal dot spotlight that follows the cursor on dot textures (`.dots`, `.page-bg`, the dashboard texture).
 * On a rAF-queued pointermove/scroll it sets, on every element matching `selector`:
 * `--spot` (1 when the cursor is over it, else 0) and `--mx` / `--my` (cursor position inside it).
 * The CSS (`::after` layers masked by a circle at --mx/--my) does the drawing.
 * `rows: true` counts the cursor as inside when it is within the element's vertical bounds only
 * (the agents page `.page-bg`, which fades out sideways). Off for touch and reduced motion.
 */
export function updateSpotlights(elements: Iterable<HTMLElement>, rows = false) {
  const active = pointerActive();
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    const inside = active && pointer.y >= r.top && pointer.y <= r.bottom && (rows || (pointer.x >= r.left && pointer.x <= r.right));
    el.style.setProperty("--spot", inside ? "1" : "0");
    if (inside) {
      el.style.setProperty("--mx", `${pointer.x - r.left}px`);
      el.style.setProperty("--my", `${pointer.y - r.top}px`);
    }
  }
}

export function useDotSpotlight(selector: string, options: { rows?: boolean } = {}) {
  const rows = !!options.rows;
  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    trackPointer();
    let queued = false;
    const run = () => {
      queued = false;
      updateSpotlights(document.querySelectorAll<HTMLElement>(selector), rows);
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(run);
    };
    window.addEventListener("pointermove", queue, { passive: true });
    window.addEventListener("scroll", queue, { passive: true });
    return () => {
      window.removeEventListener("pointermove", queue);
      window.removeEventListener("scroll", queue);
    };
  }, [selector, rows]);
}
