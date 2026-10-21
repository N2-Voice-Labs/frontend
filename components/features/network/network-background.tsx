"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type NetworkMode = "idle" | "active" | "signal";

type NetNode = { x: number; y: number; ox: number; oy: number; phase: number; quiet: number; heat: number; near: number; lift: number; links: number[] };
type Rgb = readonly [number, number, number];

const SPACING = 64;
const TAU = Math.PI * 2;
const FALLBACK_INK: Rgb = [29, 32, 34];
const FALLBACK_ACCENT: Rgb = [255, 98, 76];

/** Workspace areas choose the mode: calm where people work, signals on the agents landing. */
export function modeForPath(pathname: string): NetworkMode {
  if (/^\/agents\/[^/]+\/test\/?$/.test(pathname)) return "idle"; // a live voice session: nothing should move
  if (/^\/agents\/?$/.test(pathname)) return "signal";
  return "active";
}

/** Fixed, decorative node field behind the workspace. Mounted once by the dashboard layout. */
export function DashboardBackground() {
  return <NetworkBackground mode={modeForPath(usePathname() ?? "")} />;
}

/** The same field behind the landing hero: dimmed under the headline, signals travelling to the orb. */
export function HeroNetwork() {
  return <NetworkBackground variant="hero" mode="signal" />;
}

function readRgb(value: string, fallback: Rgb): Rgb {
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return fallback;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
};

/**
 * A sparse, slightly irregular field of nodes joined by faint lines.
 *   idle    nodes breathe
 *   active  + slow waves ripple through, and the cursor draws connections
 *   signal  + caller voices hop along the lines to an agent node, which answers with a pulse
 * The content column is dimmed so the work stays readable. The "hero" variant sits inside the landing hero
 * instead of fixed to the viewport: it dims the headline block, aims its signals at the orb, and pauses
 * once scrolled out of view. On phones that variant plays short bursts (one signal in, the orb answers) every
 * few seconds, or when the orb is tapped, and draws nothing in between; low-end and data-saver devices keep
 * the still frame. It pauses when the tab is hidden, and it
 * draws a single still frame under prefers-reduced-motion and on narrow screens. Colours come from the
 * workspace tokens (--ink, --accent) so both themes work; nothing here is audio and nothing is sent.
 */
export function NetworkBackground({ mode = "active", variant = "page" }: Readonly<{ mode?: NetworkMode; variant?: "page" | "hero" }>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrowQuery = window.matchMedia("(max-width: 899px)");
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    let W = 0, H = 0, raf = 0, last = performance.now(), t = 0;
    let onScreen = true;
    let burstTimer = 0;
    let nodes: NetNode[] = [];
    let core = -1;
    let coreRadius = 0; // hero: the orb's radius, so pulses leave its edge rather than hiding behind it
    let ink = FALLBACK_INK, accent = FALLBACK_ACCENT, strength = 1.6;
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: false };
    const waves: { x: number; y: number; r: number }[] = [];
    const signals: { path: number[]; u: number }[] = [];
    const pulses: { x: number; y: number; u: number }[] = [];
    let nextWave = 2.5, nextSignal = 1.2;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const still = () => motionQuery.matches || narrowQuery.matches;
    // Phones: bursts instead of a loop, and only where the device can spare the frames.
    const burstMode = () => {
      if (variant !== "hero" || !narrowQuery.matches || motionQuery.matches) return false;
      const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
      return !nav.connection?.saveData && (nav.hardwareConcurrency ?? 8) > 4 && (nav.deviceMemory ?? 8) >= 4;
    };
    const inkA = (a: number) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a.toFixed(3)})`;
    const accentA = (a: number) => `rgba(${accent[0]},${accent[1]},${accent[2]},${a.toFixed(3)})`;

    function readColors() {
      const styles = getComputedStyle(canvas!);
      ink = readRgb(styles.getPropertyValue("--ink"), FALLBACK_INK);
      accent = readRgb(styles.getPropertyValue("--accent"), FALLBACK_ACCENT);
      // Ink is light in the dark theme; dark ink on paper needs a little more strength to read.
      strength = ink[0] + ink[1] + ink[2] > 384 ? 1 : 1.6;
    }

    function build() {
      const rect = canvas!.getBoundingClientRect();
      W = rect.width; H = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, narrowQuery.matches ? 1.5 : 2);
      canvas!.width = Math.round(W * dpr); canvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed = 7; nodes = [];
      const columnHalf = Math.min(W - 48, 1200) / 2;
      const narrow = W < 760;
      const hero = variant === "hero";
      const scope = canvas!.parentElement;
      const boxOf = (selector: string) => {
        const el = scope?.querySelector(selector);
        if (!el) return null;
        const box = el.getBoundingClientRect();
        return { l: box.left - rect.left, t: box.top - rect.top, r: box.right - rect.left, b: box.bottom - rect.top };
      };
      const copy = hero ? boxOf(".hero-copy") : null;
      const orb = hero ? boxOf(".art-core") : null;
      for (let y = SPACING * 0.5; y < H + SPACING; y += SPACING * 0.87) {
        const row = Math.round(y / SPACING);
        for (let x = (row % 2) * SPACING * 0.5; x < W + SPACING; x += SPACING) {
          if (rand() < 0.28) continue; // sparse, irregular
          const nx = x + (rand() - 0.5) * SPACING * 0.6, ny = y + (rand() - 0.5) * SPACING * 0.5;
          // dim behind the content column; the gutters and the page head keep more of the field
          const beyond = Math.abs(nx - W / 2) - columnHalf;
          let quiet = narrow ? 0.35 : 0.3 + 0.7 * smooth(-60, 180, beyond);
          if (hero) {
            // dim behind the headline block; the rest of the hero keeps the field
            const gap = copy ? Math.hypot(Math.max(copy.l - 24 - nx, 0, nx - copy.r - 24), Math.max(copy.t - 24 - ny, 0, ny - copy.b - 24)) : 999;
            quiet = 0.1 + 0.9 * smooth(0, 200, gap);
          }
          nodes.push({ x: nx, y: ny, ox: 0, oy: 0, phase: rand() * TAU, quiet, heat: 0, near: 0, lift: 0, links: [] });
        }
      }
      const maxD = SPACING * 1.45;
      nodes.forEach((a, i) => {
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < maxD) { a.links.push(j); b.links.push(i); }
        }
      });
      // the agent node the signals head for: upper right in the page head, or the orb's centre in the hero
      const aimX = orb ? (orb.l + orb.r) / 2 : W * 0.84, aimY = orb ? (orb.t + orb.b) / 2 : H * 0.3;
      coreRadius = orb ? (orb.r - orb.l) / 2 : 0;
      let best = Infinity;
      core = -1;
      nodes.forEach((n, i) => {
        const d = Math.hypot(n.x - aimX, n.y - aimY);
        if (d < best) { best = d; core = i; }
      });
      if (core >= 0) nodes[core].quiet = 1;
      signals.length = 0; waves.length = 0; pulses.length = 0;
    }

    function spawnSignal() {
      if (core < 0) return;
      // start at a left or bottom edge node and walk greedily toward the agent, with some wander
      const starts = nodes.map((_, i) => i).filter((i) => variant === "hero"
        ? nodes[i].x > W * 0.45 && (nodes[i].x > W - 70 || nodes[i].y < 45 || nodes[i].y > H - 60) && (W >= 760 || nodes[i].y > nodes[core].y - 260)
        : nodes[i].x < W * 0.5 && (nodes[i].x < 40 || nodes[i].y > H - 40));
      if (!starts.length) return;
      let cur = starts[Math.floor(Math.random() * starts.length)];
      const path = [cur];
      const seen = new Set(path);
      const c = nodes[core];
      for (let k = 0; k < 60 && cur !== core; k++) {
        const options = nodes[cur].links.filter((j) => !seen.has(j));
        if (!options.length) break;
        options.sort((a, b) => Math.hypot(nodes[a].x - c.x, nodes[a].y - c.y) - Math.hypot(nodes[b].x - c.x, nodes[b].y - c.y));
        cur = Math.random() < 0.75 ? options[0] : options[Math.min(options.length - 1, 1)];
        path.push(cur); seen.add(cur);
      }
      if (path[path.length - 1] === core && path.length > 3) signals.push({ path, u: 0 });
    }

    function line(a: NetNode, b: NetNode) {
      ctx!.beginPath(); ctx!.moveTo(a.x + a.ox, a.y + a.oy); ctx!.lineTo(b.x + b.ox, b.y + b.oy); ctx!.stroke();
    }

    function draw(dt: number, m: NetworkMode) {
      ctx!.clearRect(0, 0, W, H);
      const reach = 150;
      for (let i = waves.length - 1; i >= 0; i--) { waves[i].r += dt * 160; if (waves[i].r > 520) waves.splice(i, 1); }

      nodes.forEach((n) => {
        let lift = 0;
        waves.forEach((w) => {
          const d = Math.abs(Math.hypot(n.x - w.x, n.y - w.y) - w.r);
          if (d < 26) lift += (1 - d / 26) * (1 - w.r / 520) * 0.6;
        });
        const pd = pointer.on ? Math.hypot(n.x - pointer.x, n.y - pointer.y) : 9999;
        const near = pd < reach ? 1 - pd / reach : 0;
        const tx = near ? ((n.x - pointer.x) / (pd || 1)) * near * 6 : 0;
        const ty = near ? ((n.y - pointer.y) / (pd || 1)) * near * 6 : 0;
        n.ox += (tx - n.ox) * 0.1; n.oy += (ty - n.oy) * 0.1;
        n.heat = Math.max(0, n.heat - dt * 0.8);
        n.near = near; n.lift = lift;
      });

      // the resting mesh: always legible, never loud
      ctx!.lineWidth = 1;
      nodes.forEach((a, ai) => a.links.forEach((j) => {
        if (j < ai) return;
        const b = nodes[j];
        const quiet = Math.min(a.quiet, b.quiet);
        const al = (0.05 * quiet + 0.25 * Math.min(a.lift, b.lift) * quiet) * strength;
        if (al < 0.012) return;
        ctx!.strokeStyle = inkA(al); line(a, b);
      }));

      if (pointer.on) {
        nodes.forEach((a, ai) => {
          if (a.near <= 0.15) return;
          a.links.forEach((j) => {
            const b = nodes[j];
            if (b.near <= 0.15 || j < ai) return;
            ctx!.strokeStyle = inkA(Math.min(a.near, b.near) * 0.28 * a.quiet * strength); line(a, b);
          });
        });
      }

      // signals: a coral comet hops along the edges and leaves a short lit trail
      for (let i = signals.length - 1; i >= 0; i--) {
        const s = signals[i];
        s.u += dt * 5;
        const k = Math.floor(s.u);
        for (let h = Math.max(0, k - 4); h < Math.min(k, s.path.length - 1); h++) {
          const a = nodes[s.path[h]], b = nodes[s.path[h + 1]];
          ctx!.strokeStyle = accentA(0.5 - (k - h) * 0.1); ctx!.lineWidth = 1.2; line(a, b);
          a.heat = Math.max(a.heat, 0.6);
        }
        if (k >= s.path.length - 1) {
          const c = nodes[core];
          c.heat = 1;
          pulses.push({ x: c.x + c.ox, y: c.y + c.oy, u: 0 });
          nodes.forEach((n) => { const d = Math.hypot(n.x - c.x, n.y - c.y); if (d < SPACING * 2.2) n.heat = Math.max(n.heat, 0.5 * (1 - d / (SPACING * 2.2))); });
          signals.splice(i, 1);
          continue;
        }
        const a = nodes[s.path[k]], b = nodes[s.path[k + 1]], f = s.u - k;
        const x = a.x + a.ox + (b.x + b.ox - a.x - a.ox) * f, y = a.y + a.oy + (b.y + b.oy - a.y - a.oy) * f;
        ctx!.strokeStyle = accentA(0.9); ctx!.lineWidth = 1.4;
        ctx!.beginPath(); ctx!.moveTo(a.x + a.ox, a.y + a.oy); ctx!.lineTo(x, y); ctx!.stroke();
        ctx!.fillStyle = accentA(1); ctx!.beginPath(); ctx!.arc(x, y, 2.4, 0, TAU); ctx!.fill();
      }

      // the agent answers: a coral ring, then an ink ring
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.u += dt / 1.6;
        if (p.u >= 1) { pulses.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - p.u, 3);
        ctx!.lineWidth = 1;
        ctx!.strokeStyle = accentA(0.7 * (1 - p.u));
        ctx!.beginPath(); ctx!.arc(p.x, p.y, coreRadius + 6 + e * 70, 0, TAU); ctx!.stroke();
        if (p.u > 0.25) { ctx!.strokeStyle = inkA(0.5 * (1 - p.u) * strength); ctx!.beginPath(); ctx!.arc(p.x, p.y, coreRadius + 10 + (e - 0.2) * 40, 0, TAU); ctx!.stroke(); }
      }

      nodes.forEach((n, i) => {
        const breath = 0.5 + 0.5 * Math.sin(t * 0.7 + n.phase);
        const a = Math.min(1, ((0.26 + breath * 0.16 + n.near * 0.55 + n.lift) * n.quiet + n.heat * 0.9) * (strength > 1 ? 1.1 : 1));
        const r = 1.2 + breath * 0.4 + n.near * 0.9 + n.heat * 1.2 + (i === core ? 0.8 : 0);
        ctx!.fillStyle = n.heat > 0.05 ? accentA(Math.min(1, a)) : inkA(a);
        ctx!.beginPath(); ctx!.arc(n.x + n.ox, n.y + n.oy, r, 0, TAU); ctx!.fill();
      });
      if (core >= 0 && m === "signal" && !coreRadius) {
        const c = nodes[core];
        ctx!.strokeStyle = inkA(0.2 * strength); ctx!.lineWidth = 1;
        ctx!.beginPath(); ctx!.arc(c.x + c.ox, c.y + c.oy, 9, 0, TAU); ctx!.stroke();
      }
    }

    function frame(now: number) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      const burst = still();
      const m = burst ? "idle" : modeRef.current;
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      if (!burst && m !== "idle") {
        nextWave -= dt;
        if (nextWave <= 0) {
          nextWave = 5 + Math.random() * 3;
          const n = nodes[Math.floor(Math.random() * nodes.length)];
          if (n) waves.push({ x: n.x, y: n.y, r: 0 });
        }
      }
      if (!burst && m === "signal") {
        nextSignal -= dt;
        if (nextSignal <= 0) { nextSignal = 3.2 + Math.random() * 2.4; spawnSignal(); }
      }
      draw(dt, m);
      if (burst && !signals.length && !pulses.length) {
        // the burst is over: settle on the still frame and wait for the next one
        nodes.forEach((n) => { n.heat = 0; });
        draw(0, "idle");
        scheduleBurst(4500 + Math.random() * 2000);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function startFrames() {
      if (raf || !onScreen || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function scheduleBurst(delay: number) {
      window.clearTimeout(burstTimer);
      burstTimer = window.setTimeout(() => {
        if (!burstMode() || !onScreen || document.hidden) return; // sync() restarts it when visible again
        spawnSignal();
        if (signals.length) startFrames(); else scheduleBurst(1500);
      }, delay);
    }

    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; window.clearTimeout(burstTimer); };
    // One place decides between animating and a single still frame.
    const sync = () => {
      stop();
      if (still()) {
        draw(0, "idle");
        if (burstMode() && onScreen && !document.hidden) scheduleBurst(2500);
      } else if (!document.hidden && onScreen) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    readColors();
    build();
    sync();

    const resize = new ResizeObserver(() => { build(); sync(); });
    resize.observe(canvas);
    // A canvas inside the hero has nothing to draw once it has scrolled away.
    const visibility = variant === "hero" && typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); })
      : null;
    visibility?.observe(canvas);
    const theme = new MutationObserver(() => { readColors(); if (still()) draw(0, "idle"); });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-vl-theme"] });
    document.addEventListener("visibilitychange", sync);
    motionQuery.addEventListener("change", sync);
    narrowQuery.addEventListener("change", sync);

    // The canvas sits behind the content, so the pointer is tracked on the window, in canvas coordinates.
    const onMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      pointer.tx = event.clientX - box.left; pointer.ty = event.clientY - box.top;
      if (pointer.tx < 0 || pointer.ty < 0 || pointer.tx > box.width || pointer.ty > box.height) { pointer.on = false; return; }
      if (!pointer.on) { pointer.x = pointer.tx; pointer.y = pointer.ty; }
      pointer.on = true;
    };
    const onLeave = () => { pointer.on = false; };
    // A tap on the hero orb sends one signal in now, whatever mode the field is in.
    const onPing = () => {
      if (variant !== "hero" || motionQuery.matches || !onScreen || signals.length > 3) return;
      spawnSignal();
      if (signals.length && still()) startFrames();
    };
    window.addEventListener("vl:orb-ping", onPing);
    if (finePointer) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }

    return () => {
      stop();
      resize.disconnect();
      visibility?.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motionQuery.removeEventListener("change", sync);
      narrowQuery.removeEventListener("change", sync);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("vl:orb-ping", onPing);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={variant === "hero" ? "hero-network" : "network-bg"} data-mode={mode} aria-hidden="true" />;
}
