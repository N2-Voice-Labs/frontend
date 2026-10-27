/**
 * Shared, non-React state of the film. Scene ScrollTriggers write `position` (chapter index + 0–1
 * progress through it); the canvas reads it every frame, and the chapter indicator and sound layer
 * subscribe to it. Nothing here re-renders React on scroll.
 */
type Listener = (position: number, chapter: number) => void;

const listeners = new Set<Listener>();

export const director = {
  /** 0–8: chapter index + progress through that chapter. */
  position: 0,
  chapter: 0,
  /** Live audio levels (0–1) from the demo session, read by the canvas in the Reality chapter. */
  level: { you: 0, agent: 0 },
  /** Set by the page: scrolls (smoothly when Lenis runs) to an element. */
  scrollTo: (target: HTMLElement) => target.scrollIntoView({ behavior: "smooth" }),
};

export function setPosition(position: number) {
  if (position === director.position) return;
  director.position = position;
  director.chapter = Math.min(Math.floor(position), 7);
  listeners.forEach((fn) => fn(director.position, director.chapter));
}

export function subscribeDirector(fn: Listener) {
  listeners.add(fn);
  fn(director.position, director.chapter);
  return () => { listeners.delete(fn); };
}

/** True when the page runs the full film (JS on, motion allowed); set before paint by the inline script. */
export const isCinematic = () => typeof document !== "undefined" && document.documentElement.classList.contains("cine-js");

/**
 * Runs during HTML parsing, before first paint: turns on the fixed-layer film layout unless the visitor
 * prefers reduced motion. Without it (or without JS) the page is a plain, readable document.
 */
export const cinematicInitScript = `(function(){try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("cine-js")}catch(e){}})();`;
