/**
 * Shareable call links.
 *
 * The link carries one thing: a random invitation code in the URL #fragment, which browsers never send
 * to a server and which never reaches access logs. /join strips it from the address bar as soon as it
 * has been read, then asks the Platform who invited the guest and for the guest's own connection
 * (`getCallInvite`, `joinCall` in lib/platform.ts). The code expires on the Platform (default 30 minutes)
 * and seats one guest; the LiveKit and session tokens are issued only when the guest joins.
 */

export type InviteCodeResult = { ok: true; code: string } | { ok: false; reason: "missing" | "incomplete" };

/** What the guest sees before joining (Platform `GET /calls/invites/{code}`). */
export type InviteInfo = {
  code: string;
  /** The inviter's display name (may be empty). */
  from: string;
  /** The guest's language (what they speak and hear). */
  me: string;
  /** The inviter's language. */
  them: string;
  /** Unix seconds after which the code stops working. */
  expiresAt: number;
};

/** Absolute link: `${origin}/join#c=<code>`. */
export function buildInviteLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/join#c=${encodeURIComponent(code)}`;
}

/** Parses `location.hash` (with or without the leading `#`). Never throws. */
export function parseInviteCode(hash: string): InviteCodeResult {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.trim()) return { ok: false, reason: "missing" };
  let code: string | null = null;
  try {
    code = new URLSearchParams(raw).get("c")?.trim() ?? null;
  } catch {
    return { ok: false, reason: "incomplete" };
  }
  // <session uuid>.<secret>: URL-safe characters only, bounded length.
  if (!code || code.length > 120 || !/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{16,}$/.test(code)) return { ok: false, reason: "incomplete" };
  return { ok: true, code };
}

/** Seconds left before the invite stops working (never negative). */
export function secondsLeft(expiresAt: number, nowMs = Date.now()): number {
  return Math.max(0, Math.floor(expiresAt - nowMs / 1000));
}

export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** Removes the fragment from the address bar (and history entry) without reloading. */
export function stripFragment(win: Pick<Window, "history" | "location"> = window) {
  const { pathname, search } = win.location;
  win.history.replaceState(win.history.state, "", `${pathname}${search}`);
}
