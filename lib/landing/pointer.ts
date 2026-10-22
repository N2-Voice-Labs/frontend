"use client";

/**
 * One pointer tracker for every cursor-interactive background ("the cursor is a voice"): the hero
 * network, the signal band, the footer ASCII field and the dot spotlights.
 *
 * - Mouse and pen only. A touch pointer marks the cursor as absent, so touch never hijacks scrolling.
 * - Readers poll `pointer` inside their own rAF loop; nothing here renders or touches layout.
 * - `onBackgroundClick` fires for clicks that are not on a control (links, buttons, inputs, tabs).
 * - Under prefers-reduced-motion, `pointerActive()` is false and clicks are not reported.
 */

export type PointerState = {
  /** Viewport coordinates (clientX/Y); far off screen when there is no cursor. */
  x: number;
  y: number;
  /** A mouse/pen cursor is over the page. */
  mouse: boolean;
  /** Smoothed speed in px per ms (capped at 4). Readers may decay it as they consume it. */
  speed: number;
};

export const pointer: PointerState = { x: -1e4, y: -1e4, mouse: false, speed: 0 };

type ClickListener = (x: number, y: number) => void;
const clickListeners = new Set<ClickListener>();
let lastTime = 0;
let installed = false;
let reduce = false;

const isControl = (el: EventTarget | null) =>
  el instanceof Element && !!el.closest('a,button,input,select,textarea,label,summary,[role="tab"],[role="radio"]');

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  reduce = !!media?.matches;
  media?.addEventListener("change", (e) => { reduce = e.matches; });

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") { pointer.mouse = false; return; }
    const now = performance.now();
    const dt = Math.max(8, now - (lastTime || now - 16));
    const v = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) / dt;
    pointer.speed = pointer.mouse ? pointer.speed * 0.7 + Math.min(v, 4) * 0.3 : 0;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.mouse = true;
    lastTime = now;
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => { pointer.mouse = false; });
  window.addEventListener("blur", () => { pointer.mouse = false; });
  window.addEventListener("pointerdown", (e) => {
    if (reduce || e.pointerType === "touch" || isControl(e.target)) return;
    clickListeners.forEach((fn) => fn(e.clientX, e.clientY));
  }, { passive: true });
}

/** Starts tracking (idempotent). Call from an effect in any component that reads `pointer`. */
export function trackPointer() {
  install();
}

/** True when a mouse/pen cursor is on the page and motion is allowed. */
export function pointerActive() {
  install();
  return pointer.mouse && !reduce;
}

/** Background clicks (not on a control). Returns an unsubscribe function. */
export function onBackgroundClick(fn: ClickListener) {
  install();
  clickListeners.add(fn);
  return () => { clickListeners.delete(fn); };
}

/**
 * Ripple radius for a wave that started at `t0`. rAF timestamps can be slightly earlier than the click's
 * performance.now(), and a negative radius makes canvas arc() throw and kills the loop, so clamp at 0.
 */
export const rippleRadius = (now: number, t0: number, speed: number) => Math.max(0, now - t0) * speed;
