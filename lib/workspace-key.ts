/**
 * The workspace key: a Platform API key someone types into the workspace (/agents, /voices, ...).
 * It stays in this browser tab only (sessionStorage), like the staff key in /inha/staff, and
 * `request()` sends it as `Authorization: Bearer <key>` on calls that carry no other token.
 */
const STORAGE = "workspace-platform-key";
/** Fired on window when the Platform rejects the stored key, so the gate can ask again. */
export const WORKSPACE_KEY_REJECTED = "workspace-key-rejected";

export function readWorkspaceKey(): string {
  try {
    return typeof window === "undefined" ? "" : window.sessionStorage.getItem(STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function storeWorkspaceKey(value: string | null): void {
  try {
    if (value) window.sessionStorage.setItem(STORAGE, value);
    else window.sessionStorage.removeItem(STORAGE);
  } catch {
    /* storage blocked: the key is not kept */
  }
}

/** Forget the key and tell the gate, after the Platform answered 401 to it. */
export function rejectWorkspaceKey(): void {
  storeWorkspaceKey(null);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WORKSPACE_KEY_REJECTED));
}
