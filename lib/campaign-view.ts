import type { Tone } from "./outcomes";
import type { CampaignStatus } from "./campaigns";

export const campaignStatusInfo: Record<CampaignStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "warn" },
  running: { label: "Running", tone: "good" },
  paused: { label: "Paused", tone: "warn" },
  completed: { label: "Completed", tone: "good" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Button text for moving a campaign to a status. */
export const campaignMoveLabel: Record<CampaignStatus, string> = {
  draft: "Back to draft",
  scheduled: "Schedule",
  running: "Start",
  paused: "Pause",
  completed: "Mark completed",
  cancelled: "Cancel campaign",
};

/** `<input type="datetime-local">` value (local time) for an ISO timestamp, and back. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export const fromLocalInput = (value: string): string | null => (value ? new Date(value).toISOString() : null);
