import type { Metadata } from "next";
import { PortalPage, PortalSection } from "@/components/features/portal/portal-page";
import { CAMPUS, SOURCES } from "@/lib/portal-content";

export const metadata: Metadata = { title: "Campus & visa" };

export default function CampusPage() {
  return (
    <PortalPage eyebrow="Campus & visa" title="After you're admitted" pose="headset" bubble={<>Apply in time and your <strong>first-semester dorm place is guaranteed</strong>.</>} sources={[SOURCES.dormitory, SOURCES.springGuide, SOURCES.fallGuide]}
      lead="Housing, insurance, your student visa and registration: what happens between your acceptance and your first day.">
      <PortalSection title="Settling in" asks={["How do I get a student visa?", "How much money do I need in the bank balance certificate?", "Do I need private insurance?"]}>
        <div className="portal-cards">
          {CAMPUS.map((c) => <div key={c.title} className="portal-card"><h3>{c.title}</h3><p>{c.text}</p></div>)}
        </div>
      </PortalSection>
    </PortalPage>
  );
}
