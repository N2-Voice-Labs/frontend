import type { Metadata } from "next";
import Link from "next/link";
import { StaffConsole } from "@/components/features/portal/staff-console";

export const metadata: Metadata = { title: "Staff console", robots: { index: false, follow: false } };

export default function StaffPage() {
  return (
    <>
      <header className="portal-header">
        <Link href="/inha" className="portal-brand">
          <span className="portal-crest" aria-hidden="true">IN</span>
          <span><span className="portal-brand-name">Inha University</span><span className="portal-brand-sub">Admissions office</span></span>
        </Link>
        <nav className="portal-header-nav" aria-label="Portal"><span className="portal-demo-badge">Demo · Powered by UNAI</span></nav>
      </header>
      <StaffConsole />
    </>
  );
}
