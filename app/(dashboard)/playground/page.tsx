import { redirect } from "next/navigation";

/** `/playground?agent=<id>` (linked from the Agents page) opens that agent's Voice Playground. */
export default async function Playground({ searchParams }: { searchParams: Promise<{ agent?: string | string[] }> }) {
  const { agent } = await searchParams;
  const id = Array.isArray(agent) ? agent[0] : agent;
  redirect(id ? `/agents/${encodeURIComponent(id)}/test` : "/agents");
}
