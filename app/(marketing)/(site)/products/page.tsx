import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, SiteHeader, StatusChip } from "@/components/site/site-chrome";
import type { Availability } from "@/components/site/site-nav";
import { ROUTES } from "@/lib/landing/config";

export const metadata: Metadata = {
  title: "Products · UNAI",
  description: "AI voice agents, real-time translation, AI chatbots and developer APIs: UNAI's communication platform for businesses.",
};

const PRODUCTS: { id: string; name: string; status: Availability; primary?: boolean; lead: string; points: string[] }[] = [
  {
    id: "voice-agents",
    name: "AI Voice Agents",
    status: "mvp",
    primary: true,
    lead: "Assistants that talk with your customers in natural speech, in the browser, answering from your organisation's verified knowledge.",
    points: [
      "Speech recognition, language understanding and spoken replies in one live call",
      "Answers grounded in your own documents, so it doesn't make things up",
      "Handles interruptions and keeps the conversation's context",
      "Full transcript and outcome for every call",
      "Hands the caller to a person when it should",
    ],
  },
  {
    id: "translation",
    name: "Real-Time Translation",
    status: "mvp",
    lead: "Two people who don't share a language talk to each other, and each one hears the other in their own language.",
    points: [
      "Korean ↔ English first",
      "Each listener gets a private translated audio channel",
      "Used when an AI agent hands a caller over to a staff member",
      "Joining is a browser link: no app, no phone number",
    ],
  },
  {
    id: "chatbots",
    name: "AI Chatbots",
    status: "progress",
    lead: "A text assistant for people who prefer to type, using the same knowledge as your voice agent.",
    points: ["Same verified knowledge base as voice", "Embeds next to the voice assistant", "No speech credits used"],
  },
  {
    id: "apis",
    name: "Developer APIs",
    status: "planned",
    lead: "The same capabilities through an HTTP API, so you can build them into your own website or app.",
    points: [
      "Today: the Platform API that runs our own products",
      "Planned: self-serve API keys, usage billing and SDKs",
    ],
  },
];

export default function ProductsPage() {
  return (
    <>
      <SiteHeader current={ROUTES.products} />
      <main>
        <PageHero
          kicker="Products"
          title="One platform for every"
          em="conversation."
          lede="UNAI gives businesses AI communication as a service: voice agents first, plus translation, chat and APIs, all running on the same infrastructure."
        >
          <Link href={ROUTES.demo} className="cta cta-primary">Try the live demo</Link>
          <Link href={ROUTES.developers} className="cta">See the API</Link>
        </PageHero>

        <div className="site-grid" role="list">
          {PRODUCTS.map((p) => (
            <article key={p.id} id={p.id} className="site-card" data-primary={p.primary || undefined} role="listitem">
              <div className="site-card-top">
                <span className="mono">{p.primary ? "Primary product" : "Capability"}</span>
                <StatusChip status={p.status} />
              </div>
              <h3>{p.name}</h3>
              <p>{p.lead}</p>
              <ul>{p.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
            </article>
          ))}
        </div>

        <Section index="01" label="How it works" title="Calls run in the browser over WebRTC.">
          <p className="site-p">
            Speech goes from the browser through <strong>LiveKit</strong> to a pipeline that turns it into text, decides what to say and speaks the reply.
            Each step can use a different provider. Customers and staff only need a microphone and a link:
            no SIM card, no phone number and nothing to install.
          </p>
          <div className="site-callout">
            <strong>Not in the current release:</strong> calls over the regular phone network (SIP), outbound calling campaigns and connecting to existing phone numbers.
            They come after the browser product.
          </div>
        </Section>
      </main>
    </>
  );
}
