import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CallFixture, type FixtureName } from "@/components/features/call/call-fixture";

export const metadata: Metadata = { title: "Call fixture", robots: { index: false, follow: false } };

const names: FixtureName[] = ["live", "waiting", "translating", "reconnecting", "ended"];

/**
 * Development-only visual fixture of the call screen with mocked state (no Platform, no LiveKit).
 * Used for screenshots and design review. Returns 404 in production builds.
 */
export default async function CallFixturePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const requested = (await searchParams).state;
  const name = names.find((item) => item === requested) ?? "live";
  return <CallFixture name={name} />;
}
