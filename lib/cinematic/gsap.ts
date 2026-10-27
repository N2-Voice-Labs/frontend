import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/**
 * Timeline helpers. Scene timelines are scrubbed by scroll and last exactly 1, so `at` and `dur` are
 * chapter progress (0–1), not seconds.
 */
type Targets = gsap.TweenTarget;

/** Words rise out of their line mask, one after another. */
export function revealWords(tl: gsap.core.Timeline, words: Targets, at: number, dur = 0.08) {
  tl.fromTo(words, { yPercent: 105, opacity: 0 }, { yPercent: 0, opacity: 1, duration: dur * 0.6, stagger: { amount: dur * 0.4 } }, at);
}

export function fadeIn(tl: gsap.core.Timeline, targets: Targets, at: number, dur = 0.05, from: gsap.TweenVars = { y: 16 }) {
  tl.fromTo(targets, { opacity: 0, ...from }, { opacity: 1, y: 0, x: 0, scale: 1, duration: dur }, at);
}

export function fadeOut(tl: gsap.core.Timeline, targets: Targets, at: number, dur = 0.05, to: gsap.TweenVars = { y: -16 }) {
  tl.to(targets, { opacity: 0, ...to, duration: dur }, at);
}
