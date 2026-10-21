import { AsciiField } from "@/components/shared/ascii-field";
import { ROUTES, SITE_LINKS } from "@/lib/landing/config";

const SOCIAL = [
  {
    label: "Email Voice Labs", href: SITE_LINKS.email && `mailto:${SITE_LINKS.email}`,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>,
  },
  {
    label: "Voice Labs on GitHub", href: SITE_LINKS.github,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" /></svg>,
  },
  {
    label: "Voice Labs on LinkedIn", href: SITE_LINKS.linkedin,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM3.3 9h3.4v11.5H3.3zM9 9h3.3v1.6c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.4v6.4h-3.4v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3v5.8H9z" /></svg>,
  },
].filter((s) => s.href);

const COLUMNS = [
  { title: "Product", links: [{ label: "Live voice", href: "#top" }, { label: "Translation", href: "#bridge" }, { label: "Workflow", href: "#workspace" }, { label: "Latency", href: "#latency" }] },
  { title: "Workspace", links: [{ label: "Call", href: ROUTES.call }, { label: "Agents", href: ROUTES.agents }, { label: "Conversations", href: ROUTES.conversations }, { label: "Voices", href: ROUTES.voices }, { label: "Usage", href: ROUTES.usage }] },
  { title: "Company", links: [{ label: "Contact", href: SITE_LINKS.contact }, { label: "Privacy", href: SITE_LINKS.privacy }, { label: "Terms", href: SITE_LINKS.terms }] },
].map((c) => ({ ...c, links: c.links.filter((l): l is { label: string; href: string } => !!l.href) })).filter((c) => c.links.length);

/** Brand and links, then the ASCII noise field under the giant wordmark. The pilot offer lives in ClosingCta. */
export function SiteFooter() {
  return (
    <footer className="foot sec">
      <div className="wrap foot-top">
        <div className="foot-brand">
          <a href="#top" className="logo"><span className="logo-mark">V<span>.</span></span><span className="logo-word">VOICE LABS</span></a>
          <p>Voice AI that follows people across languages — and lets them be understood.</p>
          {SOCIAL.length > 0 && (
            <div className="foot-social">
              {SOCIAL.map((s) => <a key={s.label} className="icon-btn" href={s.href!} aria-label={s.label}>{s.icon}</a>)}
            </div>
          )}
        </div>

        <nav className="foot-cols" aria-label="Footer">
          {COLUMNS.map((c) => (
            <div key={c.title} className="foot-col">
              <span className="mono sm">{c.title}</span>
              {c.links.map((l) => <a key={l.label} href={l.href}>{l.label}</a>)}
            </div>
          ))}
        </nav>
      </div>

      <div className="foot-field">
        <AsciiField />
        <div className="foot-mark" aria-hidden="true">
          <span className="foot-tile">V<i /></span>
          <span className="foot-word">Voice <em>Labs</em></span>
        </div>
      </div>

      <div className="wrap foot-bottom">
        <span>© 2026 Voice Labs</span>
        <span>Conversation examples are illustrative.</span>
      </div>
    </footer>
  );
}
