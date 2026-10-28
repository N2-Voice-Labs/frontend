import type { Speaker } from "../conversation-events";

/**
 * PortraitMotion: the two people as living graphite profiles, not avatars. Each profile is a few hand-set
 * contours (face, back of the head, jaw, ear, brow, hair) in head units facing +x; every frame they are
 * re-drawn as several jittered graphite passes and a little hatching. The jitter re-seeds slowly while
 * idle and quickly while speaking (the strokes "boil"), the lips part with the voice, the eyes blink.
 */

type Pt = readonly [number, number];
type Face = { front: Pt[]; back: Pt[]; jaw: Pt[]; ear: Pt[]; brow: Pt[]; hair: Pt[][]; eye: Pt; eyeW: number };

/** Index of the stomion (where the lips meet) in `front`; the points after it move with the jaw. */
const STOMION = 11;

const MINJI: Face = {
  front: [[-0.04, -0.56], [0.1, -0.52], [0.2, -0.42], [0.25, -0.28], [0.255, -0.17], [0.235, -0.11], [0.28, -0.02], [0.345, 0.07], [0.33, 0.1], [0.285, 0.115], [0.3, 0.165], [0.285, 0.2], [0.295, 0.235], [0.255, 0.28], [0.27, 0.34], [0.22, 0.41], [0.12, 0.45], [0.08, 0.52], [0.09, 0.8]],
  back: [[-0.04, -0.56], [-0.24, -0.5], [-0.38, -0.32], [-0.42, -0.08], [-0.36, 0.16], [-0.24, 0.32], [-0.2, 0.5], [-0.22, 0.8]],
  jaw: [[0.2, 0.38], [0.02, 0.34], [-0.1, 0.18]],
  ear: [[-0.07, -0.04], [-0.13, -0.06], [-0.16, 0.02], [-0.14, 0.1], [-0.09, 0.12]],
  brow: [[0.1, -0.17], [0.19, -0.185], [0.24, -0.165]],
  hair: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => {
    const o = k * 0.025;
    return [[0.16 - o * 0.6, -0.5 - o * 0.3], [0.0 - o, -0.6 - o * 0.2], [-0.28 - o, -0.52], [-0.46 - o * 0.5, -0.18], [-0.47 - o * 0.4, 0.22], [-0.4 - o * 0.3, 0.55 + o], [-0.34 - o * 0.2, 0.88 + o * 0.5]] as Pt[];
  }),
  eye: [0.175, -0.1],
  eyeW: 0.065,
};

const DANIEL: Face = {
  front: [[-0.04, -0.57], [0.12, -0.53], [0.22, -0.42], [0.26, -0.27], [0.275, -0.17], [0.245, -0.1], [0.3, -0.01], [0.37, 0.08], [0.35, 0.11], [0.3, 0.125], [0.31, 0.17], [0.295, 0.205], [0.305, 0.24], [0.27, 0.28], [0.29, 0.36], [0.25, 0.44], [0.14, 0.47], [0.11, 0.54], [0.12, 0.82]],
  back: [[-0.04, -0.57], [-0.25, -0.52], [-0.4, -0.33], [-0.43, -0.07], [-0.37, 0.17], [-0.27, 0.33], [-0.25, 0.52], [-0.27, 0.82]],
  jaw: [[0.24, 0.43], [0.04, 0.38], [-0.12, 0.2]],
  ear: [[-0.07, -0.05], [-0.14, -0.07], [-0.17, 0.02], [-0.15, 0.11], [-0.09, 0.13]],
  brow: [[0.1, -0.18], [0.2, -0.2], [0.265, -0.175]],
  hair: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
    const o = k * 0.02;
    return [[0.2 - o, -0.47 - o * 0.5], [0.04 - o, -0.6 - o * 0.15], [-0.22 - o * 0.5, -0.58], [-0.38 - o * 0.3, -0.42], [-0.44, -0.2 + o]] as Pt[];
  }),
  eye: [0.185, -0.095],
  eyeW: 0.06,
};

const FACES: Record<Speaker, Face> = { minji: MINJI, daniel: DANIEL };

const hash = (a: number, b: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const f3 = (v: number) => (Math.round(v * 1000) / 1000).toString();

/** A smooth stroke through the points (quadratic midpoints), each point nudged by `j` (seeded). */
function stroke(pts: readonly Pt[], j: number, seed: number) {
  const P = pts.map(([x, y], i) => [x + (hash(seed, i * 2) - 0.5) * j, y + (hash(seed, i * 2 + 1) - 0.5) * j] as const);
  let d = `M${f3(P[0][0])} ${f3(P[0][1])}`;
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
    d += `Q${f3(P[i][0])} ${f3(P[i][1])} ${f3(mx)} ${f3(my)}`;
  }
  const L = P[P.length - 1];
  return d + `L${f3(L[0])} ${f3(L[1])}`;
}

export type PortraitPose = {
  /** 0–1: lips apart (the voice). */
  open: number;
  /** 0–1: eyelids closed. */
  blink: number;
  /** Graphite re-seed counter: changes faster while speaking. */
  epoch: number;
};

export type PortraitPaths = { main: string; soft: string; hatch: string; eye: string; mouth: string };

/** The portrait's strokes in head units, facing +x (the scene mirrors Daniel). */
export function portraitPaths(who: Speaker, pose: PortraitPose): PortraitPaths {
  const F = FACES[who];
  const front = F.front.map(([x, y], i): Pt => {
    if (i < STOMION) return [x, y];
    if (i === STOMION) return [x - pose.open * 0.012, y + pose.open * 0.012];
    const k = i <= STOMION + 3 ? 1 : i <= STOMION + 5 ? 0.7 : 0.35;
    return [x, y + pose.open * 0.04 * k];
  });
  const jaw = F.jaw.map(([x, y], i): Pt => [x, y + pose.open * 0.03 * (1 - i / F.jaw.length)]);
  const s = pose.epoch * 17 + (who === "minji" ? 0 : 500);
  const contours = [front, F.back, jaw, F.ear, F.brow];

  let main = "", soft = "", hatch = "";
  contours.forEach((c, k) => {
    main += stroke(c, 0.006, s + k * 7);
    soft += stroke(c, 0.018, s + k * 7 + 3) + stroke(c, 0.012, s + k * 7 + 5);
  });
  F.hair.forEach((c, k) => {
    if (k % 3) soft += stroke(c, 0.02, s + 100 + k);
    else main += stroke(c, 0.01, s + 100 + k);
  });
  // Graphite shading: short diagonal strokes in the shadow under the ear and along the neck.
  for (let k = 0; k < 18; k++) {
    const x = -0.2 + 0.24 * hash(s + 200, k), y = 0.16 + 0.34 * hash(s + 201, k), l = 0.05 + 0.04 * hash(s + 202, k);
    hatch += `M${f3(x)} ${f3(y)}l${f3(l * 0.55)} ${f3(-l)}`;
  }
  // The eye: an almond and its lid; blinking flattens it.
  const [ex, ey] = F.eye, w = F.eyeW, hgt = 0.022 * (1 - pose.blink);
  const eye = `M${f3(ex - w / 2)} ${f3(ey)}Q${f3(ex)} ${f3(ey - hgt)} ${f3(ex + w / 2)} ${f3(ey + 0.004)}Q${f3(ex)} ${f3(ey + hgt * 0.6)} ${f3(ex - w / 2)} ${f3(ey)}`
    + `M${f3(ex - w * 0.6)} ${f3(ey - 0.03)}Q${f3(ex)} ${f3(ey - 0.045)} ${f3(ex + w * 0.55)} ${f3(ey - 0.022)}`;
  const [sx, sy] = front[STOMION];
  const mouth = pose.open > 0.02 ? `M${f3(sx)} ${f3(sy)}q${f3(-0.03)} ${f3(pose.open * 0.01)} ${f3(-0.05)} ${f3(-0.004)}` : "M0 0";
  return { main, soft, hatch, eye, mouth };
}

/** Eyes close briefly every few seconds, never in step between the two. */
export function blinkAt(who: Speaker, t: number) {
  const period = who === "minji" ? 4.3 : 5.1;
  const ph = ((t + (who === "minji" ? 0.7 : 2.4)) % period + period) % period;
  return ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
}
