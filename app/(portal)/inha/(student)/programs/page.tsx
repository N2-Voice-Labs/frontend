import type { Metadata } from "next";
import { PortalPage, PortalSection } from "@/components/features/portal/portal-page";
import { ProgramsExplorer } from "@/components/features/portal/portal-widgets";
import { ENGLISH_TRACK, GRADUATE, PROGRAM_NOTES, SOURCES } from "@/lib/portal-content";

export const metadata: Metadata = { title: "Programs" };

const krw = (n: number) => `₩${n.toLocaleString("en-US")}`;

export default function ProgramsPage() {
  return (
    <PortalPage eyebrow="Programs" title="Find your major" pose="reading" bubble={<>56 majors in 11 colleges, plus the English-taught <strong>IBT</strong> and <strong>ISE</strong>.</>} onThisPage={[{ id: "majors", label: "Korean-track majors" }, { id: "english", label: "English-taught tracks" }, { id: "notes", label: "Good to know" }, { id: "graduate", label: "Graduate school" }]} sources={[SOURCES.springGuide, SOURCES.fallGuide, SOURCES.graduate, SOURCES.graduateFees]}
      lead="Undergraduate majors open to international freshmen in 2027, by college. Most are taught in Korean; the English-taught tracks are listed below.">
      <PortalSection id="majors" title="Korean-track majors" asks={["Which majors accept transfer students?", "Do I need a portfolio for design majors?"]}>
        <ProgramsExplorer />
      </PortalSection>
      <PortalSection id="english" title="English-taught tracks" asks={["What is the difference between IBT and ISE?"]}>
        <div className="portal-cards">
          {ENGLISH_TRACK.map((t) => (
            <div key={t.name} className="portal-card"><h3>{t.name}</h3><p className="portal-card-sub">{t.full}</p><p>{t.note}</p></div>
          ))}
        </div>
      </PortalSection>
      <PortalSection id="notes" title="Good to know">
        <ul className="portal-bullets">{PROGRAM_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
      </PortalSection>
      <PortalSection id="graduate" title="Graduate school" asks={["What scholarships are there for graduate students?"]}>
        <div className="portal-cards">
          {GRADUATE.intakes.map((i) => <div key={i.term} className="portal-card"><h3>{i.term}</h3><p>Applications: {i.period}</p></div>)}
        </div>
        <p className="portal-fine">{GRADUATE.note}</p>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <caption>Graduate tuition per semester, 2026 (admission fee {krw(GRADUATE.admissionFee)} in the first semester only)</caption>
            <thead><tr><th scope="col">Field</th><th scope="col">Tuition</th></tr></thead>
            <tbody>{GRADUATE.fees.map((f) => <tr key={f.field}><th scope="row">{f.field}</th><td>{krw(f.tuition)}</td></tr>)}</tbody>
          </table>
        </div>
      </PortalSection>
    </PortalPage>
  );
}
