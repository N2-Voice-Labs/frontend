"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONTACTS, OFFICE, PORTAL_TABS } from "@/lib/portal-content";

/** The portal's header: Inha brand, the section tabs, and the demo badge. */
export function PortalHeader() {
  const pathname = usePathname();
  return (
    <header className="portal-header portal-header-tabs">
      <div className="portal-header-top">
        <Link href="/inha" className="portal-brand" aria-label="Inha University International Admissions, demo home">
          <span className="portal-crest" aria-hidden="true">IN</span>
          <span>
            <span className="portal-brand-name">Inha University</span>
            <span className="portal-brand-sub">International Admissions</span>
          </span>
        </Link>
        <div className="portal-header-nav">
          <Link href="/inha/staff">Staff</Link>
          <span className="portal-demo-badge">Demo · Powered by UNAI</span>
        </div>
      </div>
      <nav className="portal-tabbar" aria-label="Admissions sections">
        {PORTAL_TABS.map((tab) => {
          const current = tab.href === "/inha" ? pathname === "/inha" : pathname?.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className="portal-tablink" aria-current={current ? "page" : undefined}>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function PortalFooter() {
  return (
    <footer className="portal-footer">
      <div className="portal-contacts">
        {CONTACTS.map((c) => (
          <div key={c.team}>
            <p className="portal-contact-team">{c.team}</p>
            <p>{c.phone}</p>
            {c.emails.map((e) => <p key={e}>{e}</p>)}
          </div>
        ))}
      </div>
      <p className="portal-fine">{OFFICE}</p>
      <p><strong>This is a demonstration by UNAI</strong>, not an official Inha University service. Information comes from Inha&apos;s published admissions pages; always confirm deadlines, fees and requirements on the university&apos;s official website.</p>
      <p className="portal-fine">Calls and chats are recorded as transcripts so the admissions office can follow up. Built on UNAI: AI voice agents, real-time translation and chat.</p>
    </footer>
  );
}
