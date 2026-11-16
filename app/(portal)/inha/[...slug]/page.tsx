import { notFound } from "next/navigation";

/** Any unknown /inha/* address shows the portal's own "not found" page (app/(portal)/inha/not-found.tsx). */
export default function UnknownPortalPage(): never {
  notFound();
}
