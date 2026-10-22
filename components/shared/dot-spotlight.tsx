"use client";

import { useDotSpotlight } from "@/lib/landing/spotlight";

/** Mounts the cursor spotlight for the dot textures matching `selector` (see lib/landing/spotlight.ts). */
export function DotSpotlight({ selector, rows }: { selector: string; rows?: boolean }) {
  useDotSpotlight(selector, { rows });
  return null;
}
