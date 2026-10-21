import { themeInitScript } from "@/lib/theme";

/**
 * <html> for each root layout. The app has one root layout per area (landing, new workspace pages,
 * dashboard, call) because the areas ship different stylesheets; moving between areas is a full page
 * load, so their CSS never mixes. The theme is applied before paint in every area.
 */
export function RootHtml({ fonts, children, scrollBehavior }: { fonts: string; children: React.ReactNode; scrollBehavior?: boolean }) {
  return (
    <html lang="en" className={fonts} data-scroll-behavior={scrollBehavior ? "smooth" : undefined} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
