"use client";

import { useEffect, useRef } from "react";
import { ORB_BARS, readBands } from "@/lib/demo/audio";
import { DEMO_CONFIG } from "@/lib/demo/config";
import type { SessionState } from "@/lib/demo/session-store";
import { clamp, frac } from "@/lib/landing/math";
import { scrollProgress, useReducedMotion, useScrollEffect } from "@/lib/landing/scroll";
import { canvasTokens, fitCanvas } from "@/lib/landing/tokens";
import { useElementSize } from "@/lib/landing/use-size";
import { SpeakShortcut, useDemoSession, useDemoSnapshot } from "./demo-session";

const LABELS: Record<SessionState, string> = { idle: "Voice / 01", connecting: "Connecting", listening: "Listening", speaking: "Speaking", preview: "Mic preview" };

const NODES = Array.from({ length: 80 }, (_, i) => ({
  x: frac(Math.sin(i * 91.17) * 43758.55),
  y: frac(Math.sin(i * 47.31) * 12345.67),
  p: frac(Math.sin(i * 7.7) * 999.1) * 6.28,
}));

/** Opacity steps for batching the network lines (per colour), and the highest line opacity (0.14 + 0.5). */
const ALPHA_STEPS = 12;
const MAX_ALPHA = 0.64;

const ENVELOPE = Array.from({ length: ORB_BARS }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / ORB_BARS));

/** Bar height (scaleY) for a band level 0–1, shaped so the middle bars stand taller. */
const barScale = (i: number, band: number) => Math.max(0.12, Math.min(1, band * 1.6 * (0.55 + 0.45 * ENVELOPE[i]) + 0.08));

/**
 * Idle breathing, as CSS variables for the orb-bars keyframes: each bar swings between band levels
 * ENV·0.05 and ENV·0.45 (the reference's ENV·(0.25 ± 0.2·sin(1.4t + 0.6i))), half a period one way
 * (π/1.4 s), phase-shifted by 0.6 rad per bar. `--mid` is the static reduced-motion shape (ENV·0.35).
 */
const IDLE_VARS = ENVELOPE.map((env, i) => ({
  "--lo": barScale(i, env * 0.05).toFixed(3),
  "--hi": barScale(i, env * 0.45).toFixed(3),
  "--mid": barScale(i, env * 0.35).toFixed(3),
  "--d": `${(-(i * 0.6) / 1.4).toFixed(2)}s`,
}) as React.CSSProperties);

function speakNote(hasAgent: boolean) {
  if (!hasAgent) return "Optional. Mic preview only: your voice is drawn on this page and is not sent anywhere.";
  const note = "Optional. Uses your microphone to talk to the Voice Labs demo agent while the session is open.";
  return DEMO_CONFIG.storesTranscripts ? `${note} Transcripts of demo conversations are stored.` : note;
}

export function HeroVoice() {
  const session = useDemoSession();
  const { state, message } = useDemoSnapshot();
  const reduce = useReducedMotion();

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  /** Hero scroll-out progress; drawing stops at 1 (fully scrolled past). */
  const heroP = useRef(0);
  /** Orb centre relative to the canvas, updated on resize only. */
  const orbCenter = useRef({ x: 0, y: 0 });
  const needsDraw = useRef(true);

  const canvasSize = useElementSize(canvasRef, () => {
    const stage = stageRef.current, canvas = canvasRef.current;
    if (stage && canvas) {
      const o = stage.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      orbCenter.current = { x: o.left - c.left + o.width / 2, y: o.top - c.top + o.height / 2 };
    }
    needsDraw.current = true;
  });

  useScrollEffect((vh) => {
    const el = sectionRef.current;
    if (!el) return;
    heroP.current = scrollProgress(el.getBoundingClientRect(), vh, "exit");
    needsDraw.current = true;
  });

  // Redraw the static frame (reduced motion) when the theme changes.
  useEffect(() => {
    const mo = new MutationObserver(() => { needsDraw.current = true; });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-vl-theme"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, stage = stageRef.current, barsEl = barsRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !stage || !barsEl) return;
    const bars = Array.from(barsEl.children) as HTMLElement[];
    const bands = new Array<number>(ORB_BARS).fill(0);
    let orbLevel = 0;
    let lastLevel = "";
    let lastNet = -Infinity;
    let frame = 0;
    const buckets: number[][] = Array.from({ length: ALPHA_STEPS * 2 }, () => []);

    const drawNet = (now: number) => {
      if (!ctx) return;
      const { w, h } = canvasSize.current;
      if (!fitCanvas(canvas, ctx, w, h)) return;
      const { ink, coral } = canvasTokens();
      const t = reduce ? 0 : now / 1000;
      const { x: ox, y: oy } = orbCenter.current;
      const pts = NODES.map((n) => ({ x: n.x * w + Math.sin(t * 0.25 + n.p) * 14, y: n.y * h + Math.cos(t * 0.2 + n.p) * 12 }));
      const maxD = Math.min(190, w / 6);
      ctx.lineWidth = 1;
      // Lines are batched into one path per colour and opacity step (ALPHA_STEPS), so a frame is ~a dozen
      // stroke() calls instead of several hundred. The quantised opacity is not visible at these alphas.
      for (const b of buckets) b.length = 0;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          if (dx > maxD || dx < -maxD || dy > maxD || dy < -maxD) continue;
          const d = Math.hypot(dx, dy);
          if (d > maxD) continue;
          const mx = (pts[i].x + pts[j].x) / 2 - ox, my = (pts[i].y + pts[j].y) / 2 - oy;
          const glow = clamp(1 - Math.hypot(mx, my) / 420) * orbLevel;
          const alpha = (1 - d / maxD) * (0.14 + 0.5 * glow);
          const step = Math.min(ALPHA_STEPS - 1, Math.round((alpha / MAX_ALPHA) * (ALPHA_STEPS - 1)));
          if (step === 0) continue;
          buckets[(glow > 0.08 ? ALPHA_STEPS : 0) + step].push(i, j);
        }
      }
      for (let k = 0; k < buckets.length; k++) {
        const list = buckets[k];
        if (!list.length) continue;
        ctx.globalAlpha = ((k % ALPHA_STEPS) / (ALPHA_STEPS - 1)) * MAX_ALPHA;
        ctx.strokeStyle = k >= ALPHA_STEPS ? coral : ink;
        ctx.beginPath();
        for (let n = 0; n < list.length; n += 2) {
          ctx.moveTo(pts[list[n]].x, pts[list[n]].y);
          ctx.lineTo(pts[list[n + 1]].x, pts[list[n + 1]].y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      for (const p of pts) { ctx.moveTo(p.x + 1.8, p.y); ctx.arc(p.x, p.y, 1.8, 0, 6.283); }
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (heroP.current >= 1) return; // fully scrolled past: skip all hero work

      const src = session.agentSpeaking && session.agentAnalyser ? session.agentAnalyser : session.micAnalyser;
      if (src) {
        // Live: the bars follow the real audio, so they are written from here every frame.
        if (barsEl.dataset.mode !== "live") barsEl.dataset.mode = "live";
        readBands(src, bands);
        let sum = 0;
        for (let i = 0; i < ORB_BARS; i++) {
          bars[i].style.transform = `scaleY(${barScale(i, bands[i]).toFixed(3)})`;
          sum += bands[i];
        }
        orbLevel += (clamp((sum / ORB_BARS) * 2.2) - orbLevel) * 0.2;
      } else {
        // Idle: the breathing is a CSS animation (orb-bars[data-mode=idle]), run by the compositor
        // instead of 13 style writes per frame from here.
        if (barsEl.dataset.mode !== "idle") {
          barsEl.dataset.mode = "idle";
          for (const b of bars) b.style.transform = "";
        }
        orbLevel += (0 - orbLevel) * 0.2;
      }
      const level = orbLevel.toFixed(3);
      if (level !== lastLevel) { stage.style.setProperty("--level", level); lastLevel = level; }

      // Reduced motion: one static frame, redrawn only on scroll, resize or theme change.
      // The idle network drifts slowly: 30 fps is enough. While a voice session glows it, full rate.
      const netDue = src ? true : now - lastNet >= 32;
      if ((!reduce && netDue) || needsDraw.current) { drawNet(now); lastNet = now; }
      needsDraw.current = false;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, session, canvasSize]);

  const active = state !== "idle";
  const buttonText = state === "idle" ? "Speak to it" : state === "connecting" ? "Connecting…" : "End session";

  return (
    <section id="top" className="hero" ref={sectionRef}>
      <div className="hero-bg" aria-hidden="true" />
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <div className="mono badge"><span className="ldot" />Realtime voice AI</div>
          <h1 className="h1">Voice AI that speaks your language. <em>Even when you switch.</em></h1>
          <p className="hero-sub">Voice agents and live translation that follow people across languages — mid-sentence, in real time.</p>
          <div className="cta-row">
            <SpeakShortcut className="btn btn-primary">
              Speak to it
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </SpeakShortcut>
            <a href="#bridge" className="btn btn-ghost">See how it works</a>
          </div>
        </div>

        <div className="orb-col">
          <div className="orb-stage" ref={stageRef} data-state={state}>
            {/* Each spinning orbit is its own <svg> box rotated by CSS, so the GPU turns it without repainting
                (rotating <g> elements inside one SVG repainted the whole stage every frame). */}
            <svg className="orbits orbit-dash" viewBox="0 0 520 520" aria-hidden="true">
              <defs>
                <linearGradient id="orbitGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" style={{ stopColor: "var(--coral)" }} />
                  <stop offset="1" style={{ stopColor: "var(--lime)" }} />
                </linearGradient>
              </defs>
              <circle cx="260" cy="260" r="232" fill="none" stroke="url(#orbitGrad)" strokeWidth="3" strokeDasharray="14 18" strokeLinecap="round" opacity=".85" />
            </svg>
            <svg className="orbits orbit-tilt" viewBox="0 0 520 520" aria-hidden="true">
              <ellipse cx="260" cy="260" rx="250" ry="118" transform="rotate(-32 260 260)" fill="none" style={{ stroke: "var(--muted)" }} strokeOpacity=".55" strokeWidth="1.5" />
            </svg>
            <svg className="orbits" viewBox="0 0 520 520" aria-hidden="true">
              <circle cx="40" cy="190" r="9" fill="none" style={{ stroke: "var(--coral)" }} strokeWidth="3" />
              <circle cx="468" cy="390" r="8" style={{ fill: "var(--lime)", stroke: "var(--ink)" }} strokeWidth="3" />
            </svg>
            <span className="tag tag-en"><i style={{ background: "var(--coral)" }} />EN</span>
            <span className="tag tag-ru"><i style={{ background: "var(--teal)" }} />RU</span>
            <div className="orb">
              <div className="orb-mark">V<i /></div>
              <div className="orb-bars" ref={barsRef} data-mode="idle" aria-hidden="true">
                {IDLE_VARS.map((vars, i) => <span key={i} style={vars} />)}
              </div>
              <div className="orb-label">{LABELS[state]}</div>
            </div>
          </div>
          <button type="button" className="speak-btn" aria-pressed={active && state !== "connecting"} disabled={state === "connecting"} onClick={session.toggle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            <span>{buttonText}</span>
          </button>
          <p className="speak-msg" role="status" aria-live="polite">{message}</p>
          <p className="speak-note">{speakNote(session.hasAgent)}</p>
        </div>
      </div>
    </section>
  );
}
