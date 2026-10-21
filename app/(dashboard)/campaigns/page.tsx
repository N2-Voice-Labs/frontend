"use client";

import Link from "next/link";
import { Badge, Empty, Notice, PageHead, SoonNote, formatDate } from "@/components/features/workspace/ui";
import { campaignStatusInfo } from "@/lib/campaign-view";
import { getCampaigns } from "@/lib/campaigns";
import { getAgents } from "@/lib/platform";
import { useResource } from "@/lib/use-resource";

export default function Campaigns() {
  const campaigns = useResource(getCampaigns, { interval: 10000 });
  const agents = useResource(getAgents);
  const names = Object.fromEntries((agents.data ?? []).map((agent) => [agent.id, agent.name]));
  const list = (campaigns.data ?? []).toSorted((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return <main className="page-shell dash-main">
    <PageHead eyebrow="Workspace / Campaigns" title="Campaigns" intro="Outbound call lists for an agent: add numbers, set a schedule, then start, pause or cancel."
      action={<Link className="button-link button-dark" href="/campaigns/new">New campaign <span aria-hidden="true">+</span></Link>} />
    {campaigns.error && <Notice tone="error">Could not load campaigns: {campaigns.error}</Notice>}
    {campaigns.loading ? <p role="status">Loading campaigns…</p> : list.length === 0 && !campaigns.error ? (
      <Empty title="No campaigns yet" action={<Link className="mini-action primary" href="/campaigns/new">Create a campaign</Link>}>A campaign needs an agent with a phone (SIP) deployment.</Empty>
    ) : (
      <ul className="ws-grid">
        {list.map((campaign) => {
          const info = campaignStatusInfo[campaign.status];
          return <li className="ws-card" key={campaign.id}>
            <div className="ws-card-top"><h2><Link className="ws-link" href={`/campaigns/${campaign.id}`}>{campaign.name}</Link></h2><Badge tone={info.tone}>{info.label}</Badge></div>
            <ul className="ws-meta">
              <li>Agent: <b>{names[campaign.agent_id] ?? campaign.agent_id.slice(0, 8)}</b></li>
              <li>{campaign.max_attempts} {campaign.max_attempts === 1 ? "attempt" : "attempts"} per number</li>
            </ul>
            <p>{campaign.schedule_start ? `Starts ${formatDate(campaign.schedule_start)}` : "No start time set"}{campaign.schedule_end ? ` · ends ${formatDate(campaign.schedule_end)}` : ""}</p>
            <div className="ws-card-foot"><Link className="mini-action" href={`/campaigns/${campaign.id}`}>Open</Link></div>
          </li>;
        })}
      </ul>
    )}
    <SoonNote capability="sipDialing" />
  </main>;
}
