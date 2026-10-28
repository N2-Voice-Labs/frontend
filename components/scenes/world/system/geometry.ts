import { isPortrait } from "@/components/scenes/bridge/geometry";
import { rnd } from "@/lib/cinematic/visual";
import { WORLDS, type WorldId } from "../beats";

/**
 * Chapter 06 laid out in WORLD space, shared by the SVG system and the canvas. At camera zoom 1 centred
 * on the screen the runtime and its seven worlds fill the viewport (the `agents` beat); the camera starts
 * close on the runtime (chapter 05's outgoing signal), pulls back past the worlds to a world-scale network
 * of regions and cities, then goes in again on one conversation. World units are viewport px at zoom 1.
 */

export { isPortrait };
export type P2 = { x: number; y: number };
/** Camera: centre as fractions of w/h, zoom. */
export type Cam = { cx: number; cy: number; z: number };

export const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

/** Where each world sits at zoom 1 (fractions of w/h): desktop around the runtime, portrait in two columns. */
const AT: Record<WorldId, { L: P2; P: P2 }> = {
  support: { L: { x: 0.29, y: 0.24 }, P: { x: 0.27, y: 0.25 } },
  sales: { L: { x: 0.24, y: 0.54 }, P: { x: 0.25, y: 0.66 } },
  booking: { L: { x: 0.77, y: 0.54 }, P: { x: 0.75, y: 0.64 } },
  transport: { L: { x: 0.36, y: 0.8 }, P: { x: 0.27, y: 0.85 } },
  restaurants: { L: { x: 0.72, y: 0.24 }, P: { x: 0.74, y: 0.33 } },
  healthcare: { L: { x: 0.66, y: 0.8 }, P: { x: 0.73, y: 0.86 } },
  callcenters: { L: { x: 0.5, y: 0.19 }, P: { x: 0.72, y: 0.165 } },
};

/** Regions of the world-scale network: centres as offsets from the runtime in fractions of w/h. */
const REGIONS: readonly P2[] = [
  { x: -0.98, y: -0.46 }, { x: 0.9, y: -0.4 }, { x: -0.92, y: 0.55 }, { x: 0.86, y: 0.66 },
  { x: -0.12, y: -1.02 }, { x: 0.18, y: 1.04 }, { x: 1.08, y: 0.1 }, { x: -1.4, y: 0.04 },
];
const CITIES = 7;
/** The conversation that becomes chapter 07: region 1, city 0. */
const SEL = { region: 1, city: 0 };

export function worldGeometry(w: number, h: number) {
  const portrait = isPortrait(w, h);
  const S = Math.min(w, h);
  const c: P2 = { x: w / 2, y: h * (portrait ? 0.47 : 0.5) };
  /** A world's scale: its wave spans ±1.6 sz. */
  const sz = Math.max(24, Math.min(44, S * (portrait ? 0.075 : 0.048)));
  /** The runtime: a short living path with the reasoning ring at its centre. */
  const rw = portrait ? w * 0.2 : Math.min(w * 0.11, 170);
  const ring = S * (portrait ? 0.04 : 0.032);

  const quadAt = (a: P2, k: P2, b: P2, t: number): P2 => {
    const m = 1 - t;
    return { x: m * m * a.x + 2 * m * t * k.x + t * t * b.x, y: m * m * a.y + 2 * m * t * k.y + t * t * b.y };
  };
  const curve = (a: P2, b: P2, bend: number) => {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const k = { x: (a.x + b.x) / 2 - (dy / len) * len * bend, y: (a.y + b.y) / 2 + (dx / len) * len * bend };
    return { a, k, b, len, d: `M${n2(a.x)} ${n2(a.y)}Q${n2(k.x)} ${n2(k.y)} ${n2(b.x)} ${n2(b.y)}`, at: (t: number) => quadAt(a, k, b, t) };
  };

  const worlds = WORLDS.map((wd, i) => {
    const f = AT[wd.id][portrait ? "P" : "L"];
    const p = { x: f.x * w, y: f.y * h };
    const dx = c.x - p.x, dy = c.y - p.y, l = Math.hypot(dx, dy) || 1;
    // The path leaves the runtime's ring and arrives at the edge of the world's wave (an ellipse around it).
    const ux = dx / l, uy = dy / l;
    const e = 1 / Math.hypot(ux / (1.9 * sz), uy / (0.8 * sz));
    const end = { x: p.x + ux * e, y: p.y + uy * e };
    const start = { x: c.x - ux * ring * 1.15, y: c.y - uy * ring * 1.15 };
    const path = curve(start, end, (i % 2 ? 1 : -1) * 0.12);
    // Worlds above the runtime keep their words above them, out of the path's way.
    return { ...wd, i, p, path, above: p.y < c.y - h * 0.08 };
  });

  const regions = REGIONS.map((o, r) => {
    const rc = { x: c.x + o.x * w, y: c.y + o.y * h };
    const cities = Array.from({ length: CITIES }, (_, k) => {
      if (k === 0) return rc;
      const a = rnd(r * 13 + k, 1) * Math.PI * 2, d = S * (0.06 + 0.14 * rnd(r * 13 + k, 2));
      return { x: rc.x + Math.cos(a) * d * (portrait ? 0.8 : 1.3), y: rc.y + Math.sin(a) * d };
    });
    // Each region is a little loop of cities around its hub, tied back to the runtime by one long arc.
    const ring = cities.slice(1).sort((a, b) => Math.atan2(a.y - rc.y, a.x - rc.x) - Math.atan2(b.y - rc.y, b.x - rc.x));
    let chain = "";
    ring.forEach((q, k) => { chain += `M${n2(rc.x)} ${n2(rc.y)}L${n2(q.x)} ${n2(q.y)}`; if (k) chain += `M${n2(ring[k - 1].x)} ${n2(ring[k - 1].y)}L${n2(q.x)} ${n2(q.y)}`; });
    const arc = curve(c, rc, (r % 2 ? 1 : -1) * 0.16);
    return { r, c: rc, cities, chain, arc };
  });
  // Neighbouring regions are linked directly too (around the runtime, by angle).
  const order = [...regions].sort((a, b) => Math.atan2(a.c.y - c.y, a.c.x - c.x) - Math.atan2(b.c.y - c.y, b.c.x - c.x));
  const links = order.map((a, k) => curve(a.c, order[(k + 1) % order.length].c, 0.1));
  const sel = regions[SEL.region].cities[SEL.city];

  return {
    w, h, S, portrait, c, sz, rw, ring, worlds, regions, links, sel, curve,
    vars: { "--W": `${w}px`, "--H": `${h}px` } as Record<string, string>,
  };
}

export type Geo = ReturnType<typeof worldGeometry>;
export type WorldGeo = Geo["worlds"][number];

/** Where the selected conversation's line runs at the end (px): clear of the chapter list on desktop. */
export const endSpan = (w: number) => {
  const x0 = w <= 720 ? w * 0.06 : Math.max(w * 0.17, 240);
  return { x0, x1: w - x0 };
};

// ---------------------------------------------------------------- camera

const smooth = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));

/** Pull-back keys (chapter progress → camera), then the move in on the selected conversation. */
function keys(portrait: boolean) {
  const far = portrait ? 0.46 : 0.42;
  return [
    { p: 0.0, z: 3.2, cx: 0.5, cy: portrait ? 0.47 : 0.5 },
    { p: 0.03, z: 3.2, cx: 0.5, cy: portrait ? 0.47 : 0.5 },
    // Pulled back far enough by the time the first world appears that every world lands on screen.
    { p: 0.17, z: portrait ? 1.08 : 1.22, cx: 0.5, cy: portrait ? 0.48 : 0.5 },
    { p: 0.44, z: 1, cx: 0.5, cy: 0.5 },
    { p: 0.74, z: 0.9, cx: 0.515, cy: 0.49 },
    { p: 0.865, z: far, cx: 0.5, cy: 0.5 },
  ];
}
/** The move in: from the far network to a close-up on the selected conversation (zoom IN_Z). */
const IN = [0.865, 0.975] as const;
const IN_Z = 18;

/** Camera at chapter progress p; `sel` is the selected conversation as fractions of w/h. */
export function cameraAt(p: number, portrait: boolean, sel: P2): Cam {
  const K = keys(portrait);
  if (p >= IN[0]) {
    // Zoom in exponentially while the selected point slides smoothly to the screen centre.
    const k = K[K.length - 1];
    const t = smooth((p - IN[0]) / (IN[1] - IN[0]));
    const z = k.z * Math.pow(IN_Z / k.z, t * t * (1.6 - 0.6 * t));
    const ox = (sel.x - k.cx) * k.z * (1 - t), oy = (sel.y - k.cy) * k.z * (1 - t);
    return { z, cx: sel.x - ox / z, cy: sel.y - oy / z };
  }
  let j = 0;
  while (j < K.length - 2 && p >= K[j + 1].p) j++;
  const a = K[j], b = K[j + 1];
  const t = smooth((p - a.p) / (b.p - a.p));
  return { z: a.z * Math.pow(b.z / a.z, t), cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t };
}

/** World → screen through the camera. */
export function toScreen(q: P2, cam: Cam, w: number, h: number, o: P2 = { x: 0, y: 0 }): P2 {
  o.x = w / 2 + (q.x - cam.cx * w) * cam.z;
  o.y = h / 2 + (q.y - cam.cy * h) * cam.z;
  return o;
}

/** The camera as an SVG transform attribute (px at the current size). */
export const camTransform = (cam: Cam, w: number, h: number) =>
  `translate(${n2(w / 2)} ${n2(h / 2)}) scale(${cam.z.toFixed(5)}) translate(${n2(-cam.cx * w)} ${n2(-cam.cy * h)})`;

/**
 * A world's conversational activity at time t (0–1): turns of `duty` speech in each `period`, softened at
 * the edges; worlds that interrupt cut a turn short now and then; a little syllable flicker on top.
 */
export function activity(i: number, t: number) {
  const b = WORLDS[i].act;
  const ph = ((t / b.period + i * 0.37) % 1 + 1) % 1;
  let on = smooth(ph / 0.06) * (1 - smooth((ph - b.duty) / 0.06));
  if (b.interrupts && Math.sin(t * 1.7 + i * 2.1) > 0.82) on *= 0.1;
  const syl = 0.6 + 0.4 * Math.abs(Math.sin(t * 6.3 + i));
  return on * syl * b.level;
}
/** Whether a world's turn is the caller (in: towards the runtime) or the agent (out: back to the world). */
export const turnIn = (i: number, t: number) => Math.floor(t / WORLDS[i].act.period + i * 0.37) % 2 === 0;
