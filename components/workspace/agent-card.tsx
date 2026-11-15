import { TickIcon } from "@/components/shared/tick-icon";
import { Waveform } from "@/components/shared/waveform";
import type { AgentView } from "@/lib/agents/view";
import { ROUTES } from "@/lib/landing/config";

export const PLAY_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
export const PHONE_ICON = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>;

/** A small colour dot per language (Inha palette: KO sky blue, EN blue, RU gold; others neutral). Decorative. */
export function LangDot({ lang }: { lang: string }) {
  return <i className="lang-dot" data-lang={lang} aria-hidden="true" />;
}

/** One of three Inha accents per agent, stable for its id: the avatar dial's colour. */
export function agentTone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (["blue", "sky", "gold"] as const)[Math.abs(h) % 3];
}

/** Agent card. The name is the select button; its ::before covers the card, so the whole card selects. */
export function AgentCard({ agent, n, selected, onSelect }: { agent: AgentView; n: number; selected: boolean; onSelect: () => void }) {
  return (
    <article className="ag" aria-current={selected} data-tone={agentTone(agent.id)}>
      <div className="ag-head">
        <span className="ag-avatar"><TickIcon letter={agent.name.charAt(0).toUpperCase()} size={44} /></span>
        <span className={agent.ready ? "status" : "status draft"}><i />{agent.statusLabel}</span>
        <span className="ag-actions">
          <a className="round-btn" href={ROUTES.callWith(agent.id)} aria-label={`Call ${agent.name}`} title="Start a call">{PHONE_ICON}</a>
          <a className="round-btn round-btn-primary" href={ROUTES.playgroundFor(agent.id)} aria-label={`Test ${agent.name} in the playground`} title="Test in the playground">{PLAY_ICON}</a>
        </span>
      </div>
      <div className="ag-name">
        <h3><button type="button" className="ag-select" aria-pressed={selected} onClick={onSelect}>{agent.name}</button></h3>
        <p className="ag-purpose">{agent.purpose}</p>
      </div>
      <div className="ag-meta">
        <span className="tag" data-kind={agent.kind}>{agent.kind === "interpreter" ? "Interpreter" : "Agent"}</span>
        <span className="ag-voice" title="Voice">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" /></svg>
          {agent.voice}
        </span>
      </div>
      <Waveform seed={n * 7} n={44} max={22} className="ag-wave" />
      <div className="ag-foot">
        <span className="langs">{agent.langs.map((l) => <span key={l}><LangDot lang={l} />{l}</span>)}</span>
        <span className="mono sm ag-updated">{agent.updated ? agent.updated : `#${String(n).padStart(2, "0")}`}</span>
      </div>
    </article>
  );
}
