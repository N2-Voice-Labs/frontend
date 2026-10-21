"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Tracks an element's CSS size in a ref (no re-render), so per-frame canvas code never reads layout.
 * `onResize` runs after each change, e.g. to redraw a static frame.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>, onResize?: () => void) {
  const size = useRef({ w: 0, h: 0 });
  const cb = useRef(onResize);
  cb.current = onResize;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
      cb.current?.();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
