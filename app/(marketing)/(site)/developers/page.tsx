import type { Metadata } from "next";
import { PageHero, Section, SiteHeader, StatusChip } from "@/components/site/site-chrome";
import type { Availability } from "@/components/site/site-nav";
import { ROUTES } from "@/lib/landing/config";

export const metadata: Metadata = {
  title: "Developers · UNAI",
  description: "The UNAI Platform API: voice agent sessions, translated calls, knowledge and transcripts. What exists today and what is planned.",
};

type Endpoint = { method: string; path: string; does: string; status: Availability };

const GROUPS: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: "Voice agents",
    endpoints: [
      { method: "POST", path: "/agents", does: "Create an agent: instructions, languages, speech and model providers, voice.", status: "mvp" },
      { method: "POST", path: "/voice/sessions", does: "Start a browser voice session. Returns a LiveKit URL, a token and a session token.", status: "mvp" },
      { method: "POST", path: "/voice/sessions/{id}/end", does: "End the session and close the room.", status: "mvp" },
      { method: "GET", path: "/conversations/{id}/messages", does: "The call's transcript, turn by turn.", status: "mvp" },
    ],
  },
  {
    title: "Knowledge",
    endpoints: [
      { method: "POST", path: "/knowledge/documents", does: "Add a source document (text).", status: "mvp" },
      { method: "PUT", path: "/agents/{id}/knowledge", does: "Choose which documents an agent answers from.", status: "mvp" },
    ],
  },
  {
    title: "Real-time translation",
    endpoints: [
      { method: "POST", path: "/calls", does: "Open a two-person translated call between two languages.", status: "mvp" },
      { method: "POST", path: "/calls/{id}/invite", does: "Make a short-lived invite code for the second person.", status: "mvp" },
      { method: "POST", path: "/calls/invites/{code}/join", does: "Join from the invite and get your own private translated channel.", status: "mvp" },
      { method: "POST", path: "/calls/{id}/end", does: "Either person hangs up for both.", status: "mvp" },
    ],
  },
  {
    title: "Handoff & chat",
    endpoints: [
      { method: "POST", path: "/handoffs", does: "Move a caller from an AI session into a translated call with staff.", status: "progress" },
      { method: "GET", path: "/staff/handoffs", does: "The staff queue of waiting callers.", status: "progress" },
      { method: "POST", path: "/demo/agents/{key}/chat", does: "Text chat with an agent's knowledge.", status: "progress" },
    ],
  },
];

const COMMERCIAL: { name: string; text: string }[] = [
  { name: "Self-serve API keys", text: "Sign up and get a key without talking to us." },
  { name: "Usage-based billing", text: "Pay for minutes and messages." },
  { name: "SDKs & embeddable widget", text: "Drop-in voice and chat for any website." },
  { name: "Developer dashboard", text: "Usage, logs and call quality in one place." },
];

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader current={ROUTES.developers} />
      <main>
        <PageHero
          kicker="Developers"
          title="The same API"
          em="our products run on."
          lede="Everything UNAI's own products do goes through the Platform HTTP API. Today it's available to pilot customers we onboard ourselves; self-serve access is planned."
        />

        <Section index="01" label="Quick look" title="Start a voice session in one request.">
          <p className="site-p">
            Create a session for an agent, then connect the browser to the returned LiveKit room with the token. The agent joins, listens and answers.
          </p>
          <pre className="site-code" tabIndex={0}><code>{`curl -X POST $PLATFORM_URL/voice/sessions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id": "<agent-uuid>"}'

`}<span className="c">{`# → { "session_id", "conversation_id",
#     "connection": { "url": "wss://…", "token": "…" },
#     "session_token": "vls_…" }`}</span></code></pre>
        </Section>

        <Section index="02" label="Endpoints" title="What's available.">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="kicker" style={{ marginTop: 32 }}>{g.title}</p>
              <div className="site-table-wrap">
                <table className="site-table">
                  <thead><tr><th scope="col">Endpoint</th><th scope="col">What it does</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {g.endpoints.map((e) => (
                      <tr key={e.method + e.path}>
                        <td><span className="site-method">{e.method}</span><code>{e.path}</code></td>
                        <td>{e.does}</td>
                        <td><StatusChip status={e.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Section>

        <Section index="03" label="Commercial access" title="Coming later.">
          <p className="site-p">None of these exist yet. We list them so it's clear what the API offers today and what doesn't exist yet.</p>
          <div className="site-grid">
            {COMMERCIAL.map((c) => (
              <article key={c.name} className="site-card">
                <div className="site-card-top"><h3>{c.name}</h3><StatusChip status="planned" /></div>
                <p>{c.text}</p>
              </article>
            ))}
          </div>
        </Section>
      </main>
    </>
  );
}
