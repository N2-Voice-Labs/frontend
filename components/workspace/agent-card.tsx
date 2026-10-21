import { Waveform } from "@/components/shared/waveform";
import type { AgentView } from "@/lib/agents/view";
import { ROUTES } from "@/lib/landing/config";

export const PLAY_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;

/** Agent card. The name is the select button; its ::before covers the card, so the whole card selects. */
export function AgentCard({ agent, n, selected, onSelect }: { agent: AgentView; n: number; selected: boolean; onSelect: () => void }) {
  return (
    <article className="ag" aria-current={selected}>
      <div className="ag-head">
        <span className="mono sm">{String(n).padStart(2, "0")}</span>
        <span className="nav-left">
          <span className={agent.ready ? "status" : "status draft"}><i />{agent.statusLabel}</span>
          <a className="round-btn" href={ROUTES.playgroundFor(agent.id)} aria-label={`Test ${agent.name} in the playground`}>{PLAY_ICON}</a>
        </span>
      </div>
      <div className="ag-name">
        <h3><button type="button" className="ag-select" aria-pressed={selected} onClick={onSelect}>{agent.name}</button></h3>
        <span className="mono sm">{agent.purpose}</span>
      </div>
      <div className="ag-foot">
        <Waveform seed={n * 7} n={40} max={22} />
        <span className="langs">{agent.langs.map((l) => <span key={l}>{l}</span>)}</span>
      </div>
    </article>
  );
}
