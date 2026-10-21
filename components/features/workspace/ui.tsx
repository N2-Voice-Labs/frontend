import type { ReactNode } from "react";
import { comingSoon, isEnabled, type Capability } from "@/lib/capabilities";
import type { Tone } from "@/lib/outcomes";

export function PageHead({ eyebrow, title, intro, action }: Readonly<{ eyebrow: string; title: string; intro?: ReactNode; action?: ReactNode }>) {
  return <div className="dash-head">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {intro && <p className="page-intro">{intro}</p>}
    </div>
    {action}
  </div>;
}

export function Badge({ tone = "neutral", title, children }: Readonly<{ tone?: Tone; title?: string; children: ReactNode }>) {
  return <span className="badge" data-tone={tone} title={title}>{children}</span>;
}

/** A small "Coming soon" label for a feature the Platform stores but does not run yet (lib/capabilities.ts). */
export function Soon({ capability }: Readonly<{ capability: Capability }>) {
  if (isEnabled(capability)) return null;
  return <span className="soon" title={comingSoon[capability].note}>Coming soon</span>;
}

/** The label plus one plain sentence on what is missing. Renders nothing once the capability is on. */
export function SoonNote({ capability }: Readonly<{ capability: Capability }>) {
  if (isEnabled(capability)) return null;
  const copy = comingSoon[capability];
  return <p className="soon-note"><span className="soon">Coming soon</span><span><strong>{copy.title}.</strong> {copy.note}</span></p>;
}

export function Notice({ tone = "info", children }: Readonly<{ tone?: "info" | "error"; children: ReactNode }>) {
  return <p className="notice" data-tone={tone} role={tone === "error" ? "alert" : undefined}>{children}</p>;
}

export function Empty({ title, children, action }: Readonly<{ title: string; children?: ReactNode; action?: ReactNode }>) {
  return <div className="dash-empty ws-empty"><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "—");
