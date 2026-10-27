import { CinematicPage } from "@/components/cinematic/cinematic-page";
import { cinematicInitScript } from "@/lib/cinematic/director";

export default function Home() {
  return (
    <>
      {/* Turns on film mode before first paint (skipped under reduced motion). */}
      <script dangerouslySetInnerHTML={{ __html: cinematicInitScript }} />
      <CinematicPage />
    </>
  );
}
