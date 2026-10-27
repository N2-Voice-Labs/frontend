import type { Metadata } from "next";
import { RootHtml } from "@/components/shared/root-html";
import { siteFonts } from "@/lib/fonts/site";
import { baseMetadata } from "@/lib/site-metadata";
import "../tokens.css";
import "./cinematic.css";

export const metadata: Metadata = {
  ...baseMetadata,
  title: "Voice Labs — Conversation shouldn't feel different",
  description: "Real-time voice infrastructure for a multilingual world: natural conversation across languages, with turn-taking, interruptions and code-switching.",
};

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml fonts={siteFonts}>{children}</RootHtml>;
}
