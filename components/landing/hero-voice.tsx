"use client";

import { useEffect, useRef } from "react";
import { ORB_BARS, readBands } from "@/lib/demo/audio";
import { DEMO_CONFIG } from "@/lib/demo/config";
import type { SessionState } from "@/lib/demo/session-store";
import { clamp, frac } from "@/lib/landing/math";
import { onBackgroundClick, pointer, pointerActive, rippleRadius, trackPointer } from "@/lib/landing/pointer";
import { scrollProgress, useReducedMotion, useScrollEffect } from "@/lib/landing/scroll";
import { canvasTokens, fitCanvas } from "@/lib/landing/tokens";
import { useElementSize } from "@/lib/landing/use-size";
import { SpeakShortcut, useDemoSession, useDemoSnapshot } from "./demo-session";

const LABELS: Record<SessionState, string> = { idle: "Voice / 01", connecting: "Connecting", listening: "Listening", speaking: "Speaking", preview: "Mic preview" };

/** Network node home positions (0–1) and drift phase; the per-frame offsets live in the effect. */
const NODE_COUNT = 84;
const NODE_HOME = Array.from({ length: NODE_COUNT }, (_, i) => ({
  bx: frac(Math.sin(i * 91.17) * 43758.55),
  by: frac(Math.sin(i * 47.31) * 12345.67),
  p: frac(Math.sin(i * 7.7) * 999.1) * 6.28,
}));

/**
 * Lines are batched into one path per colour and opacity step, so a frame is a few dozen stroke() calls
 * instead of several hundred. Colours: ink (resting), coral (the orb's voice), teal (near the cursor),
 * lime (a ripple's wave front). MAX_ALPHA is the highest opacity each colour can reach.
 */
const ALPHA_STEPS = 12;
const LINE_COLOURS = ["ink", "coral", "teal", "lime"] as const;
const MAX_ALPHA = [0.14, 0.64, 0.76, 0.9];

/** "The cursor is a voice": ripple speed (px/ms), lifetime distance, wave-front width and push. */
const RIPPLE_SPEED = 0.55;
const RIPPLE_LIFE = 900;
const RIPPLE_FRONT = 46;
const RIPPLE_PUSH = 16;
const MAX_RIPPLES = 7;
type Ripple = { x: number; y: number; t0: number; amp: number; hitOrb: boolean; r: number; life: number };

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
  /** Orb centre relative to the canvas and the orb's radius, updated on resize only. */
  const orbCenter = useRef({ x: 0, y: 0, r: 0 });
  /**
   * The canvas's viewport position, for mapping the cursor into canvas space. The canvas fills the hero
   * section (inset 0), so this is the section rect read in the shared scroll frame: never per frame.
   */
  const canvasRect = useRef({ left: 0, top: 0 });
  const needsDraw = useRef(true);

  const canvasSize = useElementSize(canvasRef, () => {
    const stage = stageRef.current, canvas = canvasRef.current;
    if (stage && canvas) {
      const o = stage.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      orbCenter.current = { x: o.left - c.left + o.width / 2, y: o.top - c.top + o.height / 2, r: o.width * 0.29 };
      canvasRect.current = { left: c.left, top: c.top };
    }
    needsDraw.current = true;
  });

  useScrollEffect((vh) => {
    const el = sectionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    heroP.current = scrollProgress(r, vh, "exit");
    canvasRect.current = { left: r.left, top: r.top };
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
    trackPointer();
    const bars = Array.from(barsEl.children) as HTMLElement[];
    const bands = new Array<number>(ORB_BARS).fill(0);
    let orbLevel = 0;
    let lastLevel = "";
    let lastNet = -Infinity;
    let frame = 0;
    const buckets: number[][] = Array.from({ length: ALPHA_STEPS * LINE_COLOURS.length }, () => []);

    /* "The cursor is a voice": node springs, ripples, and how loudly the orb heard the last ripple. */
    const nodes = NODE_HOME.map(() => ({ ox: 0, oy: 0, vx: 0, vy: 0, flash: 0 }));
    const pts = NODE_HOME.map(() => ({ x: 0, y: 0, f: 0 }));
    const ripples: Ripple[] = [];
    let echo = 0;
    let lastEmit = 0;
    let settling = false; // nodes still springing back after the cursor or a ripple
    let inside = false, lx = 0, ly = 0, R = 190;

    const addRipple = (x: number, y: number, amp: number) => {
      ripples.push({ x, y, t0: performance.now(), amp, hitOrb: false, r: 0, life: 1 });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
    };
    const offClick = onBackgroundClick((cx, cy) => {
      if (reduce || heroP.current >= 1) return;
      const { w, h } = canvasSize.current;
      const x = cx - canvasRect.current.left, y = cy - canvasRect.current.top;
      if (x < 0 || x > w || y < 0 || y > h) return;
      addRipple(x, y, 1);
      needsDraw.current = true;
    });

    /** Cursor, fast-move ripples, ripple ageing and the orb's echo. Runs every frame (cheap). */
    const listen = (now: number) => {
      const { w, h } = canvasSize.current;
      lx = pointer.x - canvasRect.current.left;
      ly = pointer.y - canvasRect.current.top;
      inside = !reduce && pointerActive() && lx >= 0 && lx <= w && ly >= 0 && ly <= h;
      R = Math.min(190, w / 5);
      // Moving fast = speaking: emit soft ripples.
      if (inside && pointer.speed > 0.9 && now - lastEmit > 240) {
        lastEmit = now;
        addRipple(lx, ly, clamp((pointer.speed - 0.6) / 2.2) * 0.55 + 0.15);
      }
      if (inside) pointer.speed *= 0.9;
      // Age ripples; the orb "hears" any ripple that reaches it.
      const { x: ox, y: oy, r: orbR } = orbCenter.current;
      for (let k = ripples.length - 1; k >= 0; k--) {
        const rp = ripples[k];
        rp.r = rippleRadius(now, rp.t0, RIPPLE_SPEED);
        rp.life = clamp(1 - rp.r / RIPPLE_LIFE);
        if (!rp.hitOrb && rp.r >= Math.hypot(ox - rp.x, oy - rp.y) - orbR) {
          rp.hitOrb = true;
          echo = Math.min(1, echo + rp.amp * rp.life * 1.1);
        }
        if (rp.life <= 0) ripples.splice(k, 1);
      }
      echo *= 0.95;
      if (echo < 0.001) echo = 0;
    };

    const drawNet = (now: number) => {
      if (!ctx) return;
      const { w, h } = canvasSize.current;
      if (!fitCanvas(canvas, ctx, w, h)) return;
      const tk = canvasTokens();
      const colours = [tk.ink, tk.coral, tk.teal, tk.lime];
      const t = reduce ? 0 : now / 1000;
      const { x: ox, y: oy } = orbCenter.current;

      // Node physics: drift + lean toward the cursor + ripple push, springing home.
      let motion = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        const home = NODE_HOME[i], n = nodes[i];
        const baseX = home.bx * w + Math.sin(t * 0.25 + home.p) * 14;
        const baseY = home.by * h + Math.cos(t * 0.2 + home.p) * 12;
        let tx = 0, ty = 0;
        if (inside) {
          const dx = lx - baseX, dy = ly - baseY, d = Math.hypot(dx, dy);
          if (d < R) { const f = (1 - d / R) * 0.28; tx += dx * f; ty += dy * f; }
        }
        for (const rp of ripples) {
          const dx = baseX - rp.x, dy = baseY - rp.y, d = Math.hypot(dx, dy) || 1;
          const front = 1 - Math.abs(d - rp.r) / RIPPLE_FRONT;
          if (front > 0) {
            const push = front * rp.amp * rp.life;
            tx += (dx / d) * push * RIPPLE_PUSH; ty += (dy / d) * push * RIPPLE_PUSH;
            n.flash = Math.max(n.flash, push);
          }
        }
        if (!reduce) {
          n.vx = (n.vx + (tx - n.ox) * 0.09) * 0.8;
          n.vy = (n.vy + (ty - n.oy) * 0.09) * 0.8;
          n.ox += n.vx; n.oy += n.vy;
        }
        n.flash *= 0.9;
        if (n.flash < 0.002) n.flash = 0;
        motion = Math.max(motion, Math.abs(n.ox) + Math.abs(n.oy) + n.flash * 10);
        pts[i].x = baseX + n.ox; pts[i].y = baseY + n.oy; pts[i].f = n.flash;
      }
      settling = motion > 0.3;

      ctx.lineWidth = 1;
      // Ripple rings.
      if (ripples.length) {
        ctx.strokeStyle = tk.teal;
        for (const rp of ripples) {
          ctx.globalAlpha = rp.amp * rp.life * 0.35;
          ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, 6.283); ctx.stroke();
        }
      }

      // Links, bucketed by colour and opacity step.
      const maxD = Math.min(190, w / 6);
      for (const b of buckets) b.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        const a = pts[i];
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          if (dx > maxD || dx < -maxD || dy > maxD || dy < -maxD) continue;
          const d = Math.hypot(dx, dy);
          if (d > maxD) continue;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const voice = clamp(1 - Math.hypot(mx - ox, my - oy) / 420) * orbLevel;
          const near = inside ? clamp(1 - Math.hypot(mx - lx, my - ly) / R) : 0;
          const wave = Math.max(a.f, b.f);
          const base = 1 - d / maxD;
          let col = 0, alpha = base * 0.14;
          if (voice > 0.08) { col = 1; alpha = base * (0.14 + 0.5 * voice); }
          if (near > 0.05 && near * 0.6 > voice) { col = 2; alpha = base * (0.16 + 0.6 * near); }
          if (wave > 0.12) { col = 3; alpha = Math.max(alpha, base * (0.2 + 0.7 * wave)); }
          const step = Math.min(ALPHA_STEPS - 1, Math.round((alpha / MAX_ALPHA[col]) * (ALPHA_STEPS - 1)));
          if (step === 0) continue;
          buckets[col * ALPHA_STEPS + step].push(i, j);
        }
      }
      for (let k = 0; k < buckets.length; k++) {
        const list = buckets[k];
        if (!list.length) continue;
        const col = Math.floor(k / ALPHA_STEPS);
        ctx.globalAlpha = ((k % ALPHA_STEPS) / (ALPHA_STEPS - 1)) * MAX_ALPHA[col];
        ctx.strokeStyle = colours[col];
        ctx.beginPath();
        for (let n = 0; n < list.length; n += 2) {
          ctx.moveTo(pts[list[n]].x, pts[list[n]].y);
          ctx.lineTo(pts[list[n + 1]].x, pts[list[n + 1]].y);
        }
        ctx.stroke();
      }

      // The cursor joins the network: threads to its 4 nearest nodes, a soft glow and a dot.
      if (inside) {
        const nearest: { i: number; d: number }[] = [];
        for (let i = 0; i < NODE_COUNT; i++) {
          const d = Math.hypot(pts[i].x - lx, pts[i].y - ly);
          if (d < R) nearest.push({ i, d });
        }
        nearest.sort((m, n2) => m.d - n2.d);
        ctx.strokeStyle = tk.teal;
        for (const o of nearest.slice(0, 4)) {
          ctx.globalAlpha = (1 - o.d / R) * 0.55;
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(pts[o.i].x, pts[o.i].y); ctx.stroke();
        }
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.7);
        g.addColorStop(0, tk.teal); g.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(lx, ly, R * 0.7, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = tk.teal;
        ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, 6.283); ctx.fill();
      }

      // Nodes: resting ones in one batched path; the few a wave lit up flash lime and grow.
      ctx.fillStyle = tk.ink;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      for (const p of pts) if (p.f <= 0.12) { ctx.moveTo(p.x + 1.8, p.y); ctx.arc(p.x, p.y, 1.8, 0, 6.283); }
      ctx.fill();
      ctx.fillStyle = tk.lime;
      for (const p of pts) {
        if (p.f <= 0.12) continue;
        ctx.globalAlpha = Math.min(1, 0.28 + 0.6 * p.f);
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8 + p.f * 2, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const setMode = (mode: "idle" | "live" | "echo") => {
      if (barsEl.dataset.mode === mode) return;
      barsEl.dataset.mode = mode;
      if (mode === "idle") for (const b of bars) b.style.transform = "";
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (heroP.current >= 1) return; // fully scrolled past: skip all hero work

      if (!reduce) listen(now);
      const src = session.agentSpeaking && session.agentAnalyser ? session.agentAnalyser : session.micAnalyser;
      if (src) {
        // Live: the bars follow the real audio, so they are written from here every frame.
        setMode("live");
        readBands(src, bands);
        let sum = 0;
        for (let i = 0; i < ORB_BARS; i++) {
          bars[i].style.transform = `scaleY(${barScale(i, bands[i]).toFixed(3)})`;
          sum += bands[i];
        }
        orbLevel += (clamp((sum / ORB_BARS) * 2.2) - orbLevel) * 0.2;
      } else if (echo > 0.02) {
        // Echo: a ripple reached the orb, so it reacts as if it heard you, then decays back to idle.
        setMode("echo");
        const t = now / 1000;
        for (let i = 0; i < ORB_BARS; i++) {
          const band = ENVELOPE[i] * (0.25 + 0.2 * Math.sin(t * 1.4 + i * 0.6) + echo * (0.45 + 0.4 * Math.sin(t * 14 + i * 1.9)));
          bars[i].style.transform = `scaleY(${barScale(i, band).toFixed(3)})`;
        }
        orbLevel += (echo * 0.7 - orbLevel) * 0.2;
      } else {
        // Idle: the breathing is a CSS animation (orb-bars[data-mode=idle]), run by the compositor
        // instead of 13 style writes per frame from here.
        setMode("idle");
        orbLevel += (0 - orbLevel) * 0.2;
        if (orbLevel < 0.0005) orbLevel = 0;
      }
      const level = orbLevel.toFixed(3);
      if (level !== lastLevel) { stage.style.setProperty("--level", level); lastLevel = level; }

      // Reduced motion: one static frame, redrawn only on scroll, resize or theme change.
      // The idle network drifts slowly: 30 fps is enough. Full rate while a voice session glows it, the
      // cursor is over it, ripples or the echo are running, or nodes are still springing home.
      const active = !!src || inside || ripples.length > 0 || echo > 0.01 || orbLevel > 0.001 || settling;
      const netDue = active || now - lastNet >= 32;
      if ((!reduce && netDue) || needsDraw.current) { drawNet(now); lastNet = now; }
      needsDraw.current = false;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); offClick(); };
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
