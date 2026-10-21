import type { Metadata } from "next";

export const baseMetadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: { type: "website", siteName: "Voice Labs" },
  twitter: { card: "summary_large_image" },
};
