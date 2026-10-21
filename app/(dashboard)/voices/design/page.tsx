import Link from "next/link";
import { DesignForm } from "@/components/features/voices/design-form";
import { PageHead } from "@/components/features/workspace/ui";

export default function DesignVoice() {
  return <main className="page-shell dash-main">
    <Link className="dash-back" href="/voices">← Voices</Link>
    <PageHead eyebrow="Voices / Design" title="Design a voice" intro="Describe the voice in words and set its energy, warmth and speed." />
    <DesignForm />
  </main>;
}
