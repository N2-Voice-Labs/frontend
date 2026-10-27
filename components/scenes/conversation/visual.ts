import { clamp } from "@/lib/landing/math";
import { BRIDGE, DIM, EN, INK, KO, PALETTE, label, lerp, range, rnd, type Frame, type SceneVisual } from "@/lib/cinematic/visual";
import { EVENTS, SEGMENTS, type Lane } from "./script";

/** Lane heights as fractions of the viewport; the HTML captions use the same values (cinematic.css). */
export const LANE_Y: Record<Lane, number> = { ko: 0.42, en: 0.64 };

/** Scrolling timeline: the playhead sits right of centre, the past streams off to the left. */
function timeline(f: Frame) {
  const play = f.w * (f.portrait ? 0.7 : 0.68);
  const span = f.portrait ? 0.2 : 0.34;
  const scale = f.w / span;
  return { play, xAt: (time: number) => play + (time - f.p) * scale, timeAt: (x: number) => f.p + (x - play) / scale };
}

function segmentAt(lane: Lane, time: number) {
  for (const s of SEGMENTS) if (s.lane === lane && time >= s.start && time <= s.end) return s;
  return null;
}

/** 04 — two people, one timeline: speech, the turn ending, the voice answering, a barge-in, a code-switch. */
export const conversationVisual: SceneVisual = {
  place(i, f, o) {
    const lane: Lane = (i & 1) ? "en" : "ko";
    const k = (i >> 1) / (f.n / 2);
    const T = timeline(f);
    const x = lerp(-f.w * 0.02, f.w * 1.02, k);
    const time = T.timeAt(x);
    const seg = time <= f.p ? segmentAt(lane, time) : null;
    // Envelope inside a segment: rises and falls, and stops dead where the voice was cut.
    const env = seg ? Math.sin(Math.PI * clamp((time - seg.start) / (seg.end - seg.start))) ** (seg.cut ? 0.2 : 0.6) : 0;
    const amp = env * f.u * (seg?.kind === "voice" ? 0.05 : 0.065);
    const wob = Math.sin(time * 1400 + f.t * 3) * 0.7 + Math.sin(time * 3700 - f.t * 5) * 0.3;
    o.x = x;
    o.y = f.h * LANE_Y[lane] + amp * wob + (rnd(i, 3) - 0.5) * 1.5;
    o.c = seg ? (seg.kind === "voice" ? BRIDGE : lane === "ko" ? KO : EN) : DIM;
    const fade = range(x, 0, f.w * 0.12) * (1 - range(x, f.w * 0.9, f.w));
    o.a = (seg ? 0.95 : time > f.p ? 0.12 : 0.35) * fade;
    o.s = seg ? 1.2 : 1;
  },
  draw(ctx, f, alpha) {
    const T = timeline(f);
    const top = f.h * LANE_Y.ko - f.u * 0.12, bottom = f.h * LANE_Y.en + f.u * 0.12;
    // Playhead
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = PALETTE[INK];
    ctx.fillRect(T.play, top, 1, bottom - top);
    label(ctx, "NOW", T.play, top - 10, alpha * 0.5);
    // Clear of the chapter list on the left edge.
    const lx = f.portrait ? 20 : Math.max(f.w * 0.12, 190);
    label(ctx, "MINJI · KO", lx, f.h * LANE_Y.ko - f.u * 0.08, alpha * 0.6, PALETTE[KO], "left");
    label(ctx, "DANIEL · EN", lx, f.h * LANE_Y.en - f.u * 0.08, alpha * 0.6, PALETTE[EN], "left");
    // Event markers travel with the timeline once they have happened.
    for (const e of EVENTS) {
      if (e.at > f.p) continue;
      const x = T.xAt(e.at);
      const a = alpha * range(f.p, e.at, e.at + 0.015) * range(x, f.w * 0.05, f.w * 0.2);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = PALETTE[BRIDGE];
      for (let y = top; y < bottom; y += 6) ctx.fillRect(x, y, 1, 3);
      label(ctx, e.label, x + 6, bottom + 16, a * 0.85, PALETTE[BRIDGE], "left", f.portrait ? 9 : 11);
    }
    // The gap between the end of a turn and the first audio of the answer.
    const turnEnd = EVENTS[0].at, firstAudio = SEGMENTS[1].start;
    if (f.p > firstAudio) {
      const xa = T.xAt(turnEnd), xb = T.xAt(firstAudio), y = f.h * LANE_Y.en - f.u * 0.09;
      const a = alpha * range(f.p, firstAudio, firstAudio + 0.02) * range(xa, f.w * 0.05, f.w * 0.2);
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = PALETTE[INK];
      ctx.fillRect(xa, y, Math.max(1, xb - xa), 1);
      ctx.fillRect(xa, y - 3, 1, 7);
      ctx.fillRect(xb, y - 3, 1, 7);
      label(ctx, "TURN → FIRST AUDIO", (xa + xb) / 2, y - 8, a * 0.8, PALETTE[INK], "center", 10);
    }
    ctx.globalAlpha = 1;
  },
};
