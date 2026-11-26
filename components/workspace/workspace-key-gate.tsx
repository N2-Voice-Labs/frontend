"use client";

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { getAgents } from "@/lib/platform";
import { storeWorkspaceKey, WORKSPACE_KEY_REJECTED } from "@/lib/workspace-key";

type Phase = "checking" | "locked" | "open";

const isAuthError = (error: unknown) => (error as { status?: number })?.status === 401;

/**
 * Keeps the workspace behind a Platform API key on a Platform with auth turned on.
 * It first tries the Platform as it is (with the key already in this tab, or none): if that works,
 * for example on a local Platform with auth disabled, nobody is asked for anything.
 */
export function WorkspaceKeyGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  const probe = useCallback(async (): Promise<"ok" | "auth" | "down"> => {
    try {
      await getAgents();
      return "ok";
    } catch (e) {
      return isAuthError(e) ? "auth" : "down";
    }
  }, []);

  useEffect(() => {
    let current = true;
    // Anything but a 401 (Platform down, network) still opens the page, which shows its own error.
    probe().then((result) => { if (current) setPhase(result === "auth" ? "locked" : "open"); });
    const onRejected = () => { setPhase("locked"); setError("That key no longer works. Enter it again."); };
    window.addEventListener(WORKSPACE_KEY_REJECTED, onRejected);
    return () => { current = false; window.removeEventListener(WORKSPACE_KEY_REJECTED, onRejected); };
  }, [probe]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const key = value.trim();
    if (!key) return;
    setBusy(true);
    setError("");
    storeWorkspaceKey(key);
    const result = await probe();
    setBusy(false);
    if (result === "auth") {
      storeWorkspaceKey(null);
      setError("The Platform did not accept this key.");
      return;
    }
    setValue("");
    setPhase("open");
  }

  if (phase === "open") return <>{children}</>;
  if (phase === "checking") return <main className="key-gate" aria-busy="true" />;
  return (
    <main className="key-gate">
      <form className="key-gate-card" onSubmit={submit}>
        <span className="mono key-gate-crumb">Workspace</span>
        <h1>Enter your workspace key</h1>
        <p>The workspace manages agents, voices and calls, so it needs a Platform API key. The key stays in this browser tab only.</p>
        <label htmlFor={inputId} className="key-gate-label">Platform API key</label>
        <input
          id={inputId}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste the key"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        {error && <p id={`${inputId}-error`} className="key-gate-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>{busy ? "Checking…" : "Open workspace"}</button>
      </form>
    </main>
  );
}

