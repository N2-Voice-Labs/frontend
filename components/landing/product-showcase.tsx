"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useState, type MouseEvent } from "react";
import { ShowcaseGallery } from "./showcase-gallery";
import { ShowcaseTranslate } from "./showcase-translate";
import { ShowcaseWorkflow } from "./showcase-workflow";

const TABS = [
  {
    id: "flow", label: "Workflow", path: "workflow",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  },
  {
    id: "agents", label: "Agent gallery", path: "agent-gallery",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" /></svg>,
  },
  {
    id: "translate", label: "Live translate", path: "live-translate",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 4-3 8-7 9" /><path d="M13 21l4-9 4 9M14.5 18h5" /></svg>,
  },
] as const;

/**
 * Segmented tabs (Radix: arrow keys, Home/End, roving focus) above an app window whose ← → buttons
 * step through the same tabs. Panels stay mounted so search, filters and the player keep their state.
 */
export function ProductShowcase() {
  const [tab, setTab] = useState<string>("flow");
  const index = TABS.findIndex((t) => t.id === tab);
  const step = (d: number) => setTab(TABS[(index + d + TABS.length) % TABS.length].id);

  // Radix focuses the trigger programmatically on mousedown, which shows the keyboard focus ring after a
  // mouse click. Select and focus here instead (preventDefault makes Radix skip its own handler).
  const selectByMouse = (e: MouseEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0 || e.ctrlKey) return;
    e.preventDefault();
    setTab(id);
    e.currentTarget.focus({ focusVisible: false } as FocusOptions);
  };

  return (
    <section id="workspace" className="sec alt showcase">
      <div className="dots" aria-hidden="true" />
      <Tabs.Root asChild value={tab} onValueChange={setTab}>
        <div className="wrap sc-wrap">
          <div className="head-row">
            <div className="head-col">
              <div className="mono">Product</div>
              <h2 className="h2">Everything a call needs. <em>One window.</em></h2>
            </div>
            <p className="lede" style={{ maxWidth: 360 }}>Build agents, hear them translate, and test them live — the same tools your team uses in the workspace.</p>
          </div>

          <Tabs.List className="seg" aria-label="Product areas">
            {TABS.map((t) => (
              <Tabs.Trigger key={t.id} value={t.id} className="seg-tab" onMouseDown={(e) => selectByMouse(e, t.id)}>{t.icon}{t.label}</Tabs.Trigger>
            ))}
          </Tabs.List>

          <div className="win">
            <div className="win-bar">
              <div className="win-left">
                <span className="win-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="mono sm win-path">voicelabs <span aria-hidden="true">/</span> <b>{TABS[index].path}</b></span>
              </div>
              <div className="win-right">
                <button type="button" className="kbd" aria-label="Previous area" onClick={() => step(-1)}>←</button>
                <button type="button" className="kbd" aria-label="Next area" onClick={() => step(1)}>→</button>
                <span className="mono sm win-switch">Switch</span>
              </div>
            </div>
            <Tabs.Content value="flow" className="panel" forceMount hidden={tab !== "flow"}><ShowcaseWorkflow /></Tabs.Content>
            <Tabs.Content value="agents" className="panel" forceMount hidden={tab !== "agents"}><ShowcaseGallery /></Tabs.Content>
            <Tabs.Content value="translate" className="panel" forceMount hidden={tab !== "translate"}><ShowcaseTranslate active={tab === "translate"} /></Tabs.Content>
          </div>
        </div>
      </Tabs.Root>
    </section>
  );
}
