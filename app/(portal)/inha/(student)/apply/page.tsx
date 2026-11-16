import type { Metadata } from "next";
import { PortalPage, PortalSection } from "@/components/features/portal/portal-page";
import { DocumentsChecklist } from "@/components/features/portal/portal-widgets";
import { ELIGIBILITY, LANGUAGE, PROCEDURE, SOURCES } from "@/lib/portal-content";

export const metadata: Metadata = { title: "How to apply" };

export default function ApplyPage() {
  return (
    <PortalPage eyebrow="How to apply" title="Apply to Inha, step by step" pose="writing" bubble={<>Tick off your documents as you go. Your list stays in this browser.</>} onThisPage={[{ id: "who", label: "Who can apply" }, { id: "language", label: "Language" }, { id: "steps", label: "5 steps" }, { id: "documents", label: "Document checklist" }]} sources={[SOURCES.springGuide, SOURCES.fallGuide]}
      lead="Who can apply, the language scores you need, how the online application works, and a checklist for your documents.">
      <PortalSection id="who" title="Who can apply" asks={["Can I apply if I have dual citizenship?", "Can I transfer into the 3rd year?"]}>
        <div className="portal-cards">
          {ELIGIBILITY.map((e) => <div key={e.title} className="portal-card"><h3>{e.title}</h3><p>{e.text}</p></div>)}
        </div>
      </PortalSection>
      <PortalSection id="language" title="Language requirements" asks={["Do I need TOPIK for the English track?", "Is TOEFL Home Edition accepted?"]}>
        <dl className="portal-deflist">
          {LANGUAGE.map((l) => <div key={l.track}><dt>{l.track}</dt><dd>{l.need}</dd></div>)}
        </dl>
      </PortalSection>
      <PortalSection id="steps" title="The application, in 5 steps" asks={["How do I pay the application fee?"]}>
        <ol className="portal-steps portal-steps-compact">
          {PROCEDURE.map((p) => <li key={p}><span>{p}</span></li>)}
        </ol>
      </PortalSection>
      <PortalSection title="Your document checklist" id="documents">
        <DocumentsChecklist />
        <p className="portal-fine">Documents not in English or Korean need a notarized translation. Documents are not returned. Post or bring them to Room 502, Kim Hyun Tae Inha Dream Center, 100 Inha-ro, Michuhol-gu, Incheon 22212 (weekdays 09:00–17:00).</p>
      </PortalSection>
    </PortalPage>
  );
}
