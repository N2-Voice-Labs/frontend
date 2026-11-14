import type { Metadata } from "next";
import { PageHero, Section, SiteHeader } from "@/components/site/site-chrome";
import { PORTAL_URL, ROUTES } from "@/lib/landing/config";

export const metadata: Metadata = {
  title: "Live demo · UNAI",
  description: "Talk to the UNAI AI Admissions Assistant built for international students at Inha University.",
};

export default function DemoPage() {
  return (
    <>
      <SiteHeader current={ROUTES.demo} />
      <main>
        <PageHero
          kicker="Live demo · Inha University admissions"
          title="Ask the admissions"
          em="assistant yourself."
          lede="A working example of UNAI: a voice assistant for international applicants to Inha University. It answers from the university's published admissions information and can bring in an admissions officer, with live Korean ↔ English translation."
        >
          {PORTAL_URL ? (
            <a href={PORTAL_URL} className="cta cta-primary">Open the Admissions Assistant</a>
          ) : (
            <span className="cta" aria-disabled="true">The demo opens here soon</span>
          )}
        </PageHero>

        <Section index="01" label="Try asking" title="Questions an applicant might ask.">
          <ol className="site-steps">
            <li><div><h3>&ldquo;What documents do I need to apply?&rdquo;</h3><p>The assistant answers from the admissions documents it has been given.</p></div></li>
            <li><div><h3>&ldquo;Is there a language requirement?&rdquo;</h3><p>TOPIK or English test requirements, as published.</p></div></li>
            <li><div><h3>&ldquo;Can I talk to someone?&rdquo;</h3><p>It offers to connect you to an admissions officer. In the demo, a team member joins from the staff console, and each of you hears the other in your own language.</p></div></li>
          </ol>
        </Section>

        <Section index="02" label="Before you start" title="What to expect.">
          <p className="site-p">
            Your browser will ask for microphone access. Calls are kept short in the demo.
            Answers come only from the admissions information we loaded; when it doesn&apos;t know, it says so instead of guessing.
          </p>
          <div className="site-callout">
            <strong>This is a UNAI demonstration</strong>, not an official Inha University service. Always check important details, such as deadlines and fees, on the university&apos;s official admissions website.
          </div>
        </Section>
      </main>
    </>
  );
}
