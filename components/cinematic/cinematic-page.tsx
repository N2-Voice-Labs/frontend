"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { DemoSessionProvider } from "@/components/landing/demo-session";
import { BridgeScene } from "@/components/scenes/bridge/bridge-scene";
import { ConversationScene } from "@/components/scenes/conversation/conversation-scene";
import { DistanceScene } from "@/components/scenes/distance/distance-scene";
import { EngineScene } from "@/components/scenes/engine/engine-scene";
import { FutureScene } from "@/components/scenes/future/future-scene";
import { RealityScene } from "@/components/scenes/reality/reality-scene";
import { SilenceScene } from "@/components/scenes/silence/silence-scene";
import { WorldScene } from "@/components/scenes/world/world-scene";
import { director, isCinematic } from "@/lib/cinematic/director";
import { gsap, ScrollTrigger } from "@/lib/cinematic/gsap";
import { ChapterIndicator } from "./chapter-indicator";
import { Stage } from "./stage";
import { TopBar } from "./top-bar";

/** Lenis drives the window scroll and GSAP's ticker drives Lenis, so ScrollTrigger scrubs stay in sync. */
function useSmoothScroll() {
  useEffect(() => {
    if (!isCinematic()) return;
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    director.scrollTo = (target) => lenis.scrollTo(target, { duration: 2.4 });
    // Fonts change line heights; measure the scenes again once they are in.
    void document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      director.scrollTo = (target) => target.scrollIntoView({ behavior: "smooth" });
    };
  }, []);
}

/** The landing page as a short film in eight chapters over one shared canvas. */
export function CinematicPage() {
  useSmoothScroll();
  return (
    <DemoSessionProvider>
      <div className="cine">
        <Stage />
        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <TopBar />
        <ChapterIndicator />
        <main>
          <SilenceScene />
          <DistanceScene />
          <BridgeScene />
          <ConversationScene />
          <EngineScene />
          <WorldScene />
          <RealityScene />
          <FutureScene />
        </main>
      </div>
    </DemoSessionProvider>
  );
}
