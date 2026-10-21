"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { VoicePreview } from "@/components/features/voices/voice-preview";
import { Badge, Empty, Notice, PageHead, SoonNote } from "@/components/features/workspace/ui";
import { describeError } from "@/lib/platform-errors";
import { getAgents } from "@/lib/platform";
import { styleSummary, voiceSourceLabel, voiceStatusInfo, isWaiting } from "@/lib/voice-view";
import { languageName } from "@/lib/languages";
import { useResource } from "@/lib/use-resource";
import { getVoices, setVoiceStatus, voiceActions, type Voice, type VoiceSource, type VoiceStatus } from "@/lib/voices";

const statuses: VoiceStatus[] = ["ready", "pending", "processing", "failed", "disabled"];
const sources: VoiceSource[] = ["library", "clone", "design"];
const loadVoices = () => getVoices();

export default function Voices() {
  const voices = useResource(loadVoices, { interval: 10000 });
  const agents = useResource(getAgents);
  const [status, setStatus] = useState<VoiceStatus | "all">("all");
  const [source, setSource] = useState<VoiceSource | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const all = voices.data ?? [];
  const shown = useMemo(() => all.filter((voice) => (status === "all" || voice.status === status) && (source === "all" || voice.source === source)), [all, status, source]);
  const usedBy = (voice: Voice) => agents.data?.filter((agent) => agent.voice_profile_id === voice.id).length ?? null;
  const counts = (key: "status" | "source") => (value: string) => all.filter((voice) => voice[key] === value).length;
  const waiting = all.some(isWaiting);

  async function move(voice: Voice) {
    const action = voiceActions[voice.status];
    if (!action) return;
    setBusy(voice.id);
    setActionError("");
    try {
      await setVoiceStatus(voice.id, action.to);
      await voices.reload();
    } catch (cause) {
      setActionError(describeError(cause));
    } finally {
      setBusy(null);
    }
  }

  return <main className="page-shell dash-main">
    <PageHead eyebrow="Workspace / Voices" title="Voices" intro="One library of voices, shared by every agent. Pick a voice on an agent, or clone or design a new one."
      action={<div className="ws-actions"><Link className="mini-action" href="/voices/design">Design a voice</Link><Link className="button-link button-dark" href="/voices/clone">Clone a voice <span aria-hidden="true">+</span></Link></div>} />

    {voices.error && <Notice tone="error">Could not load voices: {voices.error}</Notice>}
    {actionError && <Notice tone="error">{actionError}</Notice>}

    <div className="ws-toolbar" role="group" aria-label="Filter by status">
      <button className={status === "all" ? "chip is-active" : "chip"} data-bare type="button" aria-pressed={status === "all"} onClick={() => setStatus("all")}>All <b>{all.length}</b></button>
      {statuses.map((value) => <button key={value} className={status === value ? "chip is-active" : "chip"} data-bare type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{voiceStatusInfo[value].label} <b>{counts("status")(value)}</b></button>)}
    </div>
    <div className="ws-toolbar" role="group" aria-label="Filter by source">
      <button className={source === "all" ? "chip is-active" : "chip"} data-bare type="button" aria-pressed={source === "all"} onClick={() => setSource("all")}>Any source</button>
      {sources.map((value) => <button key={value} className={source === value ? "chip is-active" : "chip"} data-bare type="button" aria-pressed={source === value} onClick={() => setSource(value)}>{voiceSourceLabel[value]} <b>{counts("source")(value)}</b></button>)}
    </div>

    {voices.loading ? <p role="status">Loading voices…</p> : all.length === 0 && !voices.error ? (
      <Empty title="No voices yet" action={<Link className="mini-action primary" href="/voices/clone">Clone a voice</Link>}>Add a voice to the library, then choose it on an agent.</Empty>
    ) : shown.length === 0 ? <p className="muted">No voices match these filters.</p> : (
      <ul className="ws-grid">
        {shown.map((voice) => {
          const info = voiceStatusInfo[voice.status];
          const action = voiceActions[voice.status];
          const agentCount = usedBy(voice);
          const summary = styleSummary(voice.style);
          return <li className="ws-card" key={voice.id}>
            <div className="ws-card-top"><h2>{voice.name}</h2><Badge tone={info.tone} title={info.hint}>{info.label}</Badge></div>
            <ul className="ws-meta">
              <li>{voiceSourceLabel[voice.source]}</li>
              <li>{voice.languages.map(languageName).join(" · ")}</li>
              {agentCount !== null && <li><b>{agentCount}</b> {agentCount === 1 ? "agent" : "agents"}</li>}
            </ul>
            {voice.design_prompt && <p>“{voice.design_prompt}”</p>}
            {summary && <p>{summary}</p>}
            {isWaiting(voice) && <p>{info.hint}</p>}
            {voice.status === "failed" && <p>{voice.failure_reason || info.hint}</p>}
            <div className="ws-card-foot">
              <VoicePreview voiceId={voice.id} disabled={voice.status !== "ready"} />
              {action && <button data-bare className="mini-action" type="button" disabled={busy === voice.id} onClick={() => void move(voice)}>{action.label}</button>}
            </div>
          </li>;
        })}
      </ul>
    )}
    {waiting && <SoonNote capability="providerCloning" />}
  </main>;
}
