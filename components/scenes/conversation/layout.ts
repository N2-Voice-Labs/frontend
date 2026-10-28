import { isPortrait } from "@/components/scenes/bridge/geometry";

/**
 * Where the two people and the (nearly invisible) system sit, in viewport px. Shared by the SVG signals,
 * the DOM text and the canvas so they always line up.
 *
 * Desktop: Minji left, Daniel right, the system below between them (a shallow V).
 * Portrait: Minji top, the system in the middle, Daniel bottom; the active speaker comes into focus.
 */
export function conversationLayout(w: number, h: number) {
  const portrait = isPortrait(w, h);
  if (portrait) {
    return {
      portrait,
      minji: { x: w / 2, y: h * 0.24 },
      daniel: { x: w / 2, y: h * 0.76 },
      centre: { x: w / 2, y: h * 0.5 },
      /** Half the length of each person's waveform. */
      wave: w * 0.36,
      /** Where the headline sits (centre of its block). */
      headlineY: h * 0.5,
    };
  }
  return {
    portrait,
    minji: { x: w * 0.25, y: h * 0.44 },
    daniel: { x: w * 0.75, y: h * 0.44 },
    centre: { x: w / 2, y: h * 0.66 },
    wave: w * 0.13,
    headlineY: h * 0.2,
  };
}

/** Chapter 03 hands over its VOICE OUT wave as a full-width line at this height (fraction of h). */
export const HANDOFF_Y = 0.42;
