import { SiteFooter } from "@/components/site/site-chrome";
import "./site.css";

/** Content pages (Products, Solutions, Developers, Live demo, Contact). The film stays alone on `/`. */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="site">
      {children}
      <SiteFooter />
    </div>
  );
}
