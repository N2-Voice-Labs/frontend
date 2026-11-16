"use client";

import Link from "next/link";
import { useAssistant } from "./assistant-dock";
import { Mascot } from "./mascot";

/** Topics students ask about most. Each one is a question for the assistant, never an answer on the page. */
const TOPICS = [
  { title: "Admission requirements", question: "What are the admission requirements for international undergraduate students?" },
  { title: "Required documents", question: "What documents do I need to apply?" },
  { title: "Application deadlines", question: "When is the application period for the next intake?" },
  { title: "Tuition fees", question: "How much is tuition per semester?" },
  { title: "Scholarships", question: "What scholarships are available for international students?" },
  { title: "Language requirements", question: "Do I need TOPIK or an English test score to apply?" },
];

const EXPLORE = [
  { href: "/inha/programs", title: "Programs", text: "Colleges, majors and English-taught tracks", pose: "reading" },
  { href: "/inha/apply", title: "How to apply", text: "Eligibility, language and your document checklist", pose: "writing" },
  { href: "/inha/dates", title: "Dates", text: "Spring and Fall 2027 deadlines", pose: "clock" },
  { href: "/inha/costs", title: "Tuition & scholarships", text: "Fees per college and scholarships", pose: "celebrate" },
  { href: "/inha/campus", title: "Campus & visa", text: "Dormitory, insurance and your student visa", pose: "headset" },
  { href: "/inha/notices", title: "Notices", text: "Deadlines and announcements", pose: "megaphone" },
] as const;

export function PortalHome() {
  const assistant = useAssistant();
  return (
    <main id="main-content" className="portal-main">
      <header className="portal-hero-band portal-home-band">
        <div className="portal-hero-band-copy">
          <p className="portal-eyebrow">For international applicants</p>
          <h1 id="portal-title">Questions about studying at Inha? <span>Ask any time.</span></h1>
          <p className="portal-pagehead-lead">
            Talk to the AI Admissions Assistant by voice or chat. It answers from the university&apos;s published admissions information.
            When you need a person, it connects you to an admissions officer, with live translation between English and Korean.
          </p>
          <div className="portal-home-ctas">
            <button type="button" className="portal-btn portal-btn-primary portal-btn-call" onClick={() => assistant.open("voice")}>Start a voice call</button>
            <button type="button" className="portal-btn portal-home-chat" onClick={() => assistant.open("chat")}>Chat with the assistant</button>
          </div>
          <ul className="portal-promises">
            <li><strong>24/7</strong><span>Answers outside office hours</span></li>
            <li><strong>Verified</strong><span>Only from published admissions information</span></li>
            <li><strong>EN ↔ KO</strong><span>Live translation with staff</span></li>
          </ul>
        </div>
        <Mascot pose="wave" width={320} priority speechSide="top" className="portal-hero-sticker portal-home-sticker" speech={<>Hi! I&apos;m the admissions dragon. <strong>Ask me anything</strong>, any time.</>} />
      </header>

      <section className="portal-section" aria-labelledby="explore-title">
        <h2 id="explore-title">Explore admissions</h2>
        <div className="portal-explore">
          {EXPLORE.map((e) => (
            <Link key={e.href} href={e.href} className="portal-tile">
              <span className="portal-tile-art"><Mascot pose={e.pose} width={170} /></span>
              <span className="portal-tile-body">
                <span className="portal-tile-title">{e.title}</span>
                <span className="portal-tile-text">{e.text}</span>
                <span className="portal-tile-go" aria-hidden="true">Open →</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section id="topics" className="portal-section" aria-labelledby="topics-title">
        <h2 id="topics-title">What students ask most</h2>
        <p className="portal-section-lead">Pick a topic to ask the assistant in the chat.</p>
        <div className="portal-topics">
          {TOPICS.map((t) => (
            <button key={t.title} type="button" className="portal-topic" onClick={() => assistant.ask(t.question)}>
              <span className="portal-topic-title">{t.title}</span>
              <span className="portal-topic-q">&ldquo;{t.question}&rdquo;</span>
              <span className="portal-topic-go" aria-hidden="true">Ask →</span>
            </button>
          ))}
        </div>
      </section>

      <section id="how" className="portal-section" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol className="portal-steps">
          <li><strong>Start a voice call</strong><span>In your browser. No app or phone number needed, just your microphone.</span></li>
          <li><strong>Ask your question</strong><span>The assistant answers from Inha&apos;s admissions information. If it doesn&apos;t know, it tells you instead of guessing.</span></li>
          <li><strong>Talk to an officer</strong><span>Choose &ldquo;Connect to Admissions Officer&rdquo;. A staff member joins, and each of you hears the other in your own language.</span></li>
        </ol>
      </section>
    </main>
  );
}
