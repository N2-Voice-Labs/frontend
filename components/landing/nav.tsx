import { MobileMenu } from "@/components/shared/mobile-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SpeakShortcut } from "./demo-session";

export const SECTION_LINKS = [
  { label: "How it works", href: "#bridge" },
  { label: "Languages", href: "#languages" },
  { label: "Product", href: "#workspace" },
  { label: "Latency", href: "#latency" },
];

export function Nav() {
  return (
    <header className="nav">
      <div className="nav-pill">
        <a href="#top" className="logo"><span className="logo-mark">V<span>.</span></span><span className="logo-word">VOICE LABS</span></a>
        <nav className="links" aria-label="Main">
          {SECTION_LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <SpeakShortcut className="btn btn-primary">Speak to it</SpeakShortcut>
          <MobileMenu label="Main" links={SECTION_LINKS} action={<SpeakShortcut className="btn btn-primary">Speak to it</SpeakShortcut>} />
        </div>
      </div>
    </header>
  );
}
