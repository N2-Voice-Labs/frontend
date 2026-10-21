import type { Metadata } from "next";
import { JoinExperience } from "@/components/features/call/join-experience";

export const metadata: Metadata = {
  title: "Join a call",
  // Invite links are personal and short-lived; keep them out of search results and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function JoinPage() {
  return <JoinExperience />;
}
