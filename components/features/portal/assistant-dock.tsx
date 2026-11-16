"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AssistantPanel, type AssistantHandle } from "./assistant-panel";
import { Mascot } from "./mascot";

/**
 * One assistant for every portal tab. It lives in the (student) layout, which Next keeps mounted while the
 * student moves between tabs, so a voice call or chat carries on across pages.
 *
 * Pages get the full width; the assistant is a drawer from the right (a bottom sheet on phones), opened from the
 * floating button, the Home page's call/chat buttons, or any "Ask" chip. Closing it only hides it: the panel is
 * never unmounted, so a call isn't cut, and the floating button turns into "Call in progress · Return".
 */
type AssistantApi = { ask: (question: string) => void; open: (tab?: "voice" | "chat") => void };

const AssistantContext = createContext<AssistantApi | null>(null);

/** `ask("…")` puts a question in the chat and brings the assistant into view. */
export function useAssistant(): AssistantApi {
  const api = useContext(AssistantContext);
  if (!api) throw new Error("useAssistant must be used inside <AssistantDock>");
  return api;
}

export function AssistantDock({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const panel = useRef<AssistantHandle>(null);
  const drawer = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);

  const show = useCallback((tab?: "voice" | "chat") => {
    if (tab) panel.current?.show(tab);
    setOpen(true);
  }, []);
  const ask = useCallback((question: string) => {
    setOpen(true);
    panel.current?.ask(question);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  }, []);
  const api = useMemo(() => ({ ask, open: show }), [ask, show]);

  // Moving to another tab closes the drawer; a running call carries on.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    drawer.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <AssistantContext.Provider value={api}>
      <div className="portal-shell" data-mode="drawer">
        <div className="portal-shell-main">{children}</div>
        <aside ref={drawer} tabIndex={-1} className="portal-dock" id="portal-assistant-dock" data-open={open} aria-label="Admissions assistant">
          <button type="button" className="portal-dock-close" onClick={close} aria-label="Close the assistant">×</button>
          <AssistantPanel ref={panel} onLiveChange={setLive} />
        </aside>
        {open && <div className="portal-dock-scrim" onClick={close} aria-hidden="true" />}
      </div>
      <button
        ref={launcher}
        type="button"
        className="portal-dock-fab"
        data-live={live}
        aria-controls="portal-assistant-dock"
        aria-expanded={open}
        onClick={() => show()}
        hidden={open}
      >
        <Mascot pose="headset" width={52} />
        <span>{live ? "Call in progress · Return" : "Ask the assistant"}</span>
      </button>
    </AssistantContext.Provider>
  );
}
