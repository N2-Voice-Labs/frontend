/** Origin of the workspace app (call, playground, conversations…). Empty means this site's origin. */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
const app = (path: string) => `${APP_URL}${path}`;
const q = (id: string) => encodeURIComponent(id);

export const ROUTES = {
  home: "/",
  /** The Agents page lives in this app. */
  agents: "/agents",
  call: app("/call"),
  conversations: app("/conversations"),
  voices: app("/voices"),
  usage: app("/usage"),
  newAgent: app("/agents/new"),
  agent: (id: string) => app(`/agents/${q(id)}`),
  playgroundFor: (id: string) => app(`/playground?agent=${q(id)}`),
  callWith: (id: string) => app(`/call?agent=${q(id)}`),
} as const;

/**
 * External links in the footers. Paste the real URLs here; a link that is `null` is not rendered
 * (never ship a dead "#" link). `pilot` falls back to emailing `email`.
 */
export const SITE_LINKS: Record<"email" | "github" | "linkedin" | "contact" | "privacy" | "terms" | "pilot" | "docs" | "support", string | null> = {
  email: null,
  github: null,
  linkedin: null,
  contact: null,
  privacy: null,
  terms: null,
  pilot: null,
  docs: null,
  support: null,
};

export const pilotHref = SITE_LINKS.pilot ?? (SITE_LINKS.email ? `mailto:${SITE_LINKS.email}?subject=Voice%20Labs%20pilot` : null);

export type LatencyStage = {
  id: string;
  label: string;
  /** NS-01 p50 in milliseconds. `null` renders the "[p50 ms]" placeholder: never invent a number here. */
  p50Ms: number | null;
};

/** Stages of the NS-01 live benchmark. Paste the real p50 values in once they are published. */
export const LATENCY_STAGES: readonly LatencyStage[] = [
  { id: "T0", label: "Speech starts", p50Ms: 0 },
  { id: "T1", label: "End of turn", p50Ms: null },
  { id: "T2", label: "Transcript", p50Ms: null },
  { id: "T3", label: "Translation", p50Ms: null },
  { id: "T4", label: "First audio", p50Ms: null },
  { id: "T5", label: "Heard", p50Ms: null },
];
