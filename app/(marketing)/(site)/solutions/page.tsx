import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, SiteHeader, StatusChip } from "@/components/site/site-chrome";
import { ROUTES } from "@/lib/landing/config";

export const metadata: Metadata = {
  title: "Solutions · UNAI",
  description: "UNAI's first solution is an AI admissions assistant for international students. More industries will follow on the same platform.",
};

const NEXT_INDUSTRIES = [
  { name: "Healthcare clinics", text: "Booking, pre-visit questions and help for foreign patients in their own language." },
  { name: "Public services", text: "Common questions answered around the clock, then a person who speaks the caller's language." },
  { name: "Hospitality & tourism", text: "Guest questions and reservations for international visitors." },
  { name: "Customer support", text: "First-line answers from your own knowledge base, then a smooth handover to staff." },
];

export default function SolutionsPage() {
  return (
    <>
      <SiteHeader current={ROUTES.solutions} />
      <main>
        <PageHero
          kicker="Solutions"
          title="Built once,"
          em="shaped for each industry."
          lede="The platform is the same for every customer. What changes is the knowledge, the instructions and the flow each organisation needs. Our first solution is for university admissions."
        />

        <Section index="01" label="Featured" title="AI Admissions Assistant for international students." id="admissions">
          <p className="site-p">
            <strong>The problem.</strong> International applicants struggle with language when they contact an admissions office,
            and staff answer the same questions about requirements, documents, deadlines, tuition, scholarships and language tests over and over,
            often to students in other time zones.
          </p>
          <p className="site-p">
            <strong>The solution.</strong> A voice assistant answers from the university&apos;s verified admissions information at any hour.
            When a student needs a person, an admissions officer joins in the browser, and UNAI translates both sides in real time.
            A text chat covers students who prefer to type.
          </p>
          <ol className="site-steps">
            <li><div><h3>The student starts a voice call</h3><p>From the admissions website, with one click and a microphone.</p></div></li>
            <li><div><h3>The AI answers from verified information</h3><p>&ldquo;According to the university&apos;s admissions information, the required documents include…&rdquo;</p></div></li>
            <li><div><h3>The student asks for a person</h3><p>&ldquo;Connect to Admissions Officer&rdquo; puts the request in the staff console.</p></div></li>
            <li><div><h3>An officer joins in the browser</h3><p>One click from the staff console. No phone system needed.</p></div></li>
            <li><div><h3>Both sides hear their own language</h3><p>The student speaks <span className="en">English</span>, the officer speaks <span className="ko">Korean</span>, and each hears the other translated.</p></div></li>
          </ol>
          <div className="site-hero-actions">
            <Link href={ROUTES.demo} className="cta cta-primary">See the Inha demo</Link>
          </div>
        </Section>

        <Section index="02" label="Next" title="The same platform, other industries.">
          <p className="site-p">These are planned uses of the same building blocks. None of them is built yet.</p>
          <div className="site-grid">
            {NEXT_INDUSTRIES.map((i) => (
              <article key={i.name} className="site-card">
                <div className="site-card-top"><h3>{i.name}</h3><StatusChip status="planned" /></div>
                <p>{i.text}</p>
              </article>
            ))}
          </div>
        </Section>
      </main>
    </>
  );
}
