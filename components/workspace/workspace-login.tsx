"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

type Phase = "checking" | "signed-out" | "not-configured" | "open";

const MESSAGES: Record<number, string> = {
  401: "Wrong password.",
  429: "Too many tries. Wait a minute and try again.",
  503: "The workspace password is not set up yet.",
};

/**
 * The workspace login screen. The real check is on the server: /api/platform refuses requests without
 * a valid session cookie (lib/workspace-auth.ts). This only asks for the password and sets the cookie.
 */
export function WorkspaceLogin({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  useEffect(() => {
    let current = true;
    fetch("/api/workspace/login", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ signedIn?: boolean; configured?: boolean }>)
      .then((s) => { if (current) setPhase(s.signedIn ? "open" : s.configured === false ? "not-configured" : "signed-out"); })
      .catch(() => { if (current) setPhase("signed-out"); });
    return () => { current = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPassword("");
        setPhase("open");
        return;
      }
      setError(MESSAGES[res.status] ?? "Could not sign in. Try again.");
    } catch {
      setError("Could not sign in. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "open") return <>{children}</>;
  if (phase === "checking") return <main className="key-gate" aria-busy="true" />;
  return (
    <main className="key-gate">
      <form className="key-gate-card" onSubmit={submit}>
        <span className="mono key-gate-crumb">Workspace</span>
        <h1>Sign in</h1>
        {phase === "not-configured" ? (
          <p>The workspace password is not set up yet. Add the WORKSPACE_PASSWORD secret to the site.</p>
        ) : (
          <>
            <p>Enter the team password to manage agents, voices and calls.</p>
            <label htmlFor={inputId} className="key-gate-label">Password</label>
            <input
              id={inputId}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
            {error && <p id={`${inputId}-error`} className="key-gate-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy || !password}>{busy ? "Signing in…" : "Sign in"}</button>
          </>
        )}
      </form>
    </main>
  );
}
