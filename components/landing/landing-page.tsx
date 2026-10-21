import { BridgeDemo } from "./bridge-demo";
import { ClosingCta } from "./closing-cta";
import { DemoSessionProvider } from "./demo-session";
import { HeroVoice } from "./hero-voice";
import { LanguageFluid } from "./language-fluid";
import { LatencyTimeline } from "./latency-timeline";
import { Nav } from "./nav";
import { OffscreenPause } from "./offscreen-pause";
import { ProductShowcase } from "./product-showcase";
import { SignalBand } from "./signal-band";
import { SiteFooter } from "./site-footer";

export function LandingPage() {
  return (
    <DemoSessionProvider>
      <Nav />
      <main>
        <HeroVoice />
        <SignalBand />
        <BridgeDemo />
        <LanguageFluid />
        <ProductShowcase />
        <LatencyTimeline />
        <ClosingCta />
      </main>
      <SiteFooter />
      <OffscreenPause />
    </DemoSessionProvider>
  );
}
