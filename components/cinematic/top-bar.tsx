"use client";

import { useEffect, useRef, useState } from "react";
import { ROUTES } from "@/lib/landing/config";
import { FilmSound } from "@/lib/cinematic/sound";

/** Wordmark, sound switch and the way into the workspace. Deliberately quiet. */
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
      <a href="#silence" className="topbar-mark">VOICE<span>·</span>LABS</a>
      <div className="topbar-actions">
        <button type="button" className="topbar-sound" aria-pressed={on} onClick={toggle}>
          <span className="topbar-eq" data-on={on} aria-hidden="true"><i /><i /><i /><i /></span>
          Sound {on ? "on" : "off"}
        </button>
        <a href={ROUTES.agents} className="topbar-link">Workspace</a>
      </div>
    </header>
  );
}
