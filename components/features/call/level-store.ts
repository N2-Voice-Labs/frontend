/**
 * Audio levels outside React (design system §3.10).
 *
 * Meters bind their element to a key ("self", "other", "interp"). `set()` writes the level straight
 * into the element's `--level` CSS variable, so a level sample never causes a React render. Writes are
 * skipped when the value barely changed. Under reduced motion the level is bucketed into 3 steps and
 * written at most every 500 ms.
 */
export type LevelKey = "self" | "other" | "interp";

const EPSILON = 0.02;
const REDUCED_INTERVAL_MS = 500;

export class LevelStore {
  private targets = new Map<LevelKey, Set<HTMLElement>>();
  private values = new Map<LevelKey, number>();
  private lastWrite = new Map<LevelKey, number>();
  private reduced: boolean;

  constructor(options: { reducedMotion?: boolean } = {}) {
    this.reduced = options.reducedMotion ?? prefersReducedMotion();
  }

  get reducedMotion() {
    return this.reduced;
  }

  bind(key: LevelKey, element: HTMLElement): () => void {
    let set = this.targets.get(key);
    if (!set) this.targets.set(key, (set = new Set()));
    set.add(element);
    write(element, this.values.get(key) ?? 0);
    return () => {
      set?.delete(element);
    };
  }

  get(key: LevelKey): number {
    return this.values.get(key) ?? 0;
  }

  set(key: LevelKey, raw: number, now = Date.now()) {
    let value = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
    if (value < EPSILON) value = 0;
    if (this.reduced) {
      value = value === 0 ? 0 : value < 0.34 ? 0.33 : value < 0.67 ? 0.66 : 1;
      const last = this.lastWrite.get(key) ?? -Infinity;
      if (value !== 0 && now - last < REDUCED_INTERVAL_MS) return;
    }
    const previous = this.values.get(key) ?? 0;
    if (value === previous || (value !== 0 && Math.abs(value - previous) < EPSILON)) return;
    this.values.set(key, value);
    this.lastWrite.set(key, now);
    this.targets.get(key)?.forEach((element) => write(element, value));
  }

  reset() {
    for (const key of [...this.values.keys()]) this.set(key, 0);
  }
}

function write(element: HTMLElement, value: number) {
  element.style.setProperty("--level", value.toFixed(2));
  const active = value > 0 ? "true" : "false";
  if (element.dataset.active !== active) element.dataset.active = active; // only when it flips
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type LevelSampler = { start: () => void; stop: () => void; dispose: () => void; readonly running: boolean };

/**
 * Samples one MediaStreamTrack with an AnalyserNode every `intervalMs` (default 50 ms = 20 Hz), on a
 * timer rather than every animation frame (3–6× fewer wakeups).
 * The loop runs only after `start()` and stops by itself once the level has stayed under the silence
 * threshold for `tailMs`, so a silent call runs no loop at all. Returns null where Web Audio is missing.
 */
export function createLevelSampler(
  track: MediaStreamTrack,
  context: AudioContext | null,
  onLevel: (level: number) => void,
  options: { intervalMs?: number; tailMs?: number } = {},
): LevelSampler | null {
  if (!context || typeof MediaStream === "undefined") return null;
  const intervalMs = options.intervalMs ?? 50;
  const tailMs = options.tailMs ?? 600;
  let source: MediaStreamAudioSourceNode;
  let analyser: AnalyserNode;
  try {
    source = context.createMediaStreamSource(new MediaStream([track]));
    analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);
  } catch {
    return null;
  }
  const buffer = new Uint8Array(analyser.fftSize);
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastLoud = 0;
  let running = false;

  const tick = () => {
    if (!running) return;
    const now = performance.now();
    {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let index = 0; index < buffer.length; index += 1) {
        const sample = (buffer[index] - 128) / 128;
        sum += sample * sample;
      }
      // RMS of speech sits around 0.02–0.3; scale so normal speech fills most of the meter.
      const level = Math.min(1, Math.sqrt(sum / buffer.length) * 4);
      if (level >= EPSILON) lastLoud = now;
      onLevel(level);
      if (now - lastLoud > tailMs) {
        stop();
        onLevel(0);
      }
    }
  };

  function start() {
    if (running) return;
    running = true;
    lastLoud = performance.now();
    timer = setInterval(tick, intervalMs);
  }
  function stop() {
    running = false;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }
  return {
    start,
    stop,
    dispose() {
      stop();
      try { source.disconnect(); } catch { /* already gone */ }
    },
    get running() { return running; },
  };
}
