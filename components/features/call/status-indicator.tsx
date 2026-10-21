"use client";

import { useEffect, useRef, useState } from "react";
import type { StatusLine as StatusLineValue } from "@/lib/call-state";

/** Same message is not re-announced within this window (UX spec §8.2). */
export const ANNOUNCE_DEBOUNCE_MS = 5_000;

/**
 * The page's single `role="status"` region. It shows the current call-level message and is the only
 * place screen readers hear state changes. Speaking/listening flips never come through here.
 */
export function StatusLine({ status, extra }: { status: StatusLineValue; extra?: string }) {
  // Starts empty and fills after mount: a live region that is born with text is not reliably
  // announced (accessibility audit M2).
  const [spoken, setSpoken] = useState("");
  const lastSaid = useRef(new Map<string, number>());
  const message = extra ?? status.message;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = Date.now();
      // Any message spoken in the last 5 s is not repeated, even after A → B → A flapping (m8).
      if (message && now - (lastSaid.current.get(message) ?? -Infinity) < ANNOUNCE_DEBOUNCE_MS) return;
      if (message) lastSaid.current.set(message, now);
      setSpoken(message);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <p className="call-status" role="status" data-tone={status.tone} data-empty={spoken ? "false" : "true"}>
      {spoken}
    </p>
  );
}

/** Dot + word, or a chip (design system §3.16). The word is always present; the dot is decorative. */
export function StatusChip({ kind, children }: { kind: "live" | "ended" | "failed" | "waiting" | "soon" | "neutral"; children: React.ReactNode }) {
  return (
    <span className="status-chip" data-kind={kind}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
