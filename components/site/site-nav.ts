import { ROUTES } from "@/lib/landing/config";

/** The site's main navigation, shared by the header (desktop + phone menu) and the footer. */
export const SITE_NAV = [
  { href: ROUTES.products, label: "Products" },
  { href: ROUTES.solutions, label: "Solutions" },
  { href: ROUTES.developers, label: "Developers" },
  { href: ROUTES.demo, label: "Live demo" },
  { href: ROUTES.contact, label: "Contact" },
] as const;

/** What a capability honestly is today. Rendered as a chip; never upgrade one without evidence. */
export type Availability = "mvp" | "progress" | "planned";

export const AVAILABILITY: Record<Availability, string> = {
  mvp: "In the MVP",
  progress: "In progress",
  planned: "Planned",
};
