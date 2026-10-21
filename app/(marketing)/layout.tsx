import type { Metadata } from "next";
import { RootHtml } from "@/components/shared/root-html";
import { siteFonts } from "@/lib/fonts/site";
import { baseMetadata } from "@/lib/site-metadata";
import "../tokens.css";
import "../nav-shared.css";
import "./landing.css";

export const metadata: Metadata = {
  ...baseMetadata,
  title: "Voice Labs — From noise to understanding",
  description: "Voice agents and live translation that follow people across languages — mid-sentence, in real time.",
};

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml fonts={siteFonts}>{children}</RootHtml>;
}
