/**
 * The beats of chapter 06, in chapter progress (0–1). One camera pulls back from chapter 05's outgoing
 * signal: one signal → many → the runtime they pass through → the worlds they serve → many languages →
 * a world-scale network; then one conversation brightens and the camera goes back in, ending the moment
 * before chapter 07's conversation begins. The SVG system (system/), the typography (world-scene.tsx), the
 * canvas (visual.ts) and the sound (lib/cinematic/sound.ts) all read these.
 */
export const BEATS = {
  /** Chapter 05's last frame (core + rays) dissolves into the conversation paths. */
  open: [0, 0.06],
  /** One signal → many: paths branch out of the centre; the camera pulls back. */
  many: [0.03, 0.16],
  /** The runtime appears at the centre: the same living path as chapter 05, small. */
  runtime: [0.12, 0.2],
  /** The seven worlds appear one at a time around it (WORLDS order). */
  worlds: [0.18, 0.4],
  /** Each agent differs: instructions, tools, knowledge, voice as metadata. */
  agents: [0.3, 0.44],
  /** Languages emerge from the conversations as transient fragments; one speaker code-switches. */
  languages: [0.38, 0.52],
  /** ONE VOICE INFRASTRUCTURE. / MANY CONVERSATIONS. over the moving network. */
  statement: [0.5, 0.63],
  /** SAME RUNTIME UNDERNEATH. + each agent with its own…; the camera drifts through the network. */
  underneath: [0.63, 0.75],
  /** Worlds become points, points cities, cities regions: a world-scale network. */
  global: [0.74, 0.86],
  /** One conversation brightens; the rest quiet; the camera moves toward it. */
  select: [0.85, 0.94],
  /** It opens into one conversation: KO · SEOUL ↔ EN · TORONTO, before anyone speaks. */
  setup: [0.92, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type Beat = keyof typeof BEATS;

export type Lang = "ko" | "en" | "ja" | "es" | "fr" | "ar";
export type Motif = "phone" | "exchange" | "calendar" | "route" | "table" | "calm" | "dense";

/**
 * How a world's conversations behave: turn period (s), share of it spent speaking, how fast its signals
 * travel, whether speakers cut in, and how loud it is overall.
 */
export type Behaviour = { period: number; duty: number; speed: number; interrupts: boolean; level: number };

/**
 * The worlds one runtime serves. `meta` is the agent's own configuration (illustrative): one runtime does
 * not mean identical agents. `hello` is the language fragment that rises out of its conversations.
 */
export const WORLDS = [
  {
    id: "support", name: "CUSTOMER SUPPORT", verbs: "HELP · RESOLVE · RESPOND", motif: "phone", lang: "en",
    meta: ["VOICE · EN", "TOOLS · CRM", "KNOWLEDGE · FAQ"], hello: "Hello",
    act: { period: 3.2, duty: 0.7, speed: 0.34, interrupts: false, level: 0.9 },
  },
  {
    id: "sales", name: "SALES", verbs: "QUALIFY · DISCOVER · CONVERT", motif: "exchange", lang: "es",
    meta: ["VOICE · ES", "TOOLS · CRM", "CONTEXT · ACCOUNT"], hello: "Hola",
    act: { period: 1.8, duty: 0.62, speed: 0.5, interrupts: true, level: 1 },
  },
  {
    id: "booking", name: "BOOKING", verbs: "SEARCH · SCHEDULE · CONFIRM", motif: "calendar", lang: "ko",
    meta: ["VOICE · KO", "TOOLS · CALENDAR", "KNOWLEDGE · AVAILABILITY"], hello: "안녕하세요",
    act: { period: 4, duty: 0.55, speed: 0.3, interrupts: false, level: 0.8 },
  },
  {
    id: "transport", name: "TRANSPORTATION", verbs: "ROUTE · STATUS · ASSIST", motif: "route", lang: "ja",
    meta: ["VOICE · JA", "TOOLS · ROUTING", "CONTEXT · LIVE STATUS"], hello: "こんにちは",
    act: { period: 5, duty: 0.85, speed: 0.42, interrupts: false, level: 0.7 },
  },
  {
    id: "restaurants", name: "RESTAURANTS", verbs: "RESERVE · MODIFY · ANSWER", motif: "table", lang: "fr",
    meta: ["VOICE · FR", "TOOLS · RESERVATION", "CONTEXT · MENU"], hello: "Bonjour",
    act: { period: 2.6, duty: 0.5, speed: 0.36, interrupts: true, level: 0.85 },
  },
  {
    id: "healthcare", name: "HEALTHCARE", verbs: "GUIDE · SCHEDULE · SUPPORT", motif: "calm", lang: "ar",
    meta: ["VOICE · AR", "TOOLS · SCHEDULING", "KNOWLEDGE · CARE GUIDES"], hello: "مرحبا",
    act: { period: 7, duty: 0.4, speed: 0.18, interrupts: false, level: 0.45 },
  },
  {
    id: "callcenters", name: "CALL CENTERS", verbs: "SCALE · ROUTE · RESOLVE", motif: "dense", lang: "en",
    meta: ["VOICE · MANY", "TOOLS · ROUTING", "CONTEXT · QUEUES"], hello: "",
    act: { period: 1.4, duty: 0.8, speed: 0.55, interrupts: true, level: 1 },
  },
] as const satisfies readonly {
  id: string; name: string; verbs: string; motif: Motif; lang: Lang; meta: readonly string[]; hello: string; act: Behaviour;
}[];

export type WorldId = (typeof WORLDS)[number]["id"];

/** Language tags as they appear on the signals. */
export const LANG_TAG: Record<Lang, string> = { ko: "KO", en: "EN", ja: "JA", es: "ES", fr: "FR", ar: "AR" };

/** One speaker in BOOKING switches language mid-sentence; the indicator follows, the signal never breaks. */
export const CODE_SWITCH = {
  world: "booking" as WorldId,
  parts: [
    { text: "안녕하세요,", lang: "ko" },
    { text: "tomorrow", lang: "en" },
    { text: "오전에 가능할까요?", lang: "ko" },
  ],
} as const;

/** The conversation chapter 07 opens on. */
export const SELECTED = { a: "KO · SEOUL", b: "EN · TORONTO" } as const;
