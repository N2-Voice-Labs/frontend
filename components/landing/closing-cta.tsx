import { pilotHref, ROUTES } from "@/lib/landing/config";
import { SpeakShortcut } from "./demo-session";

/** The page's single ending: try it now, or bring it to your own calls (pilot). */
export function ClosingCta() {
  return (
    <section id="start" className="sec final">
      <div className="dots" aria-hidden="true" />
      <div className="ripples" aria-hidden="true">
        <span className="ripple" />
        <span className="ripple p" />
        <span className="ripple" />
        <span className="ripple p" />
      </div>
      <div className="wrap final-inner">
        <h2 className="h2 final-title">Hear it <em>for yourself.</em></h2>
        <p className="lede">Talk to a live agent in English, Russian, or both — right here in your browser.</p>
        <div className="cta-row">
          <SpeakShortcut className="btn btn-primary">Speak to it</SpeakShortcut>
          {pilotHref && <a href={pilotHref} className="btn btn-ghost">Request a pilot</a>}
          <a href={ROUTES.agents} className="btn btn-ghost">Open workspace</a>
        </div>
        <p className="mono sm final-pilot">Pilot access · EN · RU · KO — tell us about your callers and we&apos;ll set up an agent with you.</p>
      </div>
    </section>
  );
}
