import { AsciiField } from "@/components/shared/ascii-field";
import { ROUTES, SITE_LINKS } from "@/lib/landing/config";

const LINKS = [
  { label: "Home", href: ROUTES.home },
  { label: "Usage", href: ROUTES.usage },
  { label: "Docs", href: SITE_LINKS.docs },
  { label: "Support", href: SITE_LINKS.support },
].filter((l): l is { label: string; href: string } => !!l.href);

/** Compact footer for workspace pages: ASCII field under the wordmark, then a link row. */
export function WorkspaceFooter() {
  return (
    <footer className="foot">
      <div className="foot-field">
        <AsciiField />
        <div className="foot-mark" aria-hidden="true"><span className="foot-word">Voice <em>Labs</em></span></div>
      </div>
      <div className="wrap foot-bottom">
        <span>Voice Labs · Voice agent workspace</span>
        <nav aria-label="Footer">{LINKS.map((l) => <a key={l.label} href={l.href}>{l.label}</a>)}</nav>
      </div>
    </footer>
  );
}
