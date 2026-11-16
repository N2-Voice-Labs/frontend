import type { Metadata } from "next";
import Link from "next/link";
import { Mascot } from "@/components/features/portal/mascot";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function PortalNotFound() {
  return (
    <>
      <header className="portal-header">
        <Link href="/inha" className="portal-brand">
          <span className="portal-crest" aria-hidden="true">IN</span>
          <span><span className="portal-brand-name">Inha University</span><span className="portal-brand-sub">International Admissions</span></span>
        </Link>
        <nav className="portal-header-nav" aria-label="Portal"><span className="portal-demo-badge">Demo · Powered by UNAI</span></nav>
      </header>
      <main id="main-content" className="portal-404">
        <Mascot pose="confused" width={280} label="The admissions dragon scratching its head, confused" speechSide="top" speech={<>Hmm, this page isn&apos;t here.</>} />
        <h1>We couldn&apos;t find that page</h1>
        <p className="portal-pane-lead">The address may be mistyped, or the page has moved. The admissions assistant can still help with your question.</p>
        <Link href="/inha" className="portal-btn portal-btn-primary">Back to the admissions portal</Link>
      </main>
    </>
  );
}
