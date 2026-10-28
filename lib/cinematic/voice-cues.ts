/**
 * The voices of the film: recorded clips when they exist, the browser's speech synthesis when they don't.
 * Drop recorded clips into `public/audio/` under the `src` names below; nothing else needs to change.
 * Never touches the microphone.
 */
import { UTTERANCES } from "@/components/scenes/conversation/conversation-data";

export type VoiceCue = {
  id: string;
  /** What is said, for the speech-synthesis fallback. */
  text: string;
  /** BCP-47, e.g. "ko-KR". */
  lang: string;
  /** Optional recorded clip under /public, e.g. "/audio/silence-ko-hello.mp3". Missing or failing → speech synthesis. */
  src?: string;
  /** -1 (left) … 1 (right); used for the clip, ignored by speech synthesis. */
  pan?: number;
  /** 0–1 playback gain for the clip / volume for speech synthesis (default 0.7). Lower = farther away. */
  volume?: number;
};

/** The voices of chapter 01, in story order. */
export const SILENCE_VOICES: { koHello: VoiceCue; enHello: VoiceCue; koAsk: VoiceCue; enLost: VoiceCue } = {
  koHello: { id: "koHello", text: "안녕하세요…", lang: "ko-KR", src: "/audio/silence-ko-hello.mp3", pan: -0.6, volume: 0.7 },
  enHello: { id: "enHello", text: "Hello?", lang: "en-US", src: "/audio/silence-en-hello.mp3", pan: 0.7, volume: 0.45 },
  koAsk: { id: "koAsk", text: "내일 오전에 회의 가능할까요?", lang: "ko-KR", src: "/audio/silence-ko-ask.mp3", pan: -0.6, volume: 0.7 },
  enLost: { id: "enLost", text: "Sorry…?", lang: "en-US", src: "/audio/silence-en-lost.mp3", pan: 0.7, volume: 0.45 },
};

/**
 * Chapter 02's distant voices: short greetings from the language worlds (see LANGUAGES in
 * components/scenes/distance/beats.ts), quiet and spread across the stereo field, as if heard from far away.
 */
export const DISTANCE_VOICES: readonly VoiceCue[] = [
  { id: "en", text: "hello", lang: "en-US", src: "/audio/distance-en.mp3", pan: 0.55, volume: 0.3 },
  { id: "es", text: "hola", lang: "es-ES", src: "/audio/distance-es.mp3", pan: -0.45, volume: 0.25 },
  { id: "ja", text: "こんにちは", lang: "ja-JP", src: "/audio/distance-ja.mp3", pan: 0.8, volume: 0.22 },
  { id: "ar", text: "مرحبا", lang: "ar-SA", src: "/audio/distance-ar.mp3", pan: -0.75, volume: 0.28 },
  { id: "hi", text: "नमस्ते", lang: "hi-IN", src: "/audio/distance-hi.mp3", pan: 0.2, volume: 0.24 },
  { id: "fr", text: "bonjour", lang: "fr-FR", src: "/audio/distance-fr.mp3", pan: -0.25, volume: 0.32 },
  { id: "zh", text: "你好", lang: "zh-CN", src: "/audio/distance-zh.mp3", pan: 0.65, volume: 0.2 },
  { id: "ru", text: "привет", lang: "ru-RU", src: "/audio/distance-ru.mp3", pan: -0.6, volume: 0.26 },
];

/** BCP-47 tag for a conversation utterance's primary language ("ko" → "ko-KR"); a code-switch uses its primary. */
const CONVERSATION_LANGS: Record<string, string> = { ko: "ko-KR", en: "en-US" };

/**
 * Chapter 04's call, one cue per utterance in UTTERANCES (same ids, same text): Minji's side on the left,
 * Daniel's on the right; the people slightly louder than the Voice Labs voice speaking to them.
 */
export const CONVERSATION_VOICES: readonly VoiceCue[] = UTTERANCES.map((u) => ({
  id: u.id,
  text: u.text,
  lang: CONVERSATION_LANGS[u.lang] ?? u.lang,
  src: `/audio/conversation-${u.id}.mp3`,
  pan: u.speaker === "minji" ? -0.6 : 0.6,
  volume: u.source === "human" ? 0.6 : 0.5,
}));

const DEFAULT_VOLUME = 0.7;

/** Plays cues through Web Audio (decoded clip) or speech synthesis. Never throws. */
export class VoicePlayer {
  /** Decoded clip per `src`; null = no clip (missing or undecodable). Absent = still loading or never asked. */
  private clips = new Map<string, AudioBuffer | null>();
  private loading = new Set<string>();
  private source: AudioBufferSourceNode | null = null;
  private nodes: AudioNode[] = [];

  constructor(private ctx: AudioContext, private destination: AudioNode) {}

  /** Fetches and decodes every cue's `src` in the background; failures are remembered and silently fall back. Safe to call more than once. */
  preload(cues: readonly VoiceCue[]) {
    for (const cue of cues) {
      const src = cue.src;
      if (!src || this.clips.has(src) || this.loading.has(src)) continue;
      this.loading.add(src);
      void this.load(src).then((buffer) => {
        this.clips.set(src, buffer);
        this.loading.delete(src);
      });
    }
  }

  /** Plays a cue now: the decoded clip through a StereoPannerNode (when available) + gain into `destination`, or speech synthesis. Stops whatever this player was already playing first. */
  play(cue: VoiceCue) {
    this.stop();
    const buffer = cue.src ? this.clips.get(cue.src) : undefined;
    if (buffer && this.playClip(cue, buffer)) return;
    this.speak(cue);
  }

  /** Stops the clip and cancels speech synthesis. */
  stop() {
    this.release();
    try {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    } catch {
      // Speech synthesis unavailable.
    }
  }

  private release() {
    try {
      this.source?.stop();
    } catch {
      // Already stopped.
    }
    for (const node of [this.source, ...this.nodes]) {
      try {
        node?.disconnect();
      } catch {
        // Not connected.
      }
    }
    this.source = null;
    this.nodes = [];
  }

  private async load(src: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      return await this.ctx.decodeAudioData(data);
    } catch {
      return null;
    }
  }

  private playClip(cue: VoiceCue, buffer: AudioBuffer) {
    try {
      const ctx = this.ctx;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = cue.volume ?? DEFAULT_VOLUME;
      const nodes: AudioNode[] = [gain];
      let tail: AudioNode = source;
      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, cue.pan ?? 0));
        tail.connect(panner);
        tail = panner;
        nodes.push(panner);
      }
      tail.connect(gain).connect(this.destination);
      source.onended = () => {
        if (this.source === source) this.release();
      };
      source.start();
      this.source = source;
      this.nodes = nodes;
      return true;
    } catch {
      return false;
    }
  }

  private speak(cue: VoiceCue) {
    if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
    try {
      const u = new SpeechSynthesisUtterance(cue.text);
      u.lang = cue.lang;
      u.rate = 0.9;
      u.volume = cue.volume ?? DEFAULT_VOLUME;
      const prefix = cue.lang.slice(0, 2).toLowerCase();
      const voice = speechSynthesis.getVoices().find((v) => v.lang.replace(/_/g, "-").toLowerCase().startsWith(prefix));
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    } catch {
      // Speech synthesis failed; stay silent.
    }
  }
}
