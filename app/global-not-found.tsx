import type { Metadata } from "next";
import { LostPage } from "@/components/shared/lost-page";
import { siteFonts } from "@/lib/fonts/site";
import { themeInitScript } from "@/lib/theme";
import "@/styles/legacy/tokens.css";
import "@/styles/legacy/restyle.css";

export const metadata: Metadata = { title: "Page not found · Voice Labs" };

/**
 * 404 for any URL no route matches. The app has several root layouts, so this renders its own <html>.
 * restyle.css maps its stylesheet's font variables onto the site fonts.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={siteFonts} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body><LostPage /></body>
    </html>
  );
}
