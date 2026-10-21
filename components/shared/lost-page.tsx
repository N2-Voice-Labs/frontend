import "@/styles/legacy/not-found.css";

/** The "This page went quiet." 404 body, used by app/global-not-found.tsx and the dashboard area. */
export function LostPage() {
  return (
    <main className="lost">
      <div className="lost-orb" aria-hidden="true">
        <span className="lost-ring" /><span className="lost-ring" />
        <span className="lost-core">v<span>.</span></span>
      </div>
      <p className="lost-code">404</p>
      <h1>This page went quiet.</h1>
      <p className="lost-copy">The link may be old, or the agent or conversation you’re looking for no longer exists.</p>
      <div className="lost-actions">
        <a className="lost-primary" href="/">Back to home</a>
        <a className="lost-secondary" href="/agents">Open the workspace</a>
      </div>
    </main>
  );
}
