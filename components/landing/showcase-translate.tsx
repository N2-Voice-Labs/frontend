"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TickIcon } from "@/components/shared/tick-icon";
import { clamp, frac } from "@/lib/landing/math";
import { SAMPLES, SCENES } from "@/lib/landing/showcase-data";
import { SpeakShortcut } from "./demo-session";

const TR_N = 56;
const TR_HEIGHTS = Array.from({ length: TR_N }, (_, i) => {
  const r = frac(Math.sin(i * 12.9898 + 3.3) * 43758.5453);
  return Math.round(8 + (0.25 + 0.75 * r) * Math.sin((Math.PI * (i + 0.5)) / TR_N) * 44);
});
const clock = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

/**
 * Scenario picker + stage + player. Plays SAMPLES[scene] when a real recording exists; otherwise a text
 * preview types the translation out in time with the bar, and the status line says it is a text preview.
 */
export function ShowcaseTranslate({ active }: { active: boolean }) {
  const [scene, setScene] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(SCENES[0].dur);
  const [typed, setTyped] = useState<number | null>(null); // null = the whole translation
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState(`Ready: ${SCENES[0].title}`);
  const raf = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const picks = useRef<(HTMLButtonElement | null)[]>([]);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    audio.current?.pause();
    audio.current = null;
    setPlaying(false);
  }, []);

  useEffect(() => stop, [stop]);
  useEffect(() => { if (!active) stop(); }, [active, stop]);

  const sc = SCENES[scene];

  const select = (i: number, focus = false) => {
    stop();
    setScene(i);
    setProgress(0); setElapsed(0); setTotal(SCENES[i].dur); setTyped(null);
    setStatus(`Ready: ${SCENES[i].title}`);
    if (focus) picks.current[i]?.focus();
  };

  const onPickKey = (e: KeyboardEvent, i: number) => {
    const n = SCENES.length;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + n) % n : null;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };

  const play = () => {
    if (playing) { stop(); setStatus(`Paused: ${sc.title}`); return; }
    setPlaying(true);
    const sample = SAMPLES[sc.id];
    if (sample) {
      // A real recorded translation.
      const a = new Audio(sample);
      audio.current = a;
      setStatus(`Playing: ${sc.title}`);
      a.addEventListener("timeupdate", () => {
        const d = a.duration || sc.dur;
        setProgress(a.currentTime / d); setElapsed(a.currentTime); setTotal(d);
      });
      a.addEventListener("ended", () => { stop(); setProgress(1); setStatus(`Done: ${sc.title}`); });
      a.play().catch(() => { stop(); setStatus("Could not play the sample."); });
      return;
    }
    // Text preview: the translation types out in time with the bar.
    setStatus(`Text preview: ${sc.title}`);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const tick = (now: number) => {
      const p = reduce ? 1 : clamp((now - start) / (sc.dur * 1000));
      setTyped(Math.round(sc.dst.length * clamp(p * 1.15)));
      setProgress(p); setElapsed(p * sc.dur);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { raf.current = 0; setPlaying(false); setStatus(`Done: ${sc.title}`); }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const lit = Math.round(progress * TR_N);

  return (
    <div className="tr-wrap">
      <div className="tr-picks" role="radiogroup" aria-label="Scenario">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => { picks.current[i] = el; }}
            type="button"
            className="pick"
            role="radio"
            aria-checked={i === scene}
            tabIndex={i === scene ? 0 : -1}
            onClick={() => select(i)}
            onKeyDown={(e) => onPickKey(e, i)}
          >
            <TickIcon letter={s.init} />
            <span><span className="mono sm">{String(i + 1).padStart(2, "0")}</span><b>{s.title}</b><span className="mono sm">{s.meta}</span></span>
          </button>
        ))}
      </div>
      <div className="tr-stage">
        <span className="mono sm tr-kind"><span className="ldot" />Live translation</span>
        <p className="tr-src" lang={sc.srcLang}>“{sc.src}”</p>
        <p className="tr-dst" lang={sc.dstLang}>{typed === null ? sc.dst : sc.dst.slice(0, typed)}</p>
        <span className="mono sm tr-meta">{sc.meta}</span>
        <div className="player">
          <button type="button" className="play-btn" aria-label={playing ? "Pause" : "Play"} onClick={play}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={playing ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5v14l11-7z"} />
            </svg>
          </button>
          <div className="pbars" aria-hidden="true">
            {TR_HEIGHTS.map((h, i) => <span key={i} className={i < lit ? "on" : undefined} style={{ height: h }} />)}
          </div>
          <span className="mono sm">{clock(elapsed)} / {clock(total)}</span>
        </div>
        <span className="mono sm tr-status" role="status">{status}</span>
        <div className="tr-foot">
          <span>Glossary-aware, and it speaks back in the other language.</span>
          <SpeakShortcut className="mono sm">Speak to it +</SpeakShortcut>
        </div>
      </div>
    </div>
  );
}
