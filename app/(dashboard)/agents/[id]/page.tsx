import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentKnowledgePanel } from "@/components/features/agents/agent-knowledge-panel";
import { AgentOrb } from "@/components/features/agents/agent-orb";
import { AgentToolsPanel } from "@/components/features/agents/agent-tools-panel";
import { DeploymentsPanel } from "@/components/features/agents/deployments-panel";
import { agentHue, isLiveStatus, languageLabel, relativeTime, statusLabel } from "@/lib/agent-view";
import { getAgent, getConversations, type Conversation } from "@/lib/platform";
import { getVoice } from "@/lib/voices";

export default async function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const agent = await getAgent(id);
    const now = Date.now();
    const conversations: Conversation[] | null = await getConversations().then((all) => all.filter((item) => item.agent_id === id).toSorted((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))).catch(() => null);
    // The shared voice is best-effort: the page still renders if the voice cannot be loaded.
    const voice = agent.voice_profile_id ? await getVoice(agent.voice_profile_id).catch(() => null) : null;
    const providers = [
      { label: "Speech-to-text", short: "STT", value: agent.stt_provider_id },
      { label: "Language model", short: "LLM", value: agent.llm_provider_id },
      { label: "Text-to-speech", short: "TTS", value: agent.tts_provider_id },
    ];

    return <main className="page-shell dash-main">
      <Link className="dash-back" href="/agents">← All agents</Link>
      <section className="agent-hero" style={{ "--hue": agentHue(agent.id || agent.name) } as React.CSSProperties}>
        <AgentOrb hue={agentHue(agent.id || agent.name)} size={96} />
        <div className="agent-hero-body">
          <p className="eyebrow">Agent</p>
          <h1>{agent.name}</h1>
          <p className="page-intro">{agent.description || "No description provided."}</p>
          <div className="agent-meta">
            <span className={isLiveStatus(agent.status) ? "agent-status is-live" : "agent-status"}><i />{statusLabel(agent.status)}</span>
            {agent.enabled_languages.map((language) => <span className="lang-chip" key={language}>{languageLabel(language)}</span>)}
          </div>
        </div>
        <div className="agent-hero-actions">
          <Link className="button-link button-dark" href={`/agents/${id}/test`}>Talk to this agent <span aria-hidden="true">↗</span></Link>
          <Link className="mini-action" href={`/agents/${id}/edit`}>Edit agent</Link>
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel detail-panel" aria-labelledby="config-title">
          <h2 id="config-title">Configuration</h2>
          <ul className="spec-list">
            <li><strong>Status:</strong> <span>{agent.status}</span></li>
            <li><strong>Languages:</strong> <span>{agent.enabled_languages.join(", ") || "None"}</span></li>
            {providers.map((provider) => (
              <li key={provider.short}><strong>{provider.short}:</strong> <span>{provider.value ?? "Runtime default"}</span><i className={provider.value ? "is-custom" : ""} title={provider.value ? `Custom ${provider.label.toLowerCase()} provider` : `Runtime default for ${provider.label.toLowerCase()}`} /></li>
            ))}
            <li><strong>Voice:</strong> <span>{voice ? <Link href="/voices">{voice.name}</Link> : agent.voice_profile_id ? "Selected voice" : "Default voice"}</span></li>
            {agent.voice_id && <li><strong>Voice ID:</strong> <span>{agent.voice_id}</span></li>}
          </ul>
        </section>

        <section className="panel detail-panel" aria-labelledby="recent-title">
          <h2 id="recent-title">Recent conversations</h2>
          {conversations === null ? <p className="muted">Conversation history is unavailable right now.</p>
            : conversations.length === 0 ? <p className="muted">No conversations yet. <Link href={`/agents/${id}/test`}>Start one</Link> to see it here.</p>
            : <ul className="recent-list">{conversations.slice(0, 5).map((item) => (
              <li key={item.id}><Link href={`/conversations/${item.id}`}>Conversation {item.id.slice(0, 8)}</Link><span>{item.status} · {relativeTime(item.started_at, now)}</span></li>
            ))}</ul>}
        </section>

        <DeploymentsPanel agentId={id} />
        <AgentToolsPanel agentId={id} />
        <AgentKnowledgePanel agentId={id} />

        <section className="panel detail-panel detail-wide" aria-labelledby="prompt-title">
          <h2 id="prompt-title">System prompt</h2>
          {agent.system_prompt
            ? <details className="prompt-block"><summary>{agent.system_prompt.split("\n")[0].slice(0, 140)}<span aria-hidden="true">Show all</span></summary><pre>{agent.system_prompt}</pre></details>
            : <p className="muted">No system prompt set. The runtime default applies.</p>}
        </section>
      </div>
    </main>;
  } catch {
    notFound();
  }
}
