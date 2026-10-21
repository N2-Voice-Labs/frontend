import type { Metadata } from "next";
import { RootHtml } from "@/components/shared/root-html";
import { siteFonts } from "@/lib/fonts/site";
import { baseMetadata } from "@/lib/site-metadata";
import "@/styles/legacy/tokens.css";
import "@/styles/legacy/globals.css";
import "@/styles/legacy/theme-shared.css";
import "./call.css";
import "@/styles/legacy/restyle.css";
import "../nav-shared.css";
import "../shell.css";

// Hangul uses the system faces (--font-hangul-system), as on every other page. The previous app
// self-hosted Noto Sans KR here; its 120+ render-blocking @font-face rules delayed the call screen's first
// paint by ~0.6 s, and every target platform ships a good Korean face.

/**
 * Layer A (communication): /call and /join. No background canvas or footer; a call gets the whole viewport
 * (UX spec §2.2, design system §5.3). Setup and ended screens show workspace navigation (call-nav.tsx);
 * the live call screen does not, because leaving the page drops the call.
 */
export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: "Call", template: "%s · Voice Labs" },
};

export default function CallLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml fonts={siteFonts} scrollBehavior><div className="call-root">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {children}
  </div></RootHtml>;
}
