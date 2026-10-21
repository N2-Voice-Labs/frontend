"use client";

import { useEffect, useState } from "react";
import { applyTheme, currentTheme, readStoredTheme, storeTheme, systemTheme, type Theme } from "@/lib/theme";

/**
 * Reference behaviour on the shared theme system: system preference by default, the visitor's choice
 * saved in localStorage, `data-vl-theme` on <html> (set before paint by themeInitScript).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(currentTheme());
    if (readStoredTheme() || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredTheme()) return;
      const next = systemTheme();
      applyTheme(next);
      setTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    storeTheme(next);
    setTheme(next);
  };

  return (
    <button type="button" className="icon-btn" data-bare aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={toggle}>
      {/* The icon shows what a click does (moon → dark, sun → light). CSS picks it from data-vl-theme, so it
          is right from the first paint. */}
      <svg className="theme-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      <svg className="theme-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    </button>
  );
}
