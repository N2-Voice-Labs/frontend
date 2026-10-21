/**
 * Features the Platform stores but does not run yet. The UI for them is built and labelled "Coming soon".
 * When the backend ships one, switch it on without a code change:
 *   NEXT_PUBLIC_CAPABILITIES=voicePreview,liveLatency
 * (or flip the default below). Anything not listed here is live today.
 */
export type Capability =
  | "voicePreview" // type text, hear a voice (needs a Runtime preview endpoint)
  | "liveLatency" // per-turn STT / LLM / TTS milliseconds (Runtime does not emit LatencyMeasured yet)
  | "providerCloning" // a provider actually clones or designs the voice (status moves to ready on its own)
  | "sipDialing" // phone calls and campaign dialing
  | "apiCalls" // calls started through an API deployment
  | "liveTransfer" // hand a live call to a person
  | "toolExecution" // the agent runs tools during calls
  | "knowledgeSearch" // the agent answers from documents (retrieval)
  | "dubbing";

const defaults: Record<Capability, boolean> = {
  voicePreview: false,
  liveLatency: false,
  providerCloning: false,
  sipDialing: false,
  apiCalls: false,
  liveTransfer: false,
  toolExecution: false,
  knowledgeSearch: false,
  dubbing: false,
};

const enabled = new Set((process.env.NEXT_PUBLIC_CAPABILITIES ?? "").split(",").map((item) => item.trim()).filter(Boolean));

export const isEnabled = (capability: Capability) => defaults[capability] || enabled.has(capability);

/** What each unavailable feature means in plain words, shown next to its "Coming soon" label. */
export const comingSoon: Record<Capability, { title: string; note: string }> = {
  voicePreview: { title: "Voice preview", note: "Type a line and hear the voice. Needs a preview endpoint in the Runtime." },
  liveLatency: { title: "Live latency", note: "Speech, language and voice timings per turn. The Runtime does not report them yet." },
  providerCloning: { title: "Automatic voice creation", note: "Voices stay in “processing” until a provider is connected to create them." },
  sipDialing: { title: "Phone calls", note: "Phone numbers and campaigns are saved, but no calls are placed yet." },
  apiCalls: { title: "API calls", note: "API deployments are saved, but starting calls through them is not connected yet." },
  liveTransfer: { title: "Live transfer", note: "Escalations are recorded. Transferring a live call to a person is not connected yet." },
  toolExecution: { title: "Tools during calls", note: "Tools can be assigned to agents. They do not run during calls yet." },
  knowledgeSearch: { title: "Answers from documents", note: "Documents can be assigned to agents. Agents do not search them during calls yet." },
  dubbing: { title: "Dubbing", note: "Planned for later." },
};
