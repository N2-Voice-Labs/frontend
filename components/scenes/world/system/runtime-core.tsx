import { BEATS } from "../beats";
import { n2, type Geo } from "./geometry";
import { C, Dot, Label, all, frac, one, op, s, setA, type Bind, type Tw } from "./shared";

/**
 * ONE RUNTIME at the centre: chapter 05's living path, small. A short spine with its seven stages as
 * points, the reasoning ring in the middle, packets crossing it (cyan in, gold through the agent, magenta
 * out). It stays still while the conversations around it change.
 */

const PK = 5;
const STAGES = 7;

const spineY = (G: Geo, x: number) => G.c.y + Math.sin(((x - G.c.x) / G.rw) * Math.PI * 1.2) * G.ring * 0.18;

export function RuntimeCore({ G }: { G: Geo }) {
  const { c, rw, ring } = G;
  let spine = "";
  for (let i = 0; i <= 60; i++) {
    const x = c.x - rw + (2 * rw * i) / 60;
    spine += (i ? "L" : "M") + n2(x) + " " + n2(spineY(G, x));
  }
  const arc = `M${n2(c.x + ring * 1.35)} ${n2(c.y)}A${n2(ring * 1.35)} ${n2(ring * 1.35)} 0 0 1 ${n2(c.x - ring * 0.68)} ${n2(c.y + ring * 1.17)}`;
  return (
    <g data-ws="runtime">
      {/* chapter 05's core: the point the rays left from. */}
      <Dot at={c} r={3.2} fill={C.gold} />
      <g data-ws-rt="body">
        <path className={s.stroke} d={spine} stroke={C.ink} strokeOpacity={0.35} strokeWidth={1} />
        <circle className={s.stroke} cx={c.x} cy={c.y} r={ring} stroke={C.gold} strokeOpacity={0.55} strokeWidth={1} />
        <g data-ws-live="rt-arc">
          <path className={s.stroke} d={arc} stroke={C.gold} strokeOpacity={0.3} strokeWidth={1} />
        </g>
        {Array.from({ length: STAGES }, (_, k) => {
          const x = c.x - rw + (2 * rw * k) / (STAGES - 1);
          return k === 3 ? null : <Dot key={k} at={{ x, y: spineY(G, x) }} r={1.8} fill={k === 0 ? C.ko : k === 6 ? C.en : C.ink} glow={false} />;
        })}
        {Array.from({ length: PK }, (_, i) => (
          <Dot key={`pk${i}`} at={{ x: -9999, y: -9999 }} r={2.2} g={{ "data-ws-live": "rt-pk", opacity: 0 }} c={{ "data-ws-live": "rt-pk-core" }} />
        ))}
      </g>
      <g data-ws-rt="label">
        <Label at={{ x: c.x, y: c.y + ring }} dy={G.portrait ? 16 : 20} text={{ fill: C.gold, style: { fillOpacity: 0.85 } }}>ONE RUNTIME</Label>
      </g>
    </g>
  );
}

export const bindRuntimeCore: Bind = (svg, G) => {
  const pks = all(svg, "rt-pk"), cores = all(svg, "rt-pk-core"), arc = one(svg, "rt-arc");
  const colour = new Array<string>(PK).fill("");
  return (p, t) => {
    if (p < BEATS.runtime[0] - 0.02) return;
    setA(arc, "transform", `rotate(${n2((t * 24) % 360)} ${n2(G.c.x)} ${n2(G.c.y)})`);
    for (let i = 0; i < PK; i++) {
      const u = frac(t * 0.16 + i / PK);
      const x = G.c.x - G.rw + 2 * G.rw * u;
      setA(pks[i], "transform", `translate(${n2(x)} ${n2(spineY(G, x))})`);
      op(pks[i], Math.min(1, u * 12, (1 - u) * 12));
      const col = u < 0.38 ? C.ko : u < 0.62 ? C.gold : C.en;
      if (col !== colour[i]) { setA(cores[i], "fill", col); colour[i] = col; }
    }
  };
};

export function runtimeCoreTimeline(T: Tw) {
  const [r0, r1] = BEATS.runtime;
  T.fromTo('[data-ws-rt="body"]', { opacity: 0 }, { opacity: 1, duration: r1 - r0 }, r0);
  T.fromTo('[data-ws-rt="label"]', { opacity: 0 }, { opacity: 1, duration: 0.03 }, r1 - 0.03);
  // The statements name it; then the worlds become points and its name goes with theirs.
  T.to('[data-ws-rt="label"]', { opacity: 0, duration: 0.03 }, BEATS.statement[0] - 0.01);
}
