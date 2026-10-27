/**
 * Public demo ("Speak to it"). `tokenEndpoint` is a backend route (app/api/demo/session) that creates a
 * demo room with the agent and returns JSON { url, token, … }. Leave it empty for mic-preview mode:
 * the orb and the signal band react to your voice and nothing is sent anywhere.
 */
export const DEMO_CONFIG = {
  tokenEndpoint: process.env.NEXT_PUBLIC_DEMO_TOKEN_ENDPOINT ?? "",
  /** Public slug of the agent the demo talks to; the server maps it to a Platform agent id. */
  agentId: "concierge",
  /** Sessions are public, so the browser ends them after this long (the server applies its own limits). */
  maxSessionSeconds: 180,
  /** The Platform keeps a Conversation with its transcript for every session, demo sessions included. */
  storesTranscripts: true,
} as const;

/** Voice-activity threshold on the RMS level (0–1), used for turn timing. */
export const VOICE_THRESHOLD = 0.07;
/** Samples kept per lane in the signal band's live trace. */
export const HISTORY = 120;

/** The privacy line under every "Speak to it" control. */
export function speakNote(hasAgent: boolean) {
  if (!hasAgent) return "Optional. Mic preview only: your voice is drawn on this page and is not sent anywhere.";
  const note = "Optional. Uses your microphone to talk to the Voice Labs demo agent while the session is open.";
  return DEMO_CONFIG.storesTranscripts ? `${note} Transcripts of demo conversations are stored.` : note;
}
