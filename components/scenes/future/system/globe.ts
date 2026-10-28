import { isPortrait } from "@/components/scenes/bridge/geometry";
import { BEATS } from "../beats";

/**
 * The world made of voices: ONE model shared by the canvas (distant points, arcs, depth), the SVG
 * foreground (a few important connections, the final signal and waveform) and the typography.
 *
 * - NODES: people talking, clustered unevenly around real places (irregular density, quiet areas).
 *   Node 0 is Seoul and TORONTO (the first node of region 1) Toronto: chapter 07's conversation.
 * - CONNECTIONS: who is talking to whom: nearby links, links across oceans, chains through several nodes.
 *   Connection 0 is Seoul ↔ Toronto. Each has a slow pulse → response rhythm (pulseAt).
 * - frameAt(p): the camera at chapter progress p. At p = 0 every node sits on one point (chapter 07's point
 *   of light); the flat network spreads out from it (nearest first), wraps into a globe, pulls far back,
 *   turns Seoul to the front, then zooms in until Seoul is the screen centre (the single voice).
 */

export type Tag = "KO" | "EN" | "JA" | "ES" | "FR" | "AR" | "ZH" | "HI";
export type GeoNode = { i: number; lat: number; lon: number; region: number; tag: Tag | null; order: number; size: number };
export type Connection = { k: number; a: number; b: number; period: number; phase: number; far: boolean };

const REGIONS: readonly { lat: number; lon: number; n: number; spread: number; tag: Tag | null }[] = [
  { lat: 37.5, lon: 127, n: 14, spread: 4, tag: "KO" }, // Seoul
  { lat: 43.7, lon: -79.4, n: 14, spread: 5, tag: "EN" }, // Toronto
  { lat: 35.7, lon: 139.7, n: 14, spread: 4, tag: "JA" },
  { lat: 31.2, lon: 121.5, n: 22, spread: 7, tag: "ZH" },
  { lat: 28.6, lon: 77.2, n: 22, spread: 7, tag: "HI" },
  { lat: 24.7, lon: 46.7, n: 12, spread: 6, tag: "AR" },
  { lat: 48.8, lon: 2.3, n: 16, spread: 5, tag: "FR" },
  { lat: 40.4, lon: -3.7, n: 8, spread: 4, tag: "ES" },
  { lat: 19.4, lon: -99.1, n: 12, spread: 6, tag: "ES" },
  { lat: 40.7, lon: -74, n: 12, spread: 4, tag: null },
  { lat: 51.5, lon: -0.1, n: 12, spread: 4, tag: null },
  { lat: 6.5, lon: 3.4, n: 10, spread: 6, tag: null },
  { lat: -1.3, lon: 36.8, n: 8, spread: 6, tag: null },
  { lat: -23.5, lon: -46.6, n: 12, spread: 7, tag: null },
  { lat: -33.9, lon: 151.2, n: 8, spread: 5, tag: null },
  { lat: -6.2, lon: 106.8, n: 12, spread: 6, tag: null },
];

const hash = (a: number, b: number) => {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const RAD = Math.PI / 180;
const smooth = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const range = (v: number, a: number, b: number) => smooth((v - a) / (b - a));

/** Great-circle angle between two lat/lon points (radians). */
function arc(aLat: number, aLon: number, bLat: number, bLon: number) {
  const s = Math.sin(aLat * RAD) * Math.sin(bLat * RAD) + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.cos((bLon - aLon) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, s)));
}

export const NODES: readonly GeoNode[] = (() => {
  const out: GeoNode[] = [];
  REGIONS.forEach((r, ri) => {
    for (let k = 0; k < r.n; k++) {
      const first = k === 0;
      const a = hash(ri * 31 + k, 1) * Math.PI * 2, d = first ? 0 : r.spread * Math.sqrt(hash(ri * 31 + k, 2));
      out.push({
        i: 0, lat: r.lat + Math.sin(a) * d * 0.7, lon: r.lon + Math.cos(a) * d, region: ri,
        tag: first ? r.tag : null, order: 0, size: first ? 1 : 0.5 + 0.5 * hash(ri * 31 + k, 3),
      });
    }
  });
  // Appearance order: nearest to the conversation first (Seoul or Toronto), with a little irregularity.
  const far = Math.max(...out.map((n) => Math.min(arc(n.lat, n.lon, 37.5, 127), arc(n.lat, n.lon, 43.7, -79.4))));
  out.forEach((n, i) => {
    n.i = i;
    const d = Math.min(arc(n.lat, n.lon, 37.5, 127), arc(n.lat, n.lon, 43.7, -79.4));
    n.order = i === 0 || (n.region === 1 && n.tag) ? 0 : Math.min(1, 0.06 + 0.8 * (d / far) + 0.14 * hash(i, 9));
  });
  return out;
})();

/** Index of the first node of region r. */
export const FIRST = REGIONS.map((_, r) => NODES.findIndex((n) => n.region === r));

/** Toronto: the other end of chapter 07's conversation. */
export const TORONTO = FIRST[1];

export const CONNECTIONS: readonly Connection[] = (() => {
  const out: Connection[] = [];
  const add = (a: number, b: number, far: boolean) => out.push({ k: out.length, a, b, period: 7 + 5 * hash(out.length, 4), phase: hash(out.length, 5), far });
  add(0, FIRST[1], true); // Seoul ↔ Toronto
  // Across oceans: hubs to hubs, irregularly.
  const cross: [number, number][] = [[0, 2], [0, 3], [3, 4], [4, 5], [5, 6], [6, 10], [10, 9], [9, 1], [1, 8], [8, 13], [6, 11], [11, 12], [4, 15], [15, 14], [2, 14], [7, 13], [12, 5], [9, 6], [3, 15]];
  for (const [a, b] of cross) add(FIRST[a], FIRST[b], true);
  // Nearby: a few links inside regions (a chain through several nodes).
  REGIONS.forEach((_, r) => {
    const nodes = NODES.filter((n) => n.region === r);
    const links = Math.min(nodes.length - 1, 1 + Math.floor(hash(r, 6) * 3));
    for (let k = 0; k < links; k++) add(nodes[k].i, nodes[k + 1].i, false);
  });
  return out;
})();

/** Pulse → response on connection c at time t (s): which way and how far along (0–1), or null between. */
export function pulseAt(c: Connection, t: number): { from: number; to: number; s: number } | null {
  const f = ((t / c.period + c.phase) % 1 + 1) % 1;
  if (f < 0.32) return { from: c.a, to: c.b, s: f / 0.32 };
  if (f >= 0.45 && f < 0.77) return { from: c.b, to: c.a, s: (f - 0.45) / 0.32 };
  return null;
}

// ---------------------------------------------------------------- camera

export type GlobeFrame = {
  w: number; h: number; portrait: boolean;
  /** Screen centre of the globe (px). */
  cx: number; cy: number;
  /** Globe radius (px). */
  R: number;
  /** 0 = flat network (spreading from the point), 1 = sphere. */
  form: number;
  /** Flat network scale, px per degree. */
  k: number;
  /** Rotation (radians added to longitude) and tilt (radians). */
  spin: number; tilt: number;
  /** Longitude at the front when spin = 0 (the Pacific, between Seoul and Toronto). */
  lon0: number;
  /** Language labels: 1 visible → 0 gone. */
  labels: number;
  /** 0 → 1 as the camera goes in on Seoul. */
  focus: number;
};

const LON0 = -156;
const SEOUL = NODES[0];

export function frameAt(p: number, w: number, h: number, t: number): GlobeFrame {
  const portrait = isPortrait(w, h);
  const u = Math.min(w, h);
  const form = range(p, BEATS.form[0], BEATS.form[1]);
  // The flat network spreads out of the point: px per degree grows from 0.
  const kMax = (portrait ? w * 2.2 : w * 1.5) / 360;
  const k = kMax * range(p, 0.01, BEATS.form[0] + 0.02) ** 1.6;
  let R = u * (portrait ? 0.4 : 0.34) * (1 - 0.58 * range(p, BEATS.far[0], BEATS.far[1]));
  // A slow, steady turn; before the focus Seoul is brought round to the front (shortest way).
  let spin = (t * 0.018 + p * 0.9) % (Math.PI * 2);
  const turn = range(p, BEATS.focus[0] - 0.03, BEATS.focus[0] + 0.03);
  if (turn > 0) {
    const target = (LON0 - SEOUL.lon) * RAD;
    let d = (target - spin) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    spin += d * turn;
  }
  const tilt = 0.32;
  // The push-in: the globe grows exponentially while Seoul slides to the screen centre.
  const focus = range(p, BEATS.focus[0], BEATS.focus[1] - 0.01);
  let cx = w / 2, cy = h / 2;
  if (focus > 0) {
    const R0 = R;
    R = R0 * Math.pow(80, focus * focus);
    const q = projectUnit(SEOUL.lat, SEOUL.lon, spin, tilt, LON0);
    cx = w / 2 - q.x * R * focus ** 0.5;
    cy = h / 2 - q.y * R * focus ** 0.5;
  }
  const labels = 1 - range(p, BEATS.unlabel[0], BEATS.unlabel[1]);
  return { w, h, portrait, cx, cy, R, form, k, spin, tilt, lon0: LON0, labels, focus };
}

/** Unit-sphere projection: x right, y down, z toward the viewer. */
export function projectUnit(lat: number, lon: number, spin: number, tilt: number, lon0 = LON0) {
  const la = lat * RAD, lo = (lon - lon0) * RAD + spin;
  const x = Math.cos(la) * Math.sin(lo), y0 = -Math.sin(la), z0 = Math.cos(la) * Math.cos(lo);
  return { x, y: y0 * Math.cos(tilt) - z0 * Math.sin(tilt), z: y0 * Math.sin(tilt) + z0 * Math.cos(tilt) };
}

/** Screen position of a lat/lon at frame F (flat → sphere by F.form). `z` is 1 in front, -1 behind. */
export function place(lat: number, lon: number, F: GlobeFrame, o = { x: 0, y: 0, z: 1 }) {
  const s = projectUnit(lat, lon, F.spin, F.tilt, F.lon0);
  const dl = ((lon - F.lon0) % 360 + 540) % 360 - 180;
  const fx = F.w / 2 + dl * F.k, fy = F.h / 2 - (lat - 15) * F.k;
  o.x = fx + (F.cx + s.x * F.R - fx) * F.form;
  o.y = fy + (F.cy + s.y * F.R - fy) * F.form;
  o.z = 1 + (s.z - 1) * F.form;
  return o;
}

/** A connection as a quadratic arc lifted off the sphere (screen px), for drawing and for pulses. */
export function arcPoints(c: Connection, F: GlobeFrame) {
  const A = place(NODES[c.a].lat, NODES[c.a].lon, F), B = place(NODES[c.b].lat, NODES[c.b].lon, F, { x: 0, y: 0, z: 1 });
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  const lift = c.far ? 1.28 : 1.06;
  const K = F.form > 0.01
    ? { x: F.cx + (mx - F.cx) * lift, y: F.cy + (my - F.cy) * lift }
    : { x: mx, y: my - Math.hypot(B.x - A.x, B.y - A.y) * 0.18 };
  return { A, B, K, front: Math.min(A.z, B.z) };
}

export function quadAt(A: { x: number; y: number }, K: { x: number; y: number }, B: { x: number; y: number }, s: number) {
  const m = 1 - s;
  return { x: m * m * A.x + 2 * m * s * K.x + s * s * B.x, y: m * m * A.y + 2 * m * s * K.y + s * s * B.y };
}

/** How present a node is at p: nearest first, all by the time the globe forms. */
export const nodeAppear = (n: GeoNode, p: number) => range(p, 0.015 + n.order * 0.17, 0.035 + n.order * 0.17);
