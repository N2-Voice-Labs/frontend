import { DM_Mono, DM_Sans, Manrope } from "next/font/google";

/**
 * Fonts for the workspace pages ported from the previous app (dashboard, call). Not preloaded: the bundler
 * merges font preloads across areas, and preloading these would delay the landing page's headline fonts.
 */
const display = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-display", display: "swap", preload: false });
// DM Sans has no Cyrillic. Without its metric-adjusted Arial fallback in --font-sans, Cyrillic text
// falls through to Manrope (second in --sans, styles/legacy/tokens.css) instead of to Arial.
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap", adjustFontFallback: false, preload: false });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap", preload: false });

export const legacyFonts = `${display.variable} ${sans.variable} ${mono.variable}`;
