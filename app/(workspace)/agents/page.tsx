import type { Metadata } from "next";
import { AgentsPage } from "@/components/workspace/agents-page";

export const metadata: Metadata = { title: "Agents — Voice Labs Workspace" };

export default function Agents() {
  return <AgentsPage />;
}
