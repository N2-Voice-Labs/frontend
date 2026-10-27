import { subscribeDirector } from "./director";

/**
 * Optional sound for the film, synthesised in the browser (no audio files): a low room tone that opens
 * up as the story moves on, a soft tone on every chapter change, the two voices of chapter 01 through
 * the browser's speech synthesis, and silence again at the end. Starts only from a click.
 */
export class FilmSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private unsubscribe: (() => void) | null = null;
  private chapter = -1;
  private spoke = false;
  on = false;

  /** Must run inside a user gesture. Returns false where the browser has no Web Audio. */
  enable() {
    if (this.on) return true;
    if (!this.ctx && !this.build()) return false;
    this.on = true;
    const ctx = this.ctx!;
    void ctx.resume();
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    this.unsubscribe = subscribeDirector((position, chapter) => this.follow(position, chapter));
    return true;
  }

  disable() {
    if (!this.on) return;
    this.on = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    setTimeout(() => { if (!this.on) void ctx.suspend(); }, 1200);
  }

  dispose() {
    this.disable();
    void this.ctx?.close();
    this.ctx = null;
  }

  private build() {
    const Ctor = typeof window === "undefined" ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 180;
    this.filter.Q.value = 0.7;
    const bed = ctx.createGain();
    bed.gain.value = 0.05;
    this.filter.connect(bed).connect(this.master);
    // Drone: two low sines a fifth apart, slightly detuned.
    for (const [freq, detune] of [[55, -4], [82.4, 5], [110, 0]] as const) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = freq === 110 ? 0.25 : 0.6;
      osc.connect(g).connect(this.filter);
      osc.start();
    }
    // Room tone: quiet filtered noise.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    src.connect(ng).connect(this.filter);
    src.start();
    return true;
  }

  private follow(position: number, chapter: number) {
    const ctx = this.ctx;
    if (!ctx || !this.filter || !this.master) return;
    // Opens from a muffled 180 Hz to ~900 Hz through the engine, then closes; the last beat is silence.
    const open = Math.sin(Math.min(1, position / 6) * Math.PI) * 700 + 180;
    this.filter.frequency.setTargetAtTime(open, ctx.currentTime, 0.3);
    const ending = Math.max(0, Math.min(1, (position - 7.5) / 0.25));
    this.master.gain.setTargetAtTime(1 - ending, ctx.currentTime, 0.4);
    if (chapter !== this.chapter) {
      if (this.chapter !== -1) this.tone(chapter);
      this.chapter = chapter;
    }
    if (!this.spoke && chapter === 0 && position > 0.08) {
      this.spoke = true;
      speak("안녕하세요.", "ko-KR", () => speak("Hello?", "en-US"));
    }
  }

  /** A short soft tone, pitched by chapter. */
  private tone(chapter: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = [440, 392, 523.25, 587.33, 659.25, 523.25, 698.46, 392][chapter] ?? 440;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
    osc.connect(g).connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + 1.7);
  }
}

function speak(text: string, lang: string, then?: () => void) {
  if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.9;
  u.volume = 0.7;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2)));
  if (voice) u.voice = voice;
  if (then) u.onend = () => setTimeout(then, 500);
  speechSynthesis.speak(u);
}
