"use client";

import Link from "next/link";
import { useRef } from "react";
import { AssistantPanel, type AssistantHandle } from "./assistant-panel";

/** Topics students ask about most. Each one is a question for the assistant, never an answer on the page. */
const TOPICS = [
  { title: "Admission requirements", question: "What are the admission requirements for international undergraduate students?" },
  { title: "Required documents", question: "What documents do I need to apply?" },
  { title: "Application deadlines", question: "When is the application period for the next intake?" },
  { title: "Tuition fees", question: "How much is tuition per semester?" },
  { title: "Scholarships", question: "What scholarships are available for international students?" },
  { title: "Language requirements", question: "Do I need TOPIK or an English test score to apply?" },
];

export function PortalHome() {
  const assistant = useRef<AssistantHandle>(null);
  return (
    <>
      <header className="portal-header">
        <Link href="/inha" className="portal-brand" aria-label="Inha University International Admissions, demo home">
          <span className="portal-crest" aria-hidden="true">IN</span>
          <span>
            <span className="portal-brand-name">Inha University</span>
            <span className="portal-brand-sub">International Admissions</span>
          </span>
        </Link>
        <nav className="portal-header-nav" aria-label="Portal">
          <a href="#topics">Topics</a>
          <a href="#how">How it works</a>
          <Link href="/inha/staff">Staff</Link>
          <span className="portal-demo-badge">Demo · Powered by UNAI</span>
        </nav>
      </header>

      <main id="main-content" className="portal-main">
        <section className="portal-hero" aria-labelledby="portal-title">
          <div className="portal-hero-copy">
            <p className="portal-eyebrow">For international applicants</p>
            <h1 id="portal-title">Questions about studying at Inha? <span>Ask any time.</span></h1>
            <p className="portal-hero-lead">
              Talk to the AI Admissions Assistant by voice or chat. It answers from the university&apos;s published admissions information.
              When you need a person, it connects you to an admissions officer, with live translation between English and Korean.
            </p>
            <ul className="portal-promises">
              <li><strong>24/7</strong><span>Answers outside office hours</span></li>
              <li><strong>Verified</strong><span>Only from published admissions information</span></li>
              <li><strong>EN ↔ KO</strong><span>Live translation with staff</span></li>
            </ul>
          </div>
          <AssistantPanel ref={assistant} />
        </section>

        <section id="topics" className="portal-section" aria-labelledby="topics-title">
          <h2 id="topics-title">What students ask most</h2>
          <p className="portal-section-lead">Pick a topic to ask the assistant in the chat.</p>
          <div className="portal-topics">
            {TOPICS.map((t) => (
              <button key={t.title} type="button" className="portal-topic" onClick={() => assistant.current?.ask(t.question)}>
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

      <footer className="portal-footer">
        <p><strong>This is a demonstration by UNAI</strong>, not an official Inha University service. Information comes from Inha&apos;s published admissions pages; always confirm deadlines, fees and requirements on the university&apos;s official website.</p>
        <p className="portal-fine">Calls and chats are recorded as transcripts so the admissions office can follow up. Built on UNAI: AI voice agents, real-time translation and chat.</p>
      </footer>
    </>
  );
}
