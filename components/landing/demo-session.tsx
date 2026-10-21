"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { DemoSession } from "@/lib/demo/session-store";

const DemoSessionContext = createContext<DemoSession | null>(null);

/** Owns the page's single demo session. Disconnects on pagehide and on unmount. */
export function DemoSessionProvider({ children, session }: { children: ReactNode; session?: DemoSession }) {
  const [store] = useState(() => session ?? new DemoSession());
  useEffect(() => {
    const end = () => store.stop();
    window.addEventListener("pagehide", end);
    return () => {
      window.removeEventListener("pagehide", end);
      end();
    };
  }, [store]);
  return <DemoSessionContext.Provider value={store}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  const store = useContext(DemoSessionContext);
  if (!store) throw new Error("useDemoSession must be used inside <DemoSessionProvider>");
  return store;
}

export function useDemoSnapshot() {
  const store = useDemoSession();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * Links that also start the demo ("Speak to it" in the hero, nav, showcase and closing section). They stay real anchors to #top,
 * so the orb scrolls into view, and start a session if none is running.
 */
export function SpeakShortcut({ className, children }: { className: string; children: ReactNode }) {
  const store = useDemoSession();
  return <a href="#top" className={className} onClick={() => store.start()}>{children}</a>;
}
