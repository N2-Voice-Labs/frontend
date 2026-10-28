import { lerp } from "@/lib/cinematic/visual";

/**
 * The bridge's arc in viewport px, shared by the canvas (visual.ts) and the SVG system (bridge-system.tsx)
 * so the two always line up. Chapter 02 ends with its particles laid along this arc.
 */
export function bridgeGeometry(w: number, h: number, portrait: boolean) {
  const x0 = w * (portrait ? 0.08 : 0.12), x1 = w * (portrait ? 0.92 : 0.88);
  const base = h * (portrait ? 0.6 : 0.64);
  const lift = h * 0.09;
  const at = (u: number) => ({ x: lerp(x0, x1, u), y: base - Math.sin(Math.PI * u) * lift });
  return { x0, x1, base, lift, at };
}

/** Same rule the stage uses for `Frame.portrait`. */
export const isPortrait = (w: number, h: number) => h > w * 1.15;
