"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { getAgents, type Agent } from "@/lib/platform";

export const OPEN_PALETTE_EVENT = "voice-labs:open-palette";

type Item = { id: string; label: string; hint: string; group: string; href: string };

const goTo: Item[] = [
  { id: "call", label: "Start a call", hint: "Call", group: "Go to", href: "/call" },
  { id: "new", label: "New agent", hint: "Create", group: "Go to", href: "/agents/new" },
  { id: "agents", label: "Agents", hint: "Page", group: "Go to", href: "/agents" },
  { id: "voices", label: "Voices", hint: "Page", group: "Go to", href: "/voices" },
  { id: "clone", label: "Clone a voice", hint: "Create", group: "Go to", href: "/voices/clone" },
  { id: "design", label: "Design a voice", hint: "Create", group: "Go to", href: "/voices/design" },
  { id: "conversations", label: "Conversations", hint: "Page", group: "Go to", href: "/conversations" },
  { id: "campaigns", label: "Campaigns", hint: "Page", group: "Go to", href: "/campaigns" },
  { id: "knowledge", label: "Knowledge", hint: "Page", group: "Go to", href: "/knowledge" },
  { id: "tools", label: "Tools", hint: "Page", group: "Go to", href: "/tools" },
  { id: "analytics", label: "Usage", hint: "Analytics", group: "Go to", href: "/usage" },
  { id: "site", label: "Home", hint: "Public site", group: "Go to", href: "/" },
];

/** ⌘K / Ctrl+K: jump to any page or agent, talk to it, or edit it. Native <dialog> for focus and Esc. */
export function CommandPalette() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const loaded = useRef(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState("");

  const show = useCallback(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    setQuery("");
    setActive(0);
    element.showModal();
    if (loaded.current) return;
    loaded.current = true;
    getAgents().then(setAgents).catch((cause: unknown) => {
      loaded.current = false;
      setError(cause instanceof Error ? cause.message : "Agents are unavailable.");
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else show();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, show);
    };
  }, [show]);

  const items = useMemo(() => {
    const agentItems: Item[] = (agents ?? []).flatMap((agent) => [
      { id: `talk-${agent.id}`, label: `Talk to ${agent.name}`, hint: "Playground", group: "Agents", href: `/agents/${agent.id}/test` },
      { id: `open-${agent.id}`, label: `Open ${agent.name}`, hint: "Details", group: "Agents", href: `/agents/${agent.id}` },
      { id: `edit-${agent.id}`, label: `Edit ${agent.name}`, hint: "Edit", group: "Agents", href: `/agents/${agent.id}/edit` },
    ]);
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return [...goTo, ...agentItems].filter((item) => words.every((word) => item.label.toLowerCase().includes(word)));
  }, [agents, query]);
  const selected = Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => {
    list.current?.querySelector("[aria-selected='true']")?.scrollIntoView?.({ block: "nearest" });
  }, [selected, items]);

  function run(item: Item | undefined) {
    if (!item) return;
    dialog.current?.close();
    router.push(item.href);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(items.length ? (selected + 1) % items.length : 0); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(items.length ? (selected - 1 + items.length) % items.length : 0); }
    else if (event.key === "Enter") { event.preventDefault(); run(items[selected]); }
  }

  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialog.current) dialog.current?.close();
  }

  let lastGroup = "";
  return (
    <dialog className="palette" ref={dialog} aria-label="Command palette" onClick={onBackdropClick}>
      <div className="palette-search">
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[selected] ? `palette-${items[selected].id}` : undefined}
          aria-label="Search agents and pages"
          placeholder="Search agents and pages…"
          value={query}
          autoComplete="off"
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={onInputKeyDown}
        />
        <kbd>esc</kbd>
      </div>
      <ul className="palette-list" id="palette-list" role="listbox" aria-label="Results" ref={list}>
        {items.map((item, index) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <li key={item.id} role="presentation">
              {header && <p className="palette-group" role="presentation">{header}</p>}
              <div id={`palette-${item.id}`} role="option" aria-selected={index === selected} className="palette-item" onMouseMove={() => setActive(index)} onClick={() => run(item)}>
                <span>{item.label}</span><em>{item.hint}</em>
              </div>
            </li>
          );
        })}
        {items.length === 0 && <li className="palette-empty" role="presentation">Nothing matches “{query}”.</li>}
      </ul>
      {agents === null && !error && <p className="palette-note" role="status">Loading agents…</p>}
      {error && <p className="palette-note" role="status">Agents unavailable: {error}. Pages still work.</p>}
      <div className="palette-foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
    </dialog>
  );
}
