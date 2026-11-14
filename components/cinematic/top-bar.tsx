"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SITE_NAV } from "@/components/site/site-nav";
import { FilmSound } from "@/lib/cinematic/sound";

/** Wordmark, sound switch and the site's pages. Deliberately quiet. */
export function TopBar() {
  const sound = useRef<FilmSound | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => () => sound.current?.dispose(), []);

  const toggle = () => {
    sound.current ??= new FilmSound();
    if (on) sound.current.disable();
    else if (!sound.current.enable()) return;
    setOn(!on);
  };

  return (
    <header className="topbar">
      <a href="#silence" className="topbar-mark">UN<span>·</span>AI</a>
      <div className="topbar-actions">
        <button type="button" className="topbar-sound" aria-pressed={on} onClick={toggle}>
          <span className="topbar-eq" data-on={on} aria-hidden="true"><i /><i /><i /><i /></span>
          Sound {on ? "on" : "off"}
        </button>
        {SITE_NAV.map((item) => (
          <Link key={item.href} href={item.href} className="topbar-link topbar-page">{item.label}</Link>
        ))}
      </div>
    </header>
  );
}
