import { LostPage } from "@/components/shared/lost-page";

export const metadata = { title: "Page not found" };

/** An agent, conversation or campaign that does not exist (the page called notFound()). */
export default function NotFound() {
  return <LostPage />;
}
