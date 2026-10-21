import type { Metadata } from "next";
import { CallExperience } from "@/components/features/call/call-experience";

export const metadata: Metadata = {
  title: "Start a call",
  description: "Pick two languages and talk. Each of you hears the other in your own language.",
};

export default function CallPage() {
  return <CallExperience />;
}
