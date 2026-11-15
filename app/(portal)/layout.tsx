import type { Metadata } from "next";
import { RootHtml } from "@/components/shared/root-html";
import { siteFonts } from "@/lib/fonts/site";
import { baseMetadata } from "@/lib/site-metadata";
import "@/styles/legacy/tokens.css";
import "@/styles/legacy/globals.css";
import "@/styles/legacy/theme-shared.css";
import "../(call)/call.css";
import "@/styles/legacy/restyle.css";
import "../nav-shared.css";
import "../shell.css";
import "./portal.css";

export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: "Inha Admissions Assistant (UNAI demo)", template: "%s · Inha Admissions Assistant" },
  description: "Ask about applying to Inha University by voice or chat, and talk to an admissions officer with live English–Korean translation. A UNAI demonstration.",
};

/** The customer portal: UNAI's first implementation, an admissions assistant for Inha University (demo). */
export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml fonts={siteFonts} scrollBehavior><div className="call-root portal-root">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {children}
  </div></RootHtml>;
}
