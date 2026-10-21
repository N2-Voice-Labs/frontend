"use client";

import { useEffect, useRef } from "react";
import { HISTORY } from "@/lib/demo/config";
import { clamp, frac, smooth } from "@/lib/landing/math";
import { useReducedMotion, useScrollEffect, useScrollProgress } from "@/lib/landing/scroll";
import { canvasTokens, fitCanvas } from "@/lib/landing/tokens";
import { useElementSize } from "@/lib/landing/use-size";
import { useDemoSession, useDemoSnapshot } from "./demo-session";
import { PinProgress } from "./pin-progress";

const WORDS = [
  <>Noise.</>,
  <>A <em>voice.</em></>,
  <>Two voices. <em>One bridge.</em></>,
  <>Live. <em>Watch your voice cross.</em></>,
];

/**
 * Pinned band. Scroll mode: scattered noise → one ink waveform (0–40%) → teal/plum lanes joined by a
 * lime bridge (45–85%). Live mode (any active demo session): teal = your mic, plum = the agent's audio,
 * the bridge pulses while waiting for the reply and flashes when it arrives.
 */
export function SignalBand() {
  const session = useDemoSession();
  const { state, captions, stats } = useDemoSnapshot();
  const reduce = useReducedMotion();
  const live = state === "listening" || state === "speaking" || state === "preview";

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progress = useScrollProgress(sectionRef, "pin");
  const progressRef = useRef(0);
  const visible = useRef(false);
  const needsDraw = useRef(true);
  const size = useElementSize(canvasRef, () => { needsDraw.current = true; });

  useScrollEffect((vh) => {
    const r = sectionRef.current?.getBoundingClientRect();
    visible.current = !!r && r.bottom > 0 && r.top < vh;
  });

  useEffect(() => {
    progressRef.current = progress;
    needsDraw.current = true;
  }, [progress]);

  useEffect(() => {
    const mo = new MutationObserver(() => { needsDraw.current = true; });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-vl-theme"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx) return;
    let frame = 0;

    const line = (x1: number, y1: number, x2: number, y2: number) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

    const drawLive = (now: number, w: number, h: number) => {
      const { teal, plum, lime } = canvasTokens();
      const mid = h / 2, gap = w / HISTORY, off = h * 0.24, laneAmp = h * 0.2;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.5, Math.min(4, gap * 0.45));
      for (let i = 0; i < HISTORY; i++) {
        const x = (i + 0.5) * gap;
        const a1 = 1.5 + session.histYou[i] * laneAmp;
        const a2 = 1.5 + session.histAgent[i] * laneAmp;
        ctx.globalAlpha = 0.2 + 0.8 * (i / HISTORY);
        ctx.strokeStyle = teal; line(x, mid - off - a1, x, mid - off + a1);
        ctx.strokeStyle = plum; line(x, mid + off - a2, x, mid + off + a2);
      }
      // The bridge brightens while waiting for the reply and flashes when it arrives.
      const waiting = session.isWaiting(now);
      const flash = clamp(1 - (now - session.flashAt) / 700);
      ctx.globalAlpha = 0.35 + 0.65 * Math.max(flash, waiting ? 0.6 : 0);
      ctx.strokeStyle = lime;
      ctx.lineWidth = 2 + 3 * flash;
      line(gap, mid, w - gap, mid);
      if (waiting) {
        const x = gap + frac((now - session.lastUserVoice) / 900) * (w - 2 * gap);
        ctx.fillStyle = lime;
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, mid, 6, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.arc(x, mid, 14, 0, 6.283); ctx.fill();
        // Connector from your lane down into the bridge.
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        line(w - gap * 2, mid - off, w - gap * 2, mid);
      }
      ctx.globalAlpha = 1;
    };

    const drawScroll = (now: number, w: number, h: number) => {
      const { ink, teal, plum, lime } = canvasTokens();
      const p = progressRef.current;
      const t = reduce ? 4 : now / 1000;
      const mid = h / 2, maxAmp = h * 0.34;
      // 0 → .4: noise organizes into one waveform; .45 → .85: it splits into two lanes + bridge.
      const order = smooth(p / 0.4);
      const split = smooth((p - 0.45) / 0.4);
      const N = w < 700 ? 60 : 110;
      const gap = w / N;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.5, Math.min(4, gap * 0.4));
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) * gap;
        const r1 = frac(Math.sin(i * 12.9898) * 43758.5453);
        const r2 = frac(Math.sin(i * 78.233) * 12345.678);
        const env = Math.pow(Math.sin((Math.PI * (i + 0.5)) / N), 1.3);
        const amp = maxAmp * env * (0.3 + 0.7 * Math.abs(Math.sin(t * 1.6 + i * 0.23 + r1 * 2)));
        const amp2 = maxAmp * env * (0.3 + 0.7 * Math.abs(Math.sin(t * 1.9 + i * 0.31 + r2 * 3)));
        const noiseY = h * (0.08 + 0.84 * r2) + Math.sin(t * 2.2 + i) * 4;
        const half = 1.5 + (amp - 1.5) * order;
        if (split < 1) {
          const cy = noiseY + (mid - noiseY) * order;
          ctx.globalAlpha = (0.35 + 0.55 * order) * (1 - split);
          ctx.strokeStyle = ink;
          line(x, cy - half, x, cy + half);
        }
        if (split > 0) {
          const off = h * 0.24 * split;
          const k = 1 - 0.55 * split;
          ctx.globalAlpha = split;
          ctx.strokeStyle = teal;
          line(x, mid - off - half * k, x, mid - off + half * k);
          const half2 = 1.5 + (amp2 - 1.5) * order;
          ctx.strokeStyle = plum;
          line(x, mid + off - half2 * k, x, mid + off + half2 * k);
        }
      }
      if (split > 0) {
        ctx.globalAlpha = split * 0.9;
        ctx.strokeStyle = lime;
        ctx.lineWidth = 2;
        line(gap, mid, w - gap, mid);
        // Pulses crossing the bridge in both directions.
        ctx.fillStyle = lime;
        ctx.globalAlpha = split;
        const p1 = gap + frac(t * 0.18) * (w - 2 * gap);
        const p2 = w - gap - frac(t * 0.18 + 0.5) * (w - 2 * gap);
        ctx.beginPath(); ctx.arc(p1, mid, 5, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(p2, mid, 5, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible.current) return;
      const isLive = session.isLive();
      // Live mode always animates (it is data, not decoration); scroll mode with reduced motion
      // draws one static frame per scroll position.
      if (reduce && !isLive && !needsDraw.current) return;
      needsDraw.current = false;
      const { w, h } = size.current;
      if (!fitCanvas(canvas, ctx, w, h)) return;
      if (isLive) drawLive(now, w, h);
      else drawScroll(now, w, h);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, session, size]);

  const word = live ? 3 : progress < 0.3 ? 0 : progress < 0.6 ? 1 : 2;
  const buttonText = state === "idle" ? "Speak to it" : state === "connecting" ? "Connecting…" : "End session";

  return (
    <section id="signal" className="sec pinsec" ref={sectionRef} style={{ height: 1200 }}>
      <div className="pin" style={{ height: 780 }}>
        <PinProgress value={progress} />
        <div className="wrap signal-inner">
          <div className="mono">The signal</div>
          <p className="sr-only">Noise becomes a voice, and one voice becomes two voices joined by a bridge. Start a session to see your own voice and the agent&apos;s reply drawn live, with the measured response time.</p>
          <div className="signal-words" aria-hidden="true">
            {WORDS.map((w, i) => <span key={i} data-on={String(i === word)}>{w}</span>)}
          </div>
          <p className="signal-cap cap-you" aria-live="polite">{captions.you}</p>
          <canvas className="signal-canvas" ref={canvasRef} aria-hidden="true" />
          <p className="signal-cap cap-agent" aria-live="polite">{captions.agent}</p>
          <div className="signal-foot">
            <div className="signal-legend mono sm" aria-hidden="true" style={{ opacity: live ? 1 : smooth((progress - 0.6) / 0.2) }}>
              <span><i style={{ background: "var(--teal)" }} />You</span>
              <span><i style={{ background: "var(--lime)" }} />Voice Labs</span>
              <span><i style={{ background: "var(--plum)" }} />The agent</span>
            </div>
            <div className="signal-stats" role="status" aria-live="polite">
              <span className="mono sm">{stats.label}</span>
              <b>{stats.value}</b>
              <span className="mono sm">{stats.note}</span>
            </div>
            <button type="button" className="btn btn-primary" disabled={state === "connecting"} onClick={session.toggle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              <span>{buttonText}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
