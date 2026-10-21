export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const frac = (v: number) => v - Math.floor(v);
/** Smoothstep on 0–1. */
export const smooth = (v: number) => {
  const c = clamp(v);
  return c * c * (3 - 2 * c);
};

export function median(values: readonly number[]) {
  const s = values.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const formatSeconds = (sec: number) => `${sec.toFixed(2)} s`;

export type BarSpec = { height: number; delay: string };

/** Deterministic waveform bars (the reference's `fillBars`): same seed, same shape, on server and client. */
export function barSpecs(n: number, seed: number, maxH: number): BarSpec[] {
  const out: BarSpec[] = [];
  for (let i = 0; i < n; i++) {
    const env = Math.sin((Math.PI * (i + 0.5)) / n);
    const r = frac(Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453);
    out.push({ height: Math.round((0.2 + 0.8 * env * (0.4 + 0.6 * r)) * maxH), delay: `${(-(r * 1.4)).toFixed(2)}s` });
  }
  return out;
}
