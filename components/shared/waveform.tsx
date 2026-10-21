import type { CSSProperties } from "react";
import { barSpecs } from "@/lib/landing/math";

type WaveformProps = {
  seed: number;
  /** Number of bars (reference default 48). */
  n?: number;
  /** Tallest bar in px (reference default 38). */
  max?: number;
  /** `true` animates, `done` rests at half height, `false` rests low. */
  on?: boolean | "done";
  className?: string;
  style?: CSSProperties;
};

/** Decorative, deterministic waveform: the same seed always draws the same bars. */
export function Waveform({ seed, n = 48, max = 38, on, className, style }: WaveformProps) {
  return (
    <div className={className ? `bars ${className}` : "bars"} data-on={on === undefined ? undefined : String(on)} aria-hidden="true" style={style}>
      {barSpecs(n, seed, max).map((b, i) => (
        <span key={i} className="bar" style={{ height: b.height, animationDelay: b.delay }} />
      ))}
    </div>
  );
}
