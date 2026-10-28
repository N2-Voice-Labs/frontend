import { BEATS } from "../beats";
import { n2, type Geo } from "./geometry";
import { C, Dot, dotsD, frac, one, op, s, setA, type Bind, type Tw } from "./shared";

/**
 * The world scale: past the seven worlds, regions of cities (each a small chain of conversations) tied back
 * to the same runtime by long arcs and to each other. Signals keep travelling the arcs. Then one
 * conversation, a single city, brightens and the rest go quiet: the camera goes in on it.
 */

export function GlobalNetwork({ G }: { G: Geo }) {
  return (
    <g data-ws="global" className={s.filmOnly}>
      {G.links.map((l, k) => (
        <path key={`l${k}`} data-ws-g="link" className={s.stroke} d={l.d} pathLength={1} strokeDasharray="1 1" stroke={C.ink} strokeOpacity={0.12} strokeWidth={0.8} />
      ))}
      {G.regions.map((r) => (
        <g key={r.r} data-ws-region={r.r}>
          <path data-ws-g="arc" className={s.stroke} d={r.arc.d} pathLength={1} strokeDasharray="1 1" stroke={r.r % 2 ? C.en : C.ko} strokeOpacity={0.24} strokeWidth={0.9} />
          <path className={s.stroke} d={r.chain} stroke={C.ink} strokeOpacity={0.2} strokeWidth={0.8} />
          <path className={s.dots} d={dotsD(r.cities.map((q) => q.x), r.cities.map((q) => q.y), r.cities.length)} stroke={C.ink} strokeOpacity={0.75} strokeWidth={2.2} />
        </g>
      ))}
      <path data-ws-live="g-pk" className={s.dots} d="M-9999 -9999h0.01" stroke={C.gold} strokeOpacity={0.85} strokeWidth={2} />
    </g>
  );
}

/** The chosen conversation: a point that brightens and starts to breathe. */
export function Selection({ G }: { G: Geo }) {
  return (
    <g data-ws="sel" className={s.filmOnly} opacity={0}>
      <g transform={`translate(${n2(G.sel.x)} ${n2(G.sel.y)})`}>
        <g className={s.cs}>
          <circle data-ws-live="sel-ring" className={s.stroke} r={10} stroke={C.ink} strokeOpacity={0.6} strokeWidth={1} />
          <circle data-ws-live="sel-ring2" className={s.stroke} r={16} stroke={C.ink} strokeOpacity={0.25} strokeWidth={1} />
        </g>
      </g>
      <Dot at={G.sel} r={3.4} fill={C.ink} />
    </g>
  );
}

export const bindGlobalNetwork: Bind = (svg, G) => {
  const pk = one(svg, "g-pk"), ring = one(svg, "sel-ring"), ring2 = one(svg, "sel-ring2");
  const curves = [...G.regions.map((r) => r.arc), ...G.links];
  const xs = new Float64Array(curves.length * 2), ys = new Float64Array(curves.length * 2);
  return (p, t) => {
    if (p < BEATS.global[0] - 0.01) return;
    let n = 0;
    curves.forEach((cv, k) => {
      for (let j = 0; j < 2; j++) {
        const u = frac(t * 0.07 + j * 0.5 + k * 0.17);
        const q = cv.at(k < G.regions.length && j ? 1 - u : u);
        xs[n] = q.x; ys[n] = q.y; n++;
      }
    });
    setA(pk, "d", dotsD(xs, ys, n));
    if (p > BEATS.select[0] - 0.01) {
      const b = frac(t * 0.6);
      setA(ring, "r", n2(8 + 10 * b));
      op(ring, 0.8 * (1 - b));
      setA(ring2, "r", n2(14 + 4 * Math.sin(t * 1.4)));
    }
  };
};

export function globalNetworkTimeline(T: Tw) {
  const [g0, g1] = BEATS.global;
  const g = g1 - g0;
  T.fromTo('[data-ws="global"]', { opacity: 0 }, { opacity: 1, duration: 0.02 }, g0);
  // Cities first, then the arcs that tie them back, then regions to each other.
  for (let r = 0; r < 8; r++) {
    T.fromTo(`[data-ws-region="${r}"]`, { opacity: 0 }, { opacity: 1, duration: g * 0.3 }, g0 + g * (0.05 + r * 0.05));
  }
  T.fromTo('[data-ws-g="arc"]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: g * 0.4, stagger: g * 0.04, ease: "power2.out" }, g0 + g * 0.15);
  T.fromTo('[data-ws-g="link"]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: g * 0.35, stagger: g * 0.03, ease: "power2.out" }, g0 + g * 0.5);

  // One conversation brightens; everything else goes quiet, then away as the camera goes in.
  const [s0, s1] = BEATS.select;
  T.fromTo('[data-ws="sel"]', { opacity: 0 }, { opacity: 1, duration: 0.02 }, s0);
  T.to('[data-ws="global"], [data-ws="net"]', { opacity: 0.22, duration: 0.03 }, s0 + 0.01);
  T.to('[data-ws="global"], [data-ws="net"]', { opacity: 0, duration: 0.03 }, s1 - 0.03);
  T.to('[data-ws="sel"]', { opacity: 0, duration: 0.02 }, s1);
}
