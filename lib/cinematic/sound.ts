import { BEATS as BRIDGE, STAGES } from "@/components/scenes/bridge/beats";
import { BEATS as CONVERSATION } from "@/components/scenes/conversation/beats";
import { EVENTS, UTTERANCES, type Speaker } from "@/components/scenes/conversation/conversation-data";
import { BEATS as DISTANCE } from "@/components/scenes/distance/beats";
import { BEATS } from "@/components/scenes/silence/beats";
import { subscribeDirector } from "./director";
import { CONVERSATION_VOICES, DISTANCE_VOICES, SILENCE_VOICES, VoicePlayer, type VoiceCue } from "./voice-cues";

/** A tonal signal: sines (relative gains) under one envelope, optionally through a rising lowpass. */
type Signal = {
  freqs: readonly (readonly [number, number])[];
  peak: number;
  attack: number;
  hold: number;
  release: number;
  /** Lowpass cutoff sweep [from, to] over the attack, Hz. */
  sweep?: readonly [number, number];
};

/** A short blip's voice: frequency (Hz), peak gain, length (s). */
type Blip = { freq: number; peak: number; dur: number };

/** `at` / `until` are film positions (chapter index + progress). */
type Cue = { id: string; chapter: number; at: number; until: number } & (
  | { kind: "voice"; voice: VoiceCue }
  | { kind: "distant"; voice: VoiceCue }
  | { kind: "pulse"; pan: number; blip?: Blip }
  | { kind: "passby" }
  | { kind: "swell" }
  | { kind: "signal"; signal: Signal }
  /** Chapter 04's call: plays on its own player. */
  | { kind: "speech"; voice: VoiceCue }
  /** Chapter 04's barge-in: the voice being spoken over stops at once, with a tiny soft click. */
  | { kind: "cut" }
  /** Chapter 04's "thinking": a short soft gold shimmer of filtered noise. */
  | { kind: "shimmer"; pan: number }
);

/** Chapter 02 progress → film position. */
const d = (p: number) => 1 + p;

/** Chapter 02's distant greetings, staggered evenly across BEATS.languages, each owning its slot. */
const DISTANT_CUES: Cue[] = DISTANCE_VOICES.map((voice, i, all) => {
  const [a, b] = DISTANCE.languages;
  const slot = (b - a) / all.length;
  const at = a + slot * (i + 0.35);
  return { id: `distance-${voice.id}`, chapter: 1, at: d(at), until: d(at + slot), kind: "distant" as const, voice };
});

/** Chapter 03 progress → film position. */
const b = (p: number) => 2 + p;

/** Chapter 03's runtime: one quiet tick per stage, rising through D major pentatonic, panned left → right. */
const PENTATONIC = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51];
const STAGE_CUES: Cue[] = STAGES.map((stage, i, all) => ({
  id: `stage-${stage.id}`,
  chapter: 2,
  at: b(stage.at),
  until: b(all[i + 1]?.at ?? BRIDGE.runtime[1]),
  kind: "pulse" as const,
  pan: all.length > 1 ? -0.6 + (1.2 * i) / (all.length - 1) : 0,
  blip: { freq: PENTATONIC[i % PENTATONIC.length], peak: 0.007, dur: 0.07 },
}));

/** Chapter 03's statement: one soft tick per line, evenly spaced across BEATS.statement. */
const STATEMENT_TICKS = 4;
const STATEMENT_CUES: Cue[] = Array.from({ length: STATEMENT_TICKS }, (_, i) => {
  const [a, z] = BRIDGE.statement;
  const slot = (z - a) / STATEMENT_TICKS;
  return {
    id: `statement-${i}`,
    chapter: 2,
    at: b(a + slot * (i + 0.5)),
    until: b(a + slot * (i + 1.5)),
    kind: "pulse" as const,
    pan: 0,
    blip: { freq: [880, 739.99, 659.25, 587.33][i] ?? 880, peak: 0.006, dur: 0.07 },
  };
});

/** Chapter 04 progress → film position. */
const c = (p: number) => 3 + p;

const sidePan = (speaker?: Speaker) => (speaker === "minji" ? -0.6 : speaker === "daniel" ? 0.6 : 0);

/**
 * Chapter 04's call, generated from UTTERANCES: each utterance speaks at its `start` while still inside it.
 * Right after an interrupted utterance's `end`, a cut stops it before the next one begins.
 */
const CONVERSATION_SPEECH: Cue[] = UTTERANCES.flatMap((u, i) => {
  const voice = CONVERSATION_VOICES.find((v) => v.id === u.id);
  const prev = UTTERANCES[i - 1];
  const cues: Cue[] = [];
  if (prev?.interrupted) cues.push({ id: `cut-${prev.id}`, chapter: 3, at: c(prev.end), until: c(u.end), kind: "cut" });
  if (voice) cues.push({ id: `speech-${u.id}`, chapter: 3, at: c(u.start), until: c(u.end), kind: "speech", voice });
  return cues;
});

/** Chapter 04's processing: a very quiet tick at each end of turn and at first audio; a gold shimmer at context and intent. */
const CONVERSATION_EVENTS: Cue[] = EVENTS.flatMap((e, i): Cue[] => {
  const until = c(Math.min(e.at + 0.04, EVENTS[i + 1]?.at ?? 1));
  const pan = sidePan(e.speaker);
  if (e.type === "turn-end" || e.type === "first-audio") {
    const blip = e.type === "turn-end" ? { freq: 1568, peak: 0.005, dur: 0.04 } : { freq: 1760, peak: 0.005, dur: 0.04 };
    return [{ id: `event-${e.type}-${e.at}`, chapter: 3, at: c(e.at), until, kind: "pulse", pan, blip }];
  }
  if (e.type === "context" || e.type === "intent") return [{ id: `event-${e.type}-${e.at}`, chapter: 3, at: c(e.at), until, kind: "shimmer", pan }];
  return [];
});

/** Chapter 04's hush: the silence between the barge-in and the next sentence (the utterance after the interrupted one ends → the one after starts). */
const CONVERSATION_SILENCES: readonly (readonly [number, number])[] = UTTERANCES.flatMap((u, i) => {
  const after = UTTERANCES[i + 1];
  const next = UTTERANCES[i + 2];
  return u.interrupted && after && next && next.start > after.end ? [[after.end, next.start] as const] : [];
});
/** How far the bed drops during chapter 04's hush. */
const CONVERSATION_DUCK = 0.6;

const FIRST_LINK = DISTANCE.firstLink[0] + 0.6 * (DISTANCE.firstLink[1] - DISTANCE.firstLink[0]);
const LINKS_LEN = DISTANCE.links[1] - DISTANCE.links[0];

/** One-shot cues: each fires on a forward crossing of `at`, in its chapter, while still before `until`. */
const CUES: readonly Cue[] = [
  { id: "koSignal", chapter: 0, at: BEATS.koSignal[0], until: BEATS.koSignal[1], kind: "pulse", pan: -0.7 },
  { id: "koHello", chapter: 0, at: BEATS.koHello[0], until: BEATS.koHello[1], kind: "voice", voice: SILENCE_VOICES.koHello },
  { id: "enSignal", chapter: 0, at: BEATS.enSignal[0], until: BEATS.enSignal[1], kind: "pulse", pan: 0.7 },
  { id: "enHello", chapter: 0, at: BEATS.enHello[0], until: BEATS.enHello[1], kind: "voice", voice: SILENCE_VOICES.enHello },
  { id: "koAsk", chapter: 0, at: BEATS.koAsk[0], until: BEATS.koAsk[1], kind: "voice", voice: SILENCE_VOICES.koAsk },
  { id: "enLost", chapter: 0, at: BEATS.enLost[0], until: BEATS.enLost[1], kind: "voice", voice: SILENCE_VOICES.enLost },
  { id: "sync", chapter: 0, at: BEATS.sync[0], until: BEATS.sync[1], kind: "swell" },
  ...DISTANT_CUES,
  // The first connection holds: D4 + A4, a fifth, opening slowly through a lowpass. Not a reward chime.
  {
    id: "firstLink",
    chapter: 1,
    at: d(FIRST_LINK),
    until: d(DISTANCE.links[0] + 0.3 * LINKS_LEN),
    kind: "signal",
    signal: { freqs: [[293.66, 0.6], [440, 0.4]], peak: 0.014, attack: 0.4, hold: 0.6, release: 4, sweep: [350, 1800] },
  },
  // Links multiply: two fainter layers above it (D5, then E5).
  {
    id: "link2",
    chapter: 1,
    at: d(DISTANCE.links[0] + 0.3 * LINKS_LEN),
    until: d(DISTANCE.links[0] + 0.65 * LINKS_LEN),
    kind: "signal",
    signal: { freqs: [[587.33, 1]], peak: 0.008, attack: 0.5, hold: 0.4, release: 3.5, sweep: [500, 2200] },
  },
  {
    id: "link3",
    chapter: 1,
    at: d(DISTANCE.links[0] + 0.65 * LINKS_LEN),
    until: d(DISTANCE.bridge[0]),
    kind: "signal",
    signal: { freqs: [[659.25, 1]], peak: 0.006, attack: 0.5, hold: 0.4, release: 3.5, sweep: [500, 2400] },
  },
  // The bridge: a slow, low swell (D3 + A3 + D4) carrying into chapter 03.
  {
    id: "bridge",
    chapter: 1,
    at: d(DISTANCE.bridge[0]),
    until: d(DISTANCE.bridge[1]),
    kind: "signal",
    signal: { freqs: [[146.83, 0.45], [220, 0.35], [293.66, 0.2]], peak: 0.014, attack: 2, hold: 1.5, release: 4.5, sweep: [250, 1200] },
  },
  // Chapter 03. The connection settles: A3 + A4, an octave, very slow.
  {
    id: "align",
    chapter: 2,
    at: b(BRIDGE.align[0]),
    until: b(BRIDGE.align[1]),
    kind: "signal",
    signal: { freqs: [[220, 0.6], [440, 0.4]], peak: 0.011, attack: 1.5, hold: 0.5, release: 4 },
  },
  // The one signal crosses the screen: filtered noise passing left → right.
  { id: "signalPass", chapter: 2, at: b(BRIDGE.signal[0] + 0.03), until: b(BRIDGE.signal[1]), kind: "passby" },
  // A low, warm tone under VOICE LABS (D2 + A2). Not a sting.
  {
    id: "title",
    chapter: 2,
    at: b(BRIDGE.title[0] + 0.02),
    until: b(BRIDGE.title[1]),
    kind: "signal",
    signal: { freqs: [[73.42, 0.6], [110, 0.4]], peak: 0.013, attack: 1, hold: 0.8, release: 5, sweep: [200, 700] },
  },
  ...STAGE_CUES,
  ...STATEMENT_CUES,
  ...CONVERSATION_SPEECH,
  ...CONVERSATION_EVENTS,
  // CONVERSATION IS MORE THAN TRANSLATION: a very soft low swell (D2 + A2), like chapter 03's title tone.
  {
    id: "headline",
    chapter: 3,
    at: c(CONVERSATION.headline[0]),
    until: c(CONVERSATION.headline[1]),
    kind: "signal",
    signal: { freqs: [[73.42, 0.6], [110, 0.4]], peak: 0.011, attack: 1, hold: 0.8, release: 5, sweep: [200, 700] },
  },
];

/** Chapter 01 progress ranges where the bed falls almost silent. */
const SILENCES: readonly (readonly [number, number])[] = [
  BEATS.silence1,
  BEATS.silence2,
  [BEATS.statement[0], (BEATS.statement[0] + BEATS.statement[1]) / 2],
];

/** Chapter 02 progress ranges where the bed falls almost silent: the thesis, then the hush before the first link. */
const DISTANCE_SILENCES: readonly (readonly [number, number])[] = [
  DISTANCE.thesis,
  [DISTANCE.firstLink[0], DISTANCE.firstLink[0] + 0.4 * (DISTANCE.firstLink[1] - DISTANCE.firstLink[0])],
];

const MURMUR_GAIN = 0.06;

const ramp = (p: number, a: number, b: number) => Math.max(0, Math.min(1, (p - a) / (b - a)));

/** The murmur's level (0–1) over chapter 02 progress: rises with the world, densest during the attempts, gone by the thesis. */
function murmurLevel(p: number) {
  if (p < DISTANCE.handoff[0] || p >= DISTANCE.thesis[0]) return 0;
  const rise = 0.75 * ramp(p, DISTANCE.handoff[0], DISTANCE.attempts[0]) + 0.25 * ramp(p, DISTANCE.attempts[0], (DISTANCE.attempts[0] + DISTANCE.attempts[1]) / 2);
  const fall = 1 - 0.85 * ramp(p, DISTANCE.slow[0], DISTANCE.slow[1]);
  const tail = 1 - ramp(p, DISTANCE.slow[1], DISTANCE.thesis[0]);
  return rise * fall * tail;
}

const BED_GAIN = 0.05;
const SILENCE_DUCK = 0.08;
/** Chapter 03's moment of clarity while the signal crosses: the bed drops by half. */
const CLARITY_DUCK = 0.5;

/**
 * Optional sound for the film, synthesised in the browser (no audio files): a low room tone that opens
 * up as the story moves on, a soft tone on every chapter change, chapter 01's voices (recorded clips or
 * speech synthesis) separated by near-silence, and silence again at the end. Starts only from a click.
 */
export class FilmSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private unsubscribe: (() => void) | null = null;
  private bed: GainNode | null = null;
  private voices: VoicePlayer | null = null;
  /** Chapter 02's distant voices; a separate player so they never cut chapter 01's. */
  private distant: VoicePlayer | null = null;
  /** Chapter 04's call; its own player so it never cuts the other chapters' voices. */
  private conversation: VoicePlayer | null = null;
  /** Chapter 02's murmur of many voices. */
  private murmur: GainNode | null = null;
  /** Shared white-noise buffer (murmur, pass-by). */
  private white: AudioBuffer | null = null;
  private chapter = -1;
  /** Last position seen, to detect forward crossings; null until the first update after enabling. */
  private last: number | null = null;
  /** Cues already fired on this forward pass; re-armed by scrolling back before them. */
  private fired = new Set<string>();
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
    this.voices?.stop();
    this.distant?.stop();
    this.conversation?.stop();
    this.last = null;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    setTimeout(() => { if (!this.on) void ctx.suspend(); }, 1200);
  }

  dispose() {
    this.disable();
    try {
      void this.ctx?.close();
    } catch {
      // Already closed.
    }
    this.ctx = null;
    this.voices = null;
    this.distant = null;
    this.conversation = null;
    this.murmur = null;
    this.white = null;
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
    bed.gain.value = BED_GAIN;
    this.filter.connect(bed).connect(this.master);
    this.bed = bed;
    // Voices go straight into master, so the bed's silences never duck them.
    this.voices = new VoicePlayer(ctx, this.master);
    this.voices.preload(Object.values(SILENCE_VOICES));
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
    try {
      this.distant = new VoicePlayer(ctx, this.master);
      this.distant.preload(DISTANCE_VOICES);
      this.buildMurmur(ctx, this.master);
    } catch {
      // Chapter 02's layer is optional.
    }
    try {
      this.conversation = new VoicePlayer(ctx, this.master);
      this.conversation.preload(CONVERSATION_VOICES);
    } catch {
      // Chapter 04's voices are optional.
    }
    return true;
  }

  /**
   * A murmur of distant crowds, not music: white noise through a few speech-range bandpasses (300–3000 Hz),
   * each band's amplitude wandering under two LFOs (a slow swell and a faint syllable-rate flutter). Silent
   * until chapter 02 raises `murmur`.
   */
  private buildMurmur(ctx: AudioContext, destination: AudioNode) {
    const murmur = ctx.createGain();
    murmur.gain.value = 0;
    murmur.connect(destination);
    this.murmur = murmur;
    const white = this.whiteNoise(ctx);
    const bands = [
      { freq: 340, q: 1.4, pan: -0.5, slow: 0.07, fast: 2.9 },
      { freq: 620, q: 1.6, pan: 0.35, slow: 0.11, fast: 3.7 },
      { freq: 1150, q: 1.8, pan: -0.15, slow: 0.17, fast: 4.3 },
      { freq: 2300, q: 2, pan: 0.6, slow: 0.13, fast: 5.1 },
    ];
    bands.forEach((band, i) => {
      const src = ctx.createBufferSource();
      src.buffer = white;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = band.freq;
      bp.Q.value = band.q;
      const amp = ctx.createGain();
      amp.gain.value = 0.5;
      for (const [rate, depth] of [[band.slow, 0.4], [band.fast, 0.08]] as const) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = rate * (0.9 + Math.random() * 0.2);
        const lg = ctx.createGain();
        lg.gain.value = depth;
        lfo.connect(lg).connect(amp.gain);
        lfo.start(ctx.currentTime + Math.random() * 2);
      }
      let tail: AudioNode = src.connect(bp).connect(amp);
      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.value = band.pan;
        tail = tail.connect(panner);
      }
      tail.connect(murmur);
      // Different offsets into the same buffer keep the bands uncorrelated.
      src.start(ctx.currentTime, (i * 0.73) % 3);
    });
  }

  /** Three seconds of white noise, built once per context. */
  private whiteNoise(ctx: AudioContext) {
    if (this.white) return this.white;
    const white = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = white.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.white = white;
    return white;
  }

  private follow(position: number, chapter: number) {
    const ctx = this.ctx;
    if (!ctx || !this.filter || !this.master) return;
    try {
      const now = ctx.currentTime;
      // Opens from a muffled 180 Hz to ~900 Hz through the engine, then closes; the last beat is silence.
      const open = Math.sin(Math.min(1, position / 6) * Math.PI) * 700 + 180;
      this.filter.frequency.setTargetAtTime(open, now, 0.3);
      const ending = Math.max(0, Math.min(1, (position - 7.5) / 0.25));
      this.master.gain.setTargetAtTime(1 - ending, now, 0.4);
      // Chapter 01's silences: the bed (drone + room tone) drops almost to nothing; voices are unaffected.
      // Chapter 02's hush: the thesis and the moment before the first link.
      const progress = position - chapter;
      const silent =
        (chapter === 0 && SILENCES.some(([a, b]) => position >= a && position < b)) ||
        (chapter === 1 && DISTANCE_SILENCES.some(([a, b]) => progress >= a && progress < b));
      // Chapter 03: a moment of clarity while the one signal crosses.
      const clear = chapter === 2 && progress >= BRIDGE.signal[0] && progress < BRIDGE.signal[1];
      // Chapter 04: the bed dips slightly in the silence after the barge-in.
      const hush = chapter === 3 && CONVERSATION_SILENCES.some(([a, b]) => progress >= a && progress < b);
      const duck = silent ? SILENCE_DUCK : clear ? CLARITY_DUCK : hush ? CONVERSATION_DUCK : 1;
      this.bed?.gain.setTargetAtTime(BED_GAIN * duck, now, duck < 1 ? 0.35 : 0.6);
      this.murmur?.gain.setTargetAtTime(chapter === 1 ? MURMUR_GAIN * murmurLevel(progress) : 0, now, 0.5);
      if (chapter !== this.chapter) {
        if (this.chapter !== -1) this.tone(chapter);
        if (this.chapter === 0) this.voices?.stop();
        if (this.chapter === 1) this.distant?.stop();
        if (this.chapter === 3) this.conversation?.stop();
        this.chapter = chapter;
      }
      this.cues(position, chapter);
    } catch {
      // Audio scheduling failed; stay quiet rather than break scrolling.
    }
  }

  /** Fires the cues on forward crossings only; scrolling back before a cue re-arms it. */
  private cues(position: number, chapter: number) {
    const prev = this.last;
    this.last = position;
    for (const cue of CUES) if (position < cue.at) this.fired.delete(cue.id);
    if (prev === null || position <= prev) return;
    // A long jump may cross several cues: play only the one whose beat we land in.
    for (const cue of CUES) {
      if (cue.chapter !== chapter || this.fired.has(cue.id) || prev >= cue.at || position < cue.at) continue;
      this.fired.add(cue.id);
      // The barge-in always silences the voice being spoken over, even when landing past the cut.
      if (cue.kind === "cut") this.conversation?.stop();
      if (position >= cue.until) continue;
      if (cue.kind === "voice") this.voices?.play(cue.voice);
      else if (cue.kind === "distant") this.distant?.play(cue.voice);
      else if (cue.kind === "pulse") this.pulse(cue.pan, cue.blip);
      else if (cue.kind === "passby") this.passby();
      else if (cue.kind === "signal") this.signal(cue.signal);
      else if (cue.kind === "speech") this.conversation?.play(cue.voice);
      else if (cue.kind === "cut") this.pulse(0, { freq: 520, peak: 0.005, dur: 0.018 });
      else if (cue.kind === "shimmer") this.shimmer(cue.pan);
      else this.swell();
    }
  }

  /** A tiny transmission blip (default ~60 ms of 1.2 kHz), very quiet, panned toward the speaker's side. */
  private pulse(pan: number, { freq, peak, dur }: Blip = { freq: 1200, peak: 0.018, dur: 0.06 }) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      let tail: AudioNode = g;
      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        g.connect(panner);
        tail = panner;
      }
      tail.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // No blip.
    }
  }

  /** One signal crossing the screen: filtered noise, bandpass rising 600 → 2400 Hz, panned left → right over 1.6 s. */
  private passby() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    try {
      const t = ctx.currentTime;
      const span = 1.6;
      const src = ctx.createBufferSource();
      src.buffer = this.whiteNoise(ctx);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(600, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + span);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.011, t + 0.6);
      g.gain.setValueAtTime(0.011, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + span + 0.2);
      let tail: AudioNode = src.connect(bp).connect(g);
      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(-0.8, t);
        panner.pan.linearRampToValueAtTime(0.8, t + span);
        tail = tail.connect(panner);
      }
      tail.connect(this.master);
      src.start(t, Math.random() * 2);
      src.stop(t + span + 0.3);
    } catch {
      // No pass-by.
    }
  }

  /** Thinking: ~0.5 s of white noise through a narrow, slowly rising bandpass (a warm, gold shimmer), very quiet. */
  private shimmer(pan: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    try {
      const t = ctx.currentTime;
      const span = 0.5;
      const src = ctx.createBufferSource();
      src.buffer = this.whiteNoise(ctx);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 6;
      bp.frequency.setValueAtTime(2200, t);
      bp.frequency.exponentialRampToValueAtTime(3300, t + span);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.005, t + 0.15);
      g.gain.setValueAtTime(0.005, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + span);
      let tail: AudioNode = src.connect(bp).connect(g);
      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan * 0.5;
        tail = tail.connect(panner);
      }
      tail.connect(this.master);
      src.start(t, Math.random() * 2);
      src.stop(t + span + 0.05);
    } catch {
      // No shimmer.
    }
  }

  /** The signals synchronise: two sines a fifth apart, slow 1.5 s attack, ~3 s release. */
  private swell() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    try {
      const t = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.018, t + 1.5);
      g.gain.setValueAtTime(0.018, t + 2.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 5.2);
      g.connect(this.master);
      for (const freq of [220, 330]) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const og = ctx.createGain();
        og.gain.value = 0.5;
        osc.connect(og).connect(g);
        osc.start(t);
        osc.stop(t + 5.4);
      }
    } catch {
      // No swell.
    }
  }

  /** A soft tonal signal: slow attack, a short hold, long exponential release, optionally opening through a lowpass. */
  private signal({ freqs, peak, attack, hold, release, sweep }: Signal) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    try {
      const t = ctx.currentTime;
      const end = t + attack + hold + release;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.setValueAtTime(peak, t + attack + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      let head: AudioNode = g;
      if (sweep) {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.Q.value = 0.5;
        lp.frequency.setValueAtTime(sweep[0], t);
        lp.frequency.exponentialRampToValueAtTime(sweep[1], t + attack + hold);
        lp.connect(g);
        head = lp;
      }
      g.connect(this.master);
      for (const [freq, level] of freqs) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const og = ctx.createGain();
        og.gain.value = level;
        osc.connect(og).connect(head);
        osc.start(t);
        osc.stop(end + 0.2);
      }
    } catch {
      // No signal.
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

