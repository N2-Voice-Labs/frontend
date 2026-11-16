import type { Metadata } from "next";
import { PortalPage } from "@/components/features/portal/portal-page";
import { NoticesList } from "@/components/features/portal/portal-widgets";
import { SOURCES } from "@/lib/portal-content";

export const metadata: Metadata = { title: "Notices" };

export default function NoticesPage() {
  return (
    <PortalPage eyebrow="Notices" title="Announcements" pose="megaphone" bubble={<>Results are only posted online, so check back here.</>} sources={[SOURCES.springGuide, SOURCES.fallGuide]}
      lead="Key dates and rules from the 2027 admission guides: what is coming up, what has passed, and what is good to know.">
      <NoticesList />
    </PortalPage>
  );
}
