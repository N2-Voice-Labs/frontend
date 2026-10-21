"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AgentForm } from "@/components/agent-form";
import { Agent, getAgent } from "@/lib/platform";

export default function EditAgent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAgent(id).then((result) => { if (active) setAgent(result); }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load agent");
    });
    return () => { active = false; };
  }, [id]);

  return <main className="page-shell dash-main">
    <Link className="dash-back" href={`/agents/${id}`}>← Back to agent</Link>
    <p className="eyebrow">Agents / Edit</p>
    <h1>Edit agent</h1>
    {!agent ? <p role={error ? "alert" : "status"}>{error || "Loading agent…"}</p> : <>
      <p className="page-intro">Update conversation behavior and provider choices.</p>
      <AgentForm key={agent.id} initialAgent={agent} onSaved={(saved) => router.push(`/agents/${saved.id}`)} />
    </>}
  </main>;
}
