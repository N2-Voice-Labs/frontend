import type { Metadata } from "next";
import { PortalPage, PortalSection } from "@/components/features/portal/portal-page";
import { DatesTimeline, NextDeadlineBubble } from "@/components/features/portal/portal-widgets";
import { GRADUATE, SOURCES } from "@/lib/portal-content";

export const metadata: Metadata = { title: "Dates" };

export default function DatesPage() {
  return (
    <PortalPage eyebrow="Dates" title="Admission schedule 2027" pose="clock" bubble={<NextDeadlineBubble />} onThisPage={[{ id: "undergraduate", label: "Undergraduate intakes" }, { id: "graduate", label: "Graduate school" }]} sources={[SOURCES.springGuide, SOURCES.fallGuide, SOURCES.graduate]}
      lead="Undergraduate deadlines for the March and September 2027 intakes. All times are Korea Standard Time (KST).">
      <PortalSection id="undergraduate" title="Undergraduate intakes" asks={["When is the next application period?", "When will Spring 2027 results be announced?"]}>
        <DatesTimeline />
        <p className="portal-fine">Results are published on the admissions website only; there is no individual notification.</p>
      </PortalSection>
      <PortalSection id="graduate" title="Graduate school">
        <ul className="portal-bullets">{GRADUATE.intakes.map((i) => <li key={i.term}><strong>{i.term}:</strong> {i.period}</li>)}</ul>
        <p className="portal-fine">{GRADUATE.note}</p>
      </PortalSection>
    </PortalPage>
  );
}
