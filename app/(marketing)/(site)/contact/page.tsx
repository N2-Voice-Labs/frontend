import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, SiteHeader } from "@/components/site/site-chrome";
import { pilotHref, ROUTES, SITE_LINKS } from "@/lib/landing/config";

export const metadata: Metadata = {
  title: "Contact · UNAI",
  description: "Talk to the UNAI team about a pilot for your organisation.",
};

export default function ContactPage() {
  const email = SITE_LINKS.email;
  return (
    <>
      <SiteHeader current={ROUTES.contact} />
      <main>
        <PageHero
          kicker="Contact"
          title="Bring UNAI to"
          em="your front desk."
          lede="We're looking for pilot partners, starting with university admissions offices. Tell us who calls you, in which languages, and what they usually ask."
        >
          {pilotHref ? (
            <a href={pilotHref} className="cta cta-primary">Ask about a pilot</a>
          ) : (
            <Link href={ROUTES.demo} className="cta cta-primary">Try the live demo first</Link>
          )}
        </PageHero>

        <Section index="01" label="Reach us" title={email ? "Email the team." : "Contact details are on their way."}>
          {email ? (
            <p className="site-p"><a href={`mailto:${email}`}>{email}</a></p>
          ) : (
            <p className="site-p">We&apos;re setting up our contact address. In the meantime, the live demo shows what a pilot would look like.</p>
          )}
          <p className="site-p">
            <strong>Useful to include:</strong> your organisation, the languages your callers speak, roughly how many enquiries you get each month, and where your current answers are written down (website pages, PDFs, FAQs).
          </p>
        </Section>
      </main>
    </>
  );
}
