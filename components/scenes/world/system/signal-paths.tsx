import { rnd } from "@/lib/cinematic/visual";
import { BEATS, WORLDS } from "../beats";
import { activity, turnIn, type Geo } from "./geometry";
import { C, all, dotsD, frac, langColour, one, s, setA, type Bind, type Tw } from "./shared";

/**
 * One signal becomes many: every conversation travels its own path back to the runtime. Seven paths lead
 * to the worlds; more branch off for a moment and fade (the many becoming specific). Packets ride each
 * world's path in its own rhythm: towards the runtime while the caller speaks, back while the agent
 * answers, nothing in silence; now and then a gold one goes out and back (the agent querying a tool).
 */

const PK = 4;
const STRAYS = 18;

/** Short branches that leave the runtime with the others and dissolve once the worlds take shape. */
function strays(G: Geo) {
  return Array.from({ length: STRAYS }, (_, k) => {
    const a = k * 2.39996 + rnd(k, 31) * 0.4, d = G.S * (0.22 + 0.32 * rnd(k, 32));
    const b = { x: G.c.x + Math.cos(a) * d * (G.portrait ? 0.9 : 1.5), y: G.c.y + Math.sin(a) * d };
    return G.curve(G.c, b, (rnd(k, 33) - 0.5) * 0.3).d;
  });
}

export function SignalPaths({ G }: { G: Geo }) {
  return (
    <g data-ws="paths">
      <g data-ws-p="strays" className={s.filmOnly}>
        {strays(G).map((d, k) => (
          <path key={k} data-ws-stray="" className={s.stroke} d={d} pathLength={1} strokeDasharray="1 1" stroke={[C.ko, C.en, C.ink][k % 3]} strokeOpacity={0.2} strokeWidth={0.8} />
        ))}
      </g>
      {G.worlds.map((wd) => (
        <path key={wd.id} data-ws-path={wd.i} className={s.stroke} d={wd.path.d} pathLength={1} strokeDasharray="1 1" stroke={langColour(wd.lang)} strokeOpacity={0.3} strokeWidth={1} />
      ))}
      <g data-ws-p="flow">
        {G.worlds.map((wd) => (
          <path key={wd.id} data-ws-live="pk" className={s.dots} d="M-9999 -9999h0.01" stroke={langColour(wd.lang)} strokeWidth={2.4} />
        ))}
        <path data-ws-live="pk-out" className={s.dots} d="M-9999 -9999h0.01" stroke={C.en} strokeWidth={2.2} strokeOpacity={0.8} />
        <path data-ws-live="pk-tool" className={s.dots} d="M-9999 -9999h0.01" stroke={C.gold} strokeWidth={2.6} />
      </g>
    </g>
  );
}

export const bindSignalPaths: Bind = (svg, G) => {
  const pk = all(svg, "pk"), out = one(svg, "pk-out"), tool = one(svg, "pk-tool");
  const xs = new Float64Array(PK), ys = new Float64Array(PK);
  const ox = new Float64Array(PK * WORLDS.length), oy = new Float64Array(PK * WORLDS.length);
  const tx = new Float64Array(WORLDS.length), ty = new Float64Array(WORLDS.length);
  return (p, t, _cam, still) => {
    if (p < BEATS.many[0] || p > BEATS.select[1]) return;
    let no = 0, nt = 0;
    G.worlds.forEach((wd, i) => {
      const a = still ? 0.8 : activity(i, t);
      const inbound = still || turnIn(i, t);
      const speed = wd.act.speed * 0.5;
      let n = 0;
      for (let k = 0; k < PK; k++) {
        // Packets exist only while someone speaks; between turns the path is quiet.
        if (a < 0.15 + 0.2 * k / PK) continue;
        const u = frac(t * speed + k / PK + i * 0.13);
        const q = wd.path.at(inbound ? 1 - u : u);
        if (inbound) { xs[n] = q.x; ys[n] = q.y; n++; }
        else { ox[no] = q.x; oy[no] = q.y; no++; }
      }
      setA(pk[i], "d", dotsD(xs, ys, n));
      // A tool query: out of the runtime to the world's agent and back, once a turn, during the agent's turn.
      if (!still && !inbound) {
        const f = frac(t / wd.act.period + i * 0.37) * 2 % 1;
        if (f < 0.35) {
          const q = wd.path.at(f < 0.175 ? f / 0.175 : 2 - f / 0.175);
          tx[nt] = q.x; ty[nt] = q.y; nt++;
        }
      }
    });
    setA(out, "d", dotsD(ox, oy, no));
    setA(tool, "d", dotsD(tx, ty, nt));
  };
};

export function signalPathsTimeline(T: Tw) {
  const [m0, m1] = BEATS.many;
  // The branching: each path drawn out of the centre, a few at a time.
  WORLDS.forEach((_, i) => T.fromTo(`[data-ws-path="${i}"]`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.06, ease: "power2.out" }, m0 + 0.012 * i));
  T.fromTo("[data-ws-stray]", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.06, ease: "power2.out", stagger: 0.004 }, m0 + 0.01);
  T.fromTo('[data-ws-p="flow"]', { opacity: 0 }, { opacity: 1, duration: 0.03 }, m0 + 0.03);
  T.fromTo('[data-ws-p="strays"]', { opacity: 1 }, { opacity: 0, duration: 0.08 }, m1 + 0.04);
}
