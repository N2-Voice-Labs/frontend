"use client";

import { useEffect, useState } from "react";
import { formatCountdown, secondsLeft } from "@/lib/invite";

export type InviteStage = "open" | "minute" | "expired";

export function inviteStage(expiresAt: number, nowMs = Date.now()): InviteStage {
  const left = secondsLeft(expiresAt, nowMs);
  return left <= 0 ? "expired" : left <= 60 ? "minute" : "open";
}

/**
 * The invite's coarse stage. The check runs every second, but state only changes at the 1-minute and
 * expiry boundaries, so the page holding it renders twice per invite instead of once per second
 * (performance review finding 5). Re-checked when the tab becomes visible (throttled timers).
 */
export function useInviteStage(expiresAt: number | null, active = true): InviteStage {
  const [stage, setStage] = useState<InviteStage>(() => (expiresAt === null ? "open" : inviteStage(expiresAt)));
  useEffect(() => {
    if (expiresAt === null || !active) return;
    const check = () => setStage(inviteStage(expiresAt));
    check();
    const timer = window.setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [expiresAt, active]);
  return expiresAt === null ? "open" : stage;
}

/** Leaf component: the only thing that re-renders every second is this text. */
export function InviteCountdown({ expiresAt }: { expiresAt: number }) {
  const [left, setLeft] = useState(() => secondsLeft(expiresAt));
  useEffect(() => {
    setLeft(secondsLeft(expiresAt));
    const timer = window.setInterval(() => setLeft(secondsLeft(expiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return <span className="tabular">{formatCountdown(left)}</span>;
}
