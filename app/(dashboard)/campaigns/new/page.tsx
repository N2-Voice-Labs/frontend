"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CampaignForm } from "@/components/features/campaigns/campaign-form";
import { PageHead } from "@/components/features/workspace/ui";

export default function NewCampaign() {
  const router = useRouter();
  return <main className="page-shell dash-main">
    <Link className="dash-back" href="/campaigns">← Campaigns</Link>
    <PageHead eyebrow="Campaigns / New" title="New campaign" intro="Choose the agent and phone line, and an optional schedule. Numbers come next." />
    <CampaignForm onCreated={(campaign) => router.push(`/campaigns/${campaign.id}`)} />
  </main>;
}
