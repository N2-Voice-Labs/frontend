import Link from "next/link";
import { CloneForm } from "@/components/features/voices/clone-form";
import { PageHead } from "@/components/features/workspace/ui";

export default function CloneVoice() {
  return <main className="page-shell dash-main">
    <Link className="dash-back" href="/voices">← Voices</Link>
    <PageHead eyebrow="Voices / Clone" title="Clone a voice" intro="Create a voice from a recording. The speaker’s consent is required and is saved with the voice." />
    <CloneForm />
  </main>;
}
