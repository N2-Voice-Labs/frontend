"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { applyTheme, readStoredTheme, storeTheme, systemTheme, type Theme } from "./theme";

/**
 * Header switch. The icon is chosen by CSS from <html data-vl-theme>, so it never flickers;
 * state here only drives aria-checked. Follows the system until the visitor picks a theme.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Also covers client-side navigation, where the inline init script does not run again.
    const stored = readStoredTheme();
    const initial = stored ?? systemTheme();
    applyTheme(initial);
    setTheme(initial);
    if (stored || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      if (readStoredTheme()) return;
      const next: Theme = event.matches ? "dark" : "light";
      applyTheme(next);
      setTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const apply = () => {
      applyTheme(next);
      storeTheme(next);
      setTheme(next);
    };
    const doc = document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> } };
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!doc.startViewTransition || reduced) {
      // Fallback: plain colour fade.
      const root = document.querySelector(".marketing-root, .dash-root, .call-root");
      root?.classList.add("theme-transition");
      apply();
      window.setTimeout(() => root?.classList.remove("theme-transition"), 500);
      return;
    }

    // The new theme grows out of the button as an expanding circle (View Transitions API).
    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const html = document.documentElement;
    html.classList.add("theme-vt");
    const transition = doc.startViewTransition(apply);
    void transition.ready.then(() =>
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 800, easing: "cubic-bezier(.22, 1, .36, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    );
    void transition.finished.finally(() => html.classList.remove("theme-vt"));
  }

  return (
    <button className="theme-toggle" data-bare type="button" role="switch" aria-checked={theme === "dark"} aria-label="Dark theme" onClick={toggle}>
      <svg className="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      <svg className="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" /></svg>
    </button>
  );
}
