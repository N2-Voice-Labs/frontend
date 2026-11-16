import type { Metadata } from "next";
import { PortalPage, PortalSection } from "@/components/features/portal/portal-page";
import { DORM, SCHOLARSHIPS, SOURCES, TUITION, TUITION_NOTE } from "@/lib/portal-content";

export const metadata: Metadata = { title: "Tuition & scholarships" };

export default function CostsPage() {
  return (
    <PortalPage eyebrow="Tuition & scholarships" title="What it costs, and how to pay less" pose="celebrate" bubble={<>TOPIK 6 makes your <strong>first semester&apos;s tuition free</strong>.</>} onThisPage={[{ id: "tuition", label: "Tuition" }, { id: "scholarships", label: "Scholarships" }, { id: "dorm", label: "Dormitory" }]} sources={[SOURCES.tuition, SOURCES.scholarships, SOURCES.dormitory, SOURCES.springGuide]}
      lead="Undergraduate tuition per semester, the scholarships international students can get, and the dormitory fee.">
      <PortalSection id="tuition" title="Tuition per semester" asks={["How much is undergraduate tuition for engineering per semester?", "When do I pay tuition?"]}>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th scope="col">College</th><th scope="col">KRW</th><th scope="col">≈ USD</th></tr></thead>
            <tbody>{TUITION.map((t) => <tr key={t.college}><th scope="row">{t.college}</th><td>₩{t.krw.toLocaleString("en-US")}</td><td>${t.usd.toLocaleString("en-US")}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="portal-fine">{TUITION_NOTE} Application fee: KRW 150,000.</p>
      </PortalSection>
      <PortalSection id="scholarships" title="Scholarships" asks={["Which scholarship can I get with TOPIK 5?", "Is there a scholarship for IELTS 7?"]}>
        <div className="portal-cards">
          {SCHOLARSHIPS.map((s) => <div key={s.name} className="portal-card"><h3>{s.name}</h3><p>{s.award}</p></div>)}
        </div>
        <p className="portal-fine">One scholarship per student. Eligibility is decided after all documents are submitted.</p>
      </PortalSection>
      <PortalSection id="dorm" title="Dormitory" asks={["Is a dormitory room guaranteed?"]}>
        <div className="portal-card portal-card-wide"><h3>{DORM.name}</h3><p className="portal-price">{DORM.price}</p><p>{DORM.includes}</p><p className="portal-fine">{DORM.note}</p></div>
      </PortalSection>
    </PortalPage>
  );
}
