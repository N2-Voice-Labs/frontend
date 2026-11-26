/**
 * Workspace login, server side only (app/api route handlers). One team password, the WORKSPACE_PASSWORD
 * secret. A correct password gets an HttpOnly cookie `<expiry>.<HMAC of the expiry>`, keyed by the
 * password, so changing the password signs everyone out. Without WORKSPACE_PASSWORD the workspace is
 * locked in production and open in local development.
 */
export const SESSION_COOKIE = "ws_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

export function workspacePassword(): string {
  return process.env.WORKSPACE_PASSWORD ?? "";
}

/** No password configured: open for `next dev`, locked anywhere else. */
export const loginDisabled = () => !workspacePassword() && process.env.NODE_ENV !== "production";

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return Array.from(signature, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings in time that depends only on their length. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks a typed password. Both sides are hashed first, so the comparison never leaks the length. */
export async function passwordMatches(typed: string): Promise<boolean> {
  const password = workspacePassword();
  if (!password || !typed) return false;
  return sameText(await hmac("workspace-login", typed), await hmac("workspace-login", password));
}

export async function createSession(now = Date.now()): Promise<string> {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${expires}.${await hmac(workspacePassword(), `workspace:${expires}`)}`;
}

function cookieValue(request: Request): string {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return "";
}

/** True when the request may use the workspace: a valid, unexpired session cookie (or login disabled). */
export async function isSignedIn(request: Request, now = Date.now()): Promise<boolean> {
  if (loginDisabled()) return true;
  const password = workspacePassword();
  if (!password) return false;
  const [expires, signature] = cookieValue(request).split(".");
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) * 1000 <= now) return false;
  return sameText(signature, await hmac(password, `workspace:${expires}`));
}

export function sessionCookie(value: string, maxAge = SESSION_SECONDS): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
