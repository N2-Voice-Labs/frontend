import { AssistantDock } from "@/components/features/portal/assistant-dock";
import { PortalFooter, PortalHeader } from "@/components/features/portal/portal-chrome";

/** The student-facing tabs share one header, one footer and one assistant that stays mounted between tabs. */
export default function StudentPortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PortalHeader />
      <AssistantDock>{children}</AssistantDock>
      <PortalFooter />
    </>
  );
}
