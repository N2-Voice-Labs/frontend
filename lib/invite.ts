/**
 * Guest invite links for two-person calls (UX spec §4.2–4.3).
 *
 * There is no join endpoint, so the link has to carry the guest's LiveKit token and session token.
 * Everything lives in the URL #fragment, which browsers never send to a server and which never
 * reaches access logs. /join strips it from the address bar as soon as it has been read.
 * LiveKit tokens live 10 minutes (backend livekit.py), so the link carries its own expiry.
 */

export const INVITE_VERSION = "1";
export const INVITE_TTL_SECONDS = 600;

export type Invite = {
  sessionId: string;
  conversationId: string;
  /** LiveKit server URL. */
  url: string;
  /** Guest LiveKit token. */
  token: string;
  /** Guest Platform session token (Bearer for transcript polling and End). */
  sessionToken: string;
  /** The guest's language (what they speak and hear). */
  me: string;
  /** The inviter's language. */
  them: string;
  /** The inviter's display name. */
  from: string;
  /** The guest's display name, as given by the inviter. */
  name: string;
  /** Unix seconds after which the LiveKit token no longer works. */
  expiresAt: number;
};

export type InviteParseResult =
  | { ok: true; invite: Invite }
  | { ok: false; reason: "missing" | "incomplete" | "unsupported"; from?: string };

const REQUIRED: [keyof Invite, string][] = [
  ["sessionId", "s"],
  ["conversationId", "c"],
  ["url", "u"],
  ["token", "t"],
  ["sessionToken", "k"],
  ["me", "me"],
  ["them", "them"],
];

export function buildInviteFragment(invite: Invite): string {
  const params = new URLSearchParams();
  params.set("v", INVITE_VERSION);
  params.set("s", invite.sessionId);
  params.set("c", invite.conversationId);
  params.set("u", invite.url);
  params.set("t", invite.token);
  params.set("k", invite.sessionToken);
  params.set("me", invite.me);
  params.set("them", invite.them);
  if (invite.from) params.set("from", invite.from);
  if (invite.name) params.set("name", invite.name);
  params.set("exp", String(invite.expiresAt));
  return params.toString();
}

/** Absolute link: `${origin}/join#…`. */
export function buildInviteLink(origin: string, invite: Invite): string {
  return `${origin.replace(/\/$/, "")}/join#${buildInviteFragment(invite)}`;
}

/** Parses `location.hash` (with or without the leading `#`). Never throws. */
export function parseInviteFragment(hash: string): InviteParseResult {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.trim()) return { ok: false, reason: "missing" };
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return { ok: false, reason: "incomplete" };
  }
  const from = (params.get("from") ?? "").trim().slice(0, 100) || undefined;
  const version = params.get("v");
  if (version && version !== INVITE_VERSION) return { ok: false, reason: "unsupported", from };
  const values: Partial<Record<keyof Invite, string>> = {};
  for (const [field, key] of REQUIRED) {
    const value = params.get(key)?.trim();
    if (!value) return { ok: false, reason: "incomplete", from };
    values[field] = value;
  }
  const expiresAt = Number(params.get("exp"));
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return { ok: false, reason: "incomplete", from };
  if (!/^wss?:\/\//i.test(values.url!) && !/^https?:\/\//i.test(values.url!)) return { ok: false, reason: "incomplete", from };
  if (values.me === values.them) return { ok: false, reason: "incomplete", from };
  return {
    ok: true,
    invite: {
      sessionId: values.sessionId!,
      conversationId: values.conversationId!,
      url: values.url!,
      token: values.token!,
      sessionToken: values.sessionToken!,
      me: values.me!.toLowerCase(),
      them: values.them!.toLowerCase(),
      from: from ?? "",
      name: (params.get("name") ?? "").trim().slice(0, 100),
      expiresAt,
    },
  };
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
