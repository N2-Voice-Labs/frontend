"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CHAPTERS, chapterNumber } from "@/lib/cinematic/chapters";
import { director, subscribeDirector } from "@/lib/cinematic/director";

/**
 * Chapter list on the left edge (a compact "03 / 08" counter on small screens). The progress line inside
 * the current chapter is a CSS variable written outside React; React re-renders only on chapter change.
 */
export function ChapterIndicator() {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => subscribeDirector((position, chapter) => {
    ref.current?.style.setProperty("--chapter-progress", String(Math.min(1, position - chapter)));
    setActive((prev) => (prev === chapter ? prev : chapter));
  }), []);

  const go = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    director.scrollTo(target);
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav ref={ref} className="chapters" aria-label="Chapters">
      <ol>
        {CHAPTERS.map((c, i) => (
          <li key={c.id} data-state={i < active ? "past" : i === active ? "current" : "next"}>
            <a href={`#${c.id}`} onClick={(e) => go(e, c.id)} aria-current={i === active ? "step" : undefined}>
              <span className="chapters-n">{chapterNumber(i)}</span>
              <span className="chapters-label">{c.label}</span>
              {i === active && <span className="chapters-bar" aria-hidden="true" />}
            </a>
          </li>
        ))}
      </ol>
      <p className="chapters-compact" aria-hidden="true">
        <span>{chapterNumber(active)}</span> / {chapterNumber(CHAPTERS.length - 1)} <b>{CHAPTERS[active].label}</b>
        <span className="chapters-bar" />
      </p>
    </nav>
  );
}
