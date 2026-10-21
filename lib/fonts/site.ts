import { DM_Mono, Instrument_Serif, Manrope } from "next/font/google";

/*
 * Fonts for the new design (landing, /agents). Only the two headline fonts are preloaded, so they win the
 * race on first load and the headline does not jump; next/font's metric-matched fallbacks cover the rest.
 * Keep this module separate from ./legacy: next/font preloads every font declared in an imported module.
 */
const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
// Small mono labels: not preloaded.
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap", preload: false });
// Korean uses the system faces (--font-kr in app/tokens.css), not a web font: Noto Sans KR through next/font
// adds 372 render-blocking @font-face rules (~80 KB gzipped) to every page and delayed first paint by ~1.4 s.

export const siteFonts = `${manrope.variable} ${mono.variable} ${serif.variable}`;
