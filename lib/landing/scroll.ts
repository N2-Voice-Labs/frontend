"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { clamp } from "./math";

/**
 * How a section's 0–1 progress is measured.
 * - `pin`: a pinned section scrubs 0 → 1 over exactly the distance its sticky panel stays pinned.
 *   When the panel is not pinned (stacked under 900px) it uses the reference's second formula,
 *   "entering the viewport → mostly scrolled through".
 * - `through`: from the section's top entering the viewport until it has scrolled well past (languages).
 * - `exit`: how far the section has scrolled out of the top of the viewport (hero).
 */
export type ScrollMode = "pin" | "through" | "exit";

type Rect = Pick<DOMRect, "top" | "height">;

/** `top` of the sticky `.pin` panel (landing.css). */
export const PIN_TOP = 76;

/**
 * `panelHeight` is the sticky panel's height. Without it (or when the section is barely taller than its
 * panel, i.e. not pinned) this is the reference's entering formula.
 */
export function pinProgress(r: Rect, vh: number, panelHeight = 0) {
  const travel = r.height - panelHeight - PIN_TOP;
  if (panelHeight && travel > 40) return clamp((PIN_TOP - r.top) / travel);
  if (!panelHeight && r.height > vh * 1.6) return clamp(-r.top / (r.height - vh));
  return clamp((vh * 0.85 - r.top) / (r.height * 0.9));
}

export function scrollProgress(r: Rect, vh: number, mode: ScrollMode, panelHeight = 0) {
  if (mode === "pin") return pinProgress(r, vh, panelHeight);
  if (mode === "through") return clamp((vh - r.top) / (r.height + vh * 0.6));
  return clamp(-r.top / r.height);
}

/* ---------- One rAF-throttled, passive scroll + resize listener for the whole page ---------- */

type Listener = (vh: number) => void;
const listeners = new Set<Listener>();
let ticking = false;

function run() {
  ticking = false;
  const vh = window.innerHeight;
  listeners.forEach((fn) => fn(vh));
}

/** Schedules one update on the next frame (scroll, resize, or a state change that affects scroll UI). */
export function requestScrollUpdate() {
  if (ticking || typeof window === "undefined") return;
  ticking = true;
  requestAnimationFrame(run);
}

function subscribe(fn: Listener) {
  if (listeners.size === 0) {
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate);
  }
  listeners.add(fn);
  requestScrollUpdate();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      window.removeEventListener("scroll", requestScrollUpdate);
      window.removeEventListener("resize", requestScrollUpdate);
    }
  };
}

/**
 * Runs `fn(vh)` inside the shared scroll frame. For work that must not re-render React
 * (canvas loops read the value from a ref). `fn` should only read layout; write through React or refs.
 */
export function useScrollEffect(fn: Listener) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe((vh) => ref.current(vh)), []);
}

/**
 * 0–1 scroll progress of `ref`'s element. Re-renders only when the value changes, so sections
 * that are off-screen (clamped at 0 or 1) cost nothing while the page scrolls.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, mode: ScrollMode) {
  const [progress, setProgress] = useState(0);
  useScrollEffect((vh) => {
    const el = ref.current;
    if (!el) return;
    // The sticky panel is the section's first child (.pin); its height decides whether it is pinned.
    const panel = mode === "pin" ? (el.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0 : 0;
    const p = Math.round(scrollProgress(el.getBoundingClientRect(), vh, mode, panel) * 10000) / 10000;
    setProgress((prev) => (prev === p ? prev : p));
  });
  return progress;
}

/** `prefers-reduced-motion: reduce`, client-only (false during SSR and the first render). */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduce;
}
