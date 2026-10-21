export type Theme = "light" | "dark";

export const THEME_KEY = "vl-theme";
export const THEME_ATTRIBUTE = "data-vl-theme";

export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice just won't persist.
  }
}

export function systemTheme(): Theme {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

/**
 * Runs from the root layout's <head> before first paint, so the page never flashes the wrong theme.
 * It lives in the root layout (never re-rendered on the client) because React does not execute scripts
 * it renders client-side. Mirrors the helpers above.
 */
export const themeInitScript = `(function(){try{var s=localStorage.getItem("${THEME_KEY}");var t=s==="dark"||s==="light"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("${THEME_ATTRIBUTE}",t)}catch(e){}})();`;
