import type { Metadata } from "next";
import { LostPage } from "@/components/shared/lost-page";
import { siteFonts } from "@/lib/fonts/site";
import { themeInitScript } from "@/lib/theme";
import "@/styles/legacy/tokens.css";

export const metadata: Metadata = { title: "Page not found · Voice Labs" };

/**
 * 404 for any URL no route matches. The app has several root layouts, so this renders its own <html>.
 * Next adds this file's fonts to every page's preloads, so it uses the site fonts (mapped onto the legacy
 * font variables its stylesheet reads) rather than declaring the previous app's fonts.
 */
const legacyFontVars = { "--font-display": "var(--font-manrope)", "--font-sans": "var(--font-manrope)", "--font-mono": "var(--font-dm-mono)" } as React.CSSProperties;
export default function GlobalNotFound() {
  return (
    <html lang="en" className={siteFonts} style={legacyFontVars} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body><LostPage /></body>
    </html>
  );
}
