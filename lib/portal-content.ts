/**
 * Content for the Inha admissions portal tabs (/inha/*). Every fact here is copied from the assistant's curated
 * knowledge files in backend.voice-labs/agents/inha-admissions/knowledge/ (01–12, retrieved 2026-11-12), which in
 * turn quote apply.inha.ac.kr and the Spring/Fall 2027 international admission guides. When those files change,
 * update this file in step so the pages and the assistant say the same thing.
 */

export const RETRIEVED = "12 Nov 2026";

export const SOURCES = {
  springGuide: { label: "Spring 2027 international admission guide (PDF)", url: "https://apply.inha.ac.kr/bbs/apply/148681/185116/download.do" },
  fallGuide: { label: "Fall 2027 international admission guide (PDF)", url: "https://apply.inha.ac.kr/bbs/apply/148681/185118/download.do" },
  tuition: { label: "Tuition & fees", url: "https://apply.inha.ac.kr/apply/18431/subview.do" },
  scholarships: { label: "Undergraduate scholarships", url: "https://apply.inha.ac.kr/apply/18430/subview.do" },
  dormitory: { label: "Dormitory", url: "https://apply.inha.ac.kr/apply/18432/subview.do" },
  graduate: { label: "General Graduate School admission", url: "https://apply.inha.ac.kr/apply/18406/subview.do" },
  graduateFees: { label: "Graduate tuition & refunds", url: "https://apply.inha.ac.kr/apply/18404/subview.do" },
  graduateScholarships: { label: "Graduate scholarships", url: "https://apply.inha.ac.kr/apply/18403/subview.do" },
  overview: { label: "International admissions", url: "https://apply.inha.ac.kr/apply/18397/subview.do" },
} as const;
export type Source = (typeof SOURCES)[keyof typeof SOURCES];

/* ---------------- Contacts (footer) ---------------- */

export const CONTACTS = [
  { team: "International Admissions (undergraduate & graduate)", phone: "032-860-8609", emails: ["apply@inha.ac.kr (undergraduate)", "gradapply@inha.ac.kr (graduate)"] },
  { team: "Korean Language Center", phone: "032-860-8274, 8275, 8302", emails: ["ltc@inha.ac.kr"] },
  { team: "International Center", phone: "032-860-7030–7033, 7036–7039", emails: ["interservice@inha.ac.kr (student support)", "orir@inha.ac.kr (exchange)"] },
];
export const OFFICE = "Global Talent Recruitment Team · Kim Hyun Tae Inha Dream Center (Building #16), 5th floor, Room 502 · 100 Inha-ro, Michuhol-gu, Incheon 22212";

/* ---------------- Programs ---------------- */

export type College = { name: string; majors: string[] };

export const KOREAN_TRACK_COLLEGES: College[] = [
  { name: "Engineering", majors: ["Mechanical Engineering", "Aerospace Engineering", "Naval Architecture & Ocean Engineering", "Industrial Engineering", "Chemical and Energy Engineering (Chemical Engineering / Secondary Battery Engineering)", "Polymer Science and Engineering", "Materials Science Engineering", "Civil Engineering", "Environmental Engineering", "Geo-informational Engineering", "Architecture", "Energy Resources Engineering", "Electrical and Electronic Engineering", "Semiconductor Systems Engineering"] },
  { name: "Bio Convergence", majors: ["Biological Engineering", "Biological Sciences", "Advanced Biopharmaceuticals", "Biofood Engineering"] },
  { name: "AI Convergence", majors: ["Artificial Intelligence Engineering", "Data Science", "Smart Mobility", "Design Technology", "Computer Engineering"] },
  { name: "Natural Science", majors: ["Mathematics", "Statistics", "Physics", "Chemistry", "Ocean Sciences", "Food and Nutrition"] },
  { name: "Business Administration", majors: ["Business Administration", "Business Administration (Finance and Management)", "Asia Pacific School of Logistics", "International Trade"] },
  { name: "Social Science", majors: ["Public Administration", "Political Science and International Relations", "Media Communication", "Economics", "Consumer Science", "Child Studies", "Social Welfare Studies"] },
  { name: "Humanities", majors: ["Korean Language and Literature", "History", "Philosophy", "China Studies", "Japanese Language and Culture", "English and European Humanities Convergence", "Cultural Contents and Management"] },
  { name: "Nursing", majors: ["Nursing"] },
  { name: "Education", majors: ["Physical Education (3 students)"] },
  { name: "Arts and Sports", majors: ["Fine Arts", "Design Convergence", "Kinesiology", "Theater and Film Studies", "Fashion Design and Textiles"] },
  { name: "International Studies", majors: ["KLC (Korean Language & Culture)", "Division of Global Liberal Studies (choose a major in year 2)"] },
];

export const ENGLISH_TRACK = [
  { name: "IBT", full: "International Business & Trade", note: "100% English lectures. Freshmen and transfers." },
  { name: "ISE", full: "Integrated System Engineering", note: "100% English lectures. Freshmen and transfers." },
  { name: "GLOBA", full: "Business Administration, Finance and Management, Asia Pacific School of Logistics", note: "Transfers only, no 2nd-year transfers. The Business Administration GLOBA course is only for students pre-approved through a partner university or the department." },
];

export const PROGRAM_NOTES = [
  "Nursing, Physical Education and Architecture (5-year curriculum) have intake restrictions, and the Spring and Fall 2027 guides state them differently. Confirm your intake with the admissions office.",
  "Arts and Physical Education majors and Design Technology require performance materials (portfolio or video).",
  "Transfers can enter the 2nd or 3rd year; most Korean-track majors accept transfers. Majors and quotas may change after university and Ministry of Education review.",
];

export const GRADUATE = {
  intakes: [
    { term: "Spring (March intake)", period: "Mid-October to mid-November" },
    { term: "Fall (September intake)", period: "Mid-April to mid-May" },
  ],
  note: "Each cycle is open for about four weeks; detailed schedules are announced in early October and early April. This applies to the General Graduate School only.",
  fees: [
    { field: "Engineering & Arts", tuition: 7_667_000 },
    { field: "Natural Sciences & PE", tuition: 7_115_000 },
    { field: "Humanities & Social Sciences", tuition: 5_921_000 },
    { field: "Medicine", tuition: 9_697_000 },
  ],
  admissionFee: 1_041_000,
};

/* ---------------- How to apply ---------------- */

export const ELIGIBILITY = [
  { title: "Nationality", text: "You and both parents must be non-Korean, and must have held foreign citizenship before you entered high school. Dual citizens regarded as Korean cannot apply." },
  { title: "Freshmen", text: "High school graduates or expected graduates, or applicants with education above high school level." },
  { title: "2nd-year transfer", text: "At least 1 full academic year (2 semesters) and 32 credits at a 4-year university, or a graduate or expected graduate of a 2–3-year junior college." },
  { title: "3rd-year transfer", text: "At least 2 full academic years (4 semesters) and 65 credits at a Korean 4-year university, or 2 years and half the graduation credits abroad. At most 4 semesters are recognized." },
];

export const LANGUAGE = [
  { track: "Korean track, freshmen", need: "TOPIK (or TOPIK IBT) Level 3+, Level 4+ at a Korean university language program, or King Sejong Institute Intermediate-4A+." },
  { track: "Korean track, transfers", need: "TOPIK Level 4+, Level 5+ at a Korean university language program, or King Sejong Intermediate-4A+ (Level 3 for Child Psychology and Cultural Contents)." },
  { track: "Global Liberal Studies", need: "TOPIK Level 2 or Level 3 completion at a Korean university institute, with intensive first-year Korean (about KRW 1.5 million per year)." },
  { track: "English track (IBT, ISE, GLOBA)", need: "IELTS 5.5+, TOEFL iBT 71+ (or 4+ on the new scale for tests after 21 Jan 2026). Not accepted: TOEFL Home Edition, IELTS Indicator. Native English speakers are exempt." },
];

export const PROCEDURE = [
  "Apply online at internationalcenter.inha.ac.kr (or Study in Korea) and choose Spring 2027 or Fall 2027.",
  "Fill in and save the form, then pay the KRW 150,000 application fee online. Nothing can be changed after payment.",
  "Print the application form and the forms generated online.",
  "Send the documents by post, or bring them on weekdays 09:00–17:00, to the Global Talent Recruitment Team.",
  "Selection is 100% document evaluation. Check results on the admissions website; there is no individual notice.",
];

export type ChecklistItem = { id: string; label: string; detail?: string; who: "all" | "freshman" | "transfer" };

export const DOCUMENTS: ChecklistItem[] = [
  { id: "form", label: "Application form with a 3.5 × 4.5 cm photo", detail: "Printed after the online application.", who: "all" },
  { id: "schools", label: "Overseas schools information form", detail: "Printed after the online application. Korean school graduates are exempt.", who: "all" },
  { id: "agreement", label: "Letter of agreement for academic background check", detail: "Printed after the online application. Korean school graduates are exempt.", who: "all" },
  { id: "language", label: "Language certificate", detail: "TOPIK / King Sejong / Korean university program, or TOEFL iBT / IELTS. Must be valid when you submit online.", who: "all" },
  { id: "hs", label: "High school diploma (or expected graduation) and transcripts", detail: "With Apostille or Korean consular confirmation. Transfers need the diploma only.", who: "freshman" },
  { id: "uni", label: "University diploma (or expected graduation) and transcripts", detail: "With Apostille or Korean consular confirmation; Chinese universities use CHSI / CDGDC reports.", who: "transfer" },
  { id: "family", label: "Proof of nationality and family relationship", detail: "Family register or birth certificate, with a notarized English (or Korean) translation.", who: "all" },
  { id: "passports", label: "Passport copies of you and both parents", detail: "National ID copies if a passport is not yet issued.", who: "all" },
  { id: "portfolio", label: "Portfolio or video (arts and sports majors only)", detail: "Kinesiology: video. Design, Fine Arts, Fashion, Design Technology: portfolio. Theater and Film: both.", who: "all" },
];

/* ---------------- Dates ---------------- */

export type ScheduleStep = { id: string; label: string; start?: string; end: string };
export type Intake = { id: string; term: string; steps: ScheduleStep[] };

/** All times are Korea Standard Time (UTC+9), as the guides state. */
export const INTAKES: Intake[] = [
  {
    id: "spring-2027",
    term: "Spring 2027 · March intake",
    steps: [
      { id: "apply", label: "Online application", start: "2026-09-30T10:00:00+09:00", end: "2026-11-05T17:00:00+09:00" },
      { id: "docs", label: "Document submission", start: "2026-09-30T10:00:00+09:00", end: "2026-11-12T17:00:00+09:00" },
      { id: "result", label: "Results announced", end: "2026-12-22T14:00:00+09:00" },
      { id: "pay", label: "Tuition payment", start: "2026-12-23T09:00:00+09:00", end: "2027-01-12T16:00:00+09:00" },
    ],
  },
  {
    id: "fall-2027",
    term: "Fall 2027 · September intake",
    steps: [
      { id: "apply", label: "Online application", start: "2027-04-14T10:00:00+09:00", end: "2027-05-11T17:00:00+09:00" },
      { id: "docs", label: "Document submission", start: "2027-04-14T10:00:00+09:00", end: "2027-05-26T17:00:00+09:00" },
      { id: "result", label: "Results announced", end: "2027-06-29T14:00:00+09:00" },
      { id: "pay", label: "Tuition payment", start: "2027-06-30T09:00:00+09:00", end: "2027-07-13T16:00:00+09:00" },
    ],
  },
];

export type StepStatus = "closed" | "open" | "upcoming" | "done";

/** A window step is open between start and end; a single moment (results) is upcoming until it happens, then done. */
export function scheduleStatus(step: ScheduleStep, now: Date): StepStatus {
  const t = now.getTime();
  const end = Date.parse(step.end);
  if (!step.start) return t >= end ? "done" : "upcoming";
  if (t < Date.parse(step.start)) return "upcoming";
  return t <= end ? "open" : "closed";
}

/** The soonest moment still ahead: an open window's end, or an upcoming step's start (or moment). */
export function nextDeadline(intakes: Intake[], now: Date): { intake: Intake; step: ScheduleStep; at: string; kind: "closes" | "opens" | "on" } | null {
  let best: { intake: Intake; step: ScheduleStep; at: string; kind: "closes" | "opens" | "on" } | null = null;
  for (const intake of intakes) {
    for (const step of intake.steps) {
      const status = scheduleStatus(step, now);
      const pick = status === "open" ? { at: step.end, kind: "closes" as const }
        : status === "upcoming" ? { at: step.start ?? step.end, kind: step.start ? "opens" as const : "on" as const }
        : null;
      if (pick && (!best || Date.parse(pick.at) < Date.parse(best.at))) best = { intake, step, ...pick };
    }
  }
  return best;
}

const KST = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export const formatKst = (iso: string) => `${KST.format(new Date(iso))} KST`;

/* ---------------- Costs ---------------- */

export const TUITION = [
  { college: "Engineering", krw: 5_462_000, usd: 3715 },
  { college: "Natural Science", krw: 5_076_000, usd: 3453 },
  { college: "Consumer / Child Studies / Nursing", krw: 4_665_000, usd: 3173 },
  { college: "Liberal Arts & Social Sciences", krw: 4_253_000, usd: 2893 },
];
export const TUITION_NOTE = "Per semester, 2026 academic year, at USD 1 = KRW 1,470. Fees can change with the year and exchange rate; treat these as a reference.";

export const SCHOLARSHIPS = [
  { name: "TOPIK scholarship (freshmen, both tracks)", award: "TOPIK 4: 30% · TOPIK 5: 50% · TOPIK 6: 100% of the first semester's tuition" },
  { name: "English score (Korean-track freshmen)", award: "TOEFL iBT 115 / IELTS 9: 4 years' full tuition, KRW 300,000 a month and a dorm room. Lower bands: 4 years without dorm (106 / 8), 1 year (96 / 7), half a semester (90 / 6.5). Native speakers are not eligible." },
  { name: "English track with TOPIK 3+", award: "TOEFL iBT 115 / IELTS 9: 4 years' full tuition, monthly KRW 300,000 and a dorm room; 106 / 8: 4 years and the monthly supplement." },
  { name: "Gaokao (Chinese applicants, Korean track)", award: "Cutoff + 70 points: 4 years' full tuition, monthly KRW 300,000 and dorm; + 50: without dorm; cutoff: 1 year's tuition." },
  { name: "Global 2 (from the 2nd semester, by GPA)", award: "GPA 4.30+: full tuition · 4.00+: 3/4 · 3.75+: 1/2 · 3.20+: 1/4 (International Studies has higher cut-offs)." },
];

export const DORM = {
  name: "Dormitory 2, quadruple room, shared bathroom",
  price: "KRW 1,340,000 per semester",
  includes: "Operating costs, fixtures deposit, student council fee and one meal a day (Mon–Fri).",
  note: "Quoted in the 2027 guides from an earlier semester; the dormitory site says the fee changes each semester. Ask apply@inha.ac.kr for the current price.",
};

/* ---------------- Campus & visa ---------------- */

export const CAMPUS = [
  { title: "Dormitory for first-semester freshmen", text: "International freshmen who apply in the designated period are guaranteed a place in their first semester. Later semesters depend on dormitory criteria (dorm.inha.ac.kr, 032-860-7274)." },
  { title: "Health insurance", text: "International students join national health insurance. Private insurance is required for the first 6 months, before alien registration; it is refunded once you join the national scheme." },
  { title: "Student visa", text: "After admission, the International Cooperation and Support Team emails the certificate of admission, and you apply at the Korean consulate at home. In Korea, you change or extend your status instead. Visa questions: 032-860-7037~8, interservice@inha.ac.kr." },
  { title: "Bank balance certificate", text: "Required for the certificate of admission, by the tuition payment deadline: KRW 20,000,000 (USD 16,000) for most applicants, KRW 10,000,000 for D-4 students at a Korean language institute; issued within 30 days of the application period opening." },
  { title: "Registration and cancellation", text: "Not registering in the registration period cancels admission, as do double enrollment, visa refusal, or no visa within two weeks of the semester starting." },
];

/* ---------------- Notices ---------------- */

/** Notices are dated by the event they announce (KST); general notices have no date. */
export type Notice = { date?: string; title: string; body: string; source: Source };

export const NOTICES: Notice[] = [
  { date: "2027-04-14T10:00:00+09:00", title: "Fall 2027 applications open 14 Apr 2027", body: "Online application: 14 Apr – 11 May 2027. Documents: until 26 May 2027. Results: 29 Jun 2027.", source: SOURCES.fallGuide },
  { date: "2026-12-22T14:00:00+09:00", title: "Spring 2027 results: 22 Dec 2026, 14:00 KST", body: "Results are posted on the international admissions website only; there is no individual notice. Tuition payment runs 23 Dec 2026 to 12 Jan 2027.", source: SOURCES.springGuide },
  { date: "2026-11-12T17:00:00+09:00", title: "Spring 2027 document submission closes", body: "Documents for the March 2027 intake are due by 12 Nov 2026, 17:00 KST.", source: SOURCES.springGuide },
  { date: "2026-11-05T17:00:00+09:00", title: "Spring 2027 online application closes", body: "The online application for the March 2027 intake closes on 5 Nov 2026, 17:00 KST.", source: SOURCES.springGuide },
  { title: "The Korean guide is the official version", body: "When the Korean, English and Chinese guides differ, the Korean version applies. The others are for convenience.", source: SOURCES.springGuide },
  { title: "Application fee: KRW 150,000", body: "Paid online after you submit. It is refunded only in the cases the guide lists, such as overpayment or a university-side problem.", source: SOURCES.springGuide },
];

/** Upcoming notices soonest first, then past ones newest first, then general ones. */
export function groupNotices(notices: Notice[], now: Date) {
  const t = now.getTime();
  const dated = notices.filter((n) => n.date);
  return {
    upcoming: dated.filter((n) => Date.parse(n.date!) > t).sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!)),
    past: dated.filter((n) => Date.parse(n.date!) <= t).sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!)),
    general: notices.filter((n) => !n.date),
  };
}

/* ---------------- Portal navigation ---------------- */

export const PORTAL_TABS = [
  { href: "/inha", label: "Home" },
  { href: "/inha/programs", label: "Programs" },
  { href: "/inha/apply", label: "How to apply" },
  { href: "/inha/dates", label: "Dates" },
  { href: "/inha/costs", label: "Tuition & scholarships" },
  { href: "/inha/campus", label: "Campus & visa" },
  { href: "/inha/notices", label: "Notices" },
] as const;
