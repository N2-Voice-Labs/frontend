"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Notice, SoonNote } from "@/components/features/workspace/ui";
import type { Capability } from "@/lib/capabilities";
import { describeError } from "@/lib/platform-errors";

export type AssignItem = { id: string; title: string; note: string; enabled: boolean };

type Props = {
  title: string;
  intro: string;
  items: AssignItem[] | null;
  assignedIds: string[] | null;
  loadError: string;
  save: (ids: string[]) => Promise<unknown>;
  manageHref: string;
  manageLabel: string;
  soon: Capability;
};

/** Checkboxes that replace an agent's whole set of tools or documents. Shared by both panels. */
export function AssignmentPanel({ title, intro, items, assignedIds, loadError, save, manageHref, manageLabel, soon }: Readonly<Props>) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (assignedIds) { setSelected(assignedIds); setSaved(assignedIds); }
  }, [assignedIds]);

  const dirty = selected.length !== saved.length || selected.some((id) => !saved.includes(id));
  const toggle = (id: string) => { setDone(false); setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id])); };

  async function commit() {
    setBusy(true);
    setError("");
    try {
      await save(selected);
      setSaved(selected);
      setDone(true);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel detail-panel detail-wide" aria-label={title}>
    <div className="ws-section-head"><h2>{title}</h2><Link className="mini-action" href={manageHref}>{manageLabel}</Link></div>
    <p className="muted">{intro}</p>
    {loadError ? <Notice tone="error">{loadError}</Notice>
      : !items ? <p role="status">Loading…</p>
      : items.length === 0 ? <Empty title={`No ${title.toLowerCase()} yet`} action={<Link className="mini-action primary" href={manageHref}>{manageLabel}</Link>}>Add some, then come back to choose which this agent can use.</Empty>
      : <>
        <div className="ws-checks">
          {items.map((item) => {
            const locked = !item.enabled && !selected.includes(item.id);
            return <label key={item.id} data-disabled={locked}>
              <input type="checkbox" checked={selected.includes(item.id)} disabled={locked} onChange={() => toggle(item.id)} />
              <span><strong>{item.title}</strong><small>{item.note}</small></span>
              {!item.enabled && <Badge>Disabled</Badge>}
            </label>;
          })}
        </div>
        <div className="ws-actions" style={{ marginTop: 14 }}>
          <button type="button" disabled={busy || !dirty} onClick={() => void commit()}>{busy ? "Saving…" : "Save selection"}</button>
          {done && !dirty && <span className="field-hint" role="status">Saved.</span>}
          {dirty && !busy && <span className="form-dirty">Unsaved changes</span>}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </>}
    <SoonNote capability={soon} />
  </section>;
}
