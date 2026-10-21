"use client";

import { useEffect, useRef } from "react";
import type { LevelKey, LevelStore } from "./level-store";

/**
 * Audio level meter (design system §3.10): 5 bars driven by `--level`, written by the LevelStore
 * through a ref. The component itself renders once; levels never go through React state.
 * `binary` is for sources with no level data: a fixed shape that only breathes while active.
 */
export function LevelMeter({
  store,
  source,
  tone,
  active,
  binary = false,
  size = "md",
}: {
  store?: LevelStore | null;
  source: LevelKey;
  tone: "self" | "other" | "interp" | "idle";
  /** Whether the person is speaking right now (from state, not from the level). */
  active: boolean;
  binary?: boolean;
  size?: "sm" | "md";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !store || binary) return;
    return store.bind(source, element);
  }, [store, source, binary]);

  return (
    <span
      ref={ref}
      className="level-meter"
      data-tone={tone}
      data-size={size}
      data-speaking={active ? "true" : "false"}
      data-binary={binary ? "true" : "false"}
      aria-hidden="true"
    >
      <i style={{ "--w": 0.55 } as React.CSSProperties} />
      <i style={{ "--w": 0.8 } as React.CSSProperties} />
      <i style={{ "--w": 1 } as React.CSSProperties} />
      <i style={{ "--w": 0.8 } as React.CSSProperties} />
      <i style={{ "--w": 0.55 } as React.CSSProperties} />
    </span>
  );
}
