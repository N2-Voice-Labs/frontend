import Link from "next/link";
import { ROUTES, SITE_LINKS } from "@/lib/landing/config";
import { AVAILABILITY, type Availability, SITE_NAV } from "./site-nav";

/** Wordmark: the bridge dot between the two halves, as in the film's top bar. */
export function Wordmark() {
  return (
    <Link href={ROUTES.home} className="site-mark" aria-label="UNAI home">
      UN<span aria-hidden="true">·</span>AI
    </Link>
  );
}

/** Header for the content pages. On phones the links fold into a native disclosure (no JS). */
export function SiteHeader({ current }: { current?: string }) {
  const links = SITE_NAV.map((item) => (
    <Link key={item.href} href={item.href} className="site-nav-link" aria-current={current === item.href ? "page" : undefined}>
      {item.label}
    </Link>
  ));
  return (
    <header className="site-header">
      <Wordmark />
      <nav className="site-nav" aria-label="Main">{links}</nav>
      <details className="site-menu">
        <summary className="site-nav-link">Menu</summary>
        <nav className="site-menu-panel" aria-label="Main">{links}</nav>
      </details>
    </header>
  );
}

export function SiteFooter() {
  const email = SITE_LINKS.email;
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <Wordmark />
        <p className="site-footer-line">AI communication infrastructure for businesses: voice agents, real-time translation and chatbots.</p>
      </div>
      <nav className="site-footer-nav" aria-label="Footer">
        {SITE_NAV.map((item) => (
          <Link key={item.href} href={item.href} className="mono">{item.label}</Link>
        ))}
        {email && <a href={`mailto:${email}`} className="mono">{email}</a>}
      </nav>
      <p className="site-footer-legal mono sm">© {new Date().getFullYear()} UNAI · formerly Voice Labs</p>
    </footer>
  );
}

/** Top of a content page: kicker, a big uppercase title with one italic serif phrase, and a lede. */
export function PageHero({ kicker, title, em, lede, children }: { kicker: string; title: string; em?: string; lede: string; children?: React.ReactNode }) {
  return (
    <section className="site-hero">
      <p className="kicker">{kicker}</p>
      <h1 className="ct site-title">
        {title}
        {em && <> <em>{em}</em></>}
      </h1>
      <p className="lede site-lede">{lede}</p>
      {children && <div className="site-hero-actions">{children}</div>}
    </section>
  );
}

export function StatusChip({ status }: { status: Availability }) {
  return <span className="site-chip" data-status={status}>{AVAILABILITY[status]}</span>;
}

/** A numbered section with a mono label column, like the film's chapter markers. */
export function Section({ index, label, title, children, id }: { index: string; label: string; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="site-section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="site-section-label">
        <span className="mono">{index}</span>
        <span className="mono">{label}</span>
      </div>
      <div className="site-section-body">
        <h2 className="site-h2" id={id ? `${id}-title` : undefined}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
