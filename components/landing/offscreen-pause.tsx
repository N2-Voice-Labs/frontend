"use client";

import { useEffect } from "react";

/**
 * One motion per screen: marks landing sections that are less than a quarter visible with
 * `data-offscreen`, which pauses their CSS animations (orbits, ripples, pulses, bars).
 */
export function OffscreenPause() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.toggleAttribute("data-offscreen", e.intersectionRatio < 0.25);
    }, { threshold: [0, 0.25] });
    document.querySelectorAll("main > section").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  return null;
}
