"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { CHAPTERS, chapterNumber } from "@/lib/cinematic/chapters";
import { isCinematic, setPosition } from "@/lib/cinematic/director";
import { gsap, ScrollTrigger } from "@/lib/cinematic/gsap";

/** Builds a scene's scroll-scrubbed timeline; `q` selects inside the scene's layer. Keep it module-level (stable). */
export type SceneTimeline = (tl: gsap.core.Timeline, q: (selector: string) => Element[]) => void;

const LAST = CHAPTERS.length - 1;

/**
 * One chapter of the film. The <section> only provides scroll distance; its content lives in a layer
 * that is fixed to the viewport in film mode (html.cine-js), so chapters cross-fade over the shared
 * canvas instead of scrolling past one another. Without film mode the layer is ordinary flowing content.
 *
 * Its ScrollTrigger writes the chapter position for the canvas, chapter indicator and sound.
 */
export function Scene({ index, timeline, children, className, fadeOutAt = 0.96 }: {
  index: number;
  timeline?: SceneTimeline;
  children: ReactNode;
  className?: string;
  /** Chapter progress where the layer starts fading out; later for chapters that hand over a visible element. */
  fadeOutAt?: number;
}) {
  const chapter = CHAPTERS[index];
  const sectionRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current, layer = layerRef.current;
    if (!section || !layer) return;
    const film = isCinematic();
    const ctx = gsap.context(() => {
      let tl: gsap.core.Timeline | undefined;
      if (film) {
        tl = gsap.timeline({ defaults: { ease: "none" } });
        tl.to({}, { duration: 1 }, 0);
        if (index > 0) tl.fromTo(layer, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.04 }, 0);
        else gsap.set(layer, { autoAlpha: 1 });
        timeline?.(tl, gsap.utils.selector(layer));
        if (index < LAST) tl.to(layer, { autoAlpha: 0, duration: Math.min(0.04, 1 - fadeOutAt) }, fadeOutAt);
      }
      ScrollTrigger.create({
        trigger: section,
        start: film ? "top top" : "top center",
        end: film ? "bottom bottom" : "bottom center",
        animation: tl,
        scrub: film ? true : false,
        onUpdate: (self) => {
          if (self.progress > 0 && self.progress < 1) setPosition(index + self.progress);
        },
        onLeave: () => setPosition(Math.min(index + 1, LAST + 1)),
        onEnterBack: (self) => setPosition(index + self.progress),
      });
    }, layer);
    return () => ctx.revert();
  }, [index, timeline, fadeOutAt]);

  return (
    <section
      ref={sectionRef}
      id={chapter.id}
      className={className ? `scene ${className}` : "scene"}
      style={{ "--len": chapter.length } as CSSProperties}
      aria-label={`${chapterNumber(index)} — ${chapter.label}`}
    >
      <div ref={layerRef} className="scene-layer">{children}</div>
    </section>
  );
}
