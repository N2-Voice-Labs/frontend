import type { Metadata } from "next";
import { RootHtml } from "@/components/shared/root-html";
import { siteFonts } from "@/lib/fonts/site";
import { baseMetadata } from "@/lib/site-metadata";
import "../tokens.css";
import "./cinematic.css";

export const metadata: Metadata = {
  ...baseMetadata,
  title: "UNAI: AI voice agents and real-time translation for businesses",
  description: "UNAI is a B2B AI communication platform: AI voice agents, real-time translation, AI chatbots and developer APIs. First solution: an AI admissions assistant for international students.",
};

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml fonts={siteFonts}>{children}</RootHtml>;
}
