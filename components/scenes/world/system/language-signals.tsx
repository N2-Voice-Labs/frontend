import { BEATS, CODE_SWITCH, LANG_TAG, WORLDS } from "../beats";
import { n2, type Geo } from "./geometry";
import { C, all, frac, langColour, one, op, s, setA, type Bind, type Tw } from "./shared";

/**
 * Language emerges from the conversations: a word and its tag rise out of a world and ride its path into
 * the runtime, then they are gone (signals, not subtitles). One BOOKING caller switches language
 * mid-sentence; the indicator follows KO → EN → KO and the signal never breaks.
 */

const PERIOD = 6.5;
const RIDE = 2.6;
const SPOKEN = WORLDS.filter((wd) => wd.hello);
/** Code-switch timing within its loop (s): when each part is spoken, and when the line lets go. */
const CS_PERIOD = 7;
const CS_PARTS = [[0.3, 1.6], [1.6, 2.5], [2.5, 4.2]] as const;
const CS_OUT = [5.4, 6.4] as const;

export function LanguageSignals({ G }: { G: Geo }) {
  const bk = G.worlds.find((wd) => wd.id === CODE_SWITCH.world)!;
  // Desktop: above the BOOKING world. Portrait: centred across the screen, between the runtime and the worlds below it.
  const at = G.portrait ? { x: G.w / 2, y: bk.p.y - 1.9 * G.sz } : { x: bk.p.x, y: bk.p.y - 1.45 * G.sz };
  const anchor = "middle";
  return (
    <g data-ws="lang">
      {SPOKEN.map((wd) => (
        <g key={wd.id} data-ws-live="frag" transform="translate(-9999 -9999)" opacity={0}>
          <g className={s.cs}>
            <text className={s.tiny} y={-13} textAnchor="middle" dominantBaseline="middle" style={{ fill: langColour(wd.lang), fillOpacity: 0.9 }}>{LANG_TAG[wd.lang]}</text>
            <text className={s.token} textAnchor="middle" dominantBaseline="middle" lang={wd.lang} direction={wd.lang === "ar" ? "rtl" : undefined}>{wd.hello}</text>
          </g>
        </g>
      ))}
      <g data-ws-live="cs" transform={`translate(${n2(at.x)} ${n2(at.y)})`}>
        <g className={s.cs}>
          <text data-ws-live="cs-tag" className={s.tiny} y={-26} textAnchor={anchor} dominantBaseline="middle" style={{ fill: C.ko, fillOpacity: 0.95 }}>KO</text>
          <text className={s.token} y={-8} textAnchor={anchor} dominantBaseline="middle">
            {CODE_SWITCH.parts.map((part, k) => (
              <tspan key={k} data-ws-live="cs-part" lang={part.lang} fill={langColour(part.lang)} fillOpacity={0.9}>{k ? " " : ""}{part.text}</tspan>
            ))}
          </text>
        </g>
      </g>
    </g>
  );
}

export const bindLanguageSignals: Bind = (svg, G) => {
  const frags = all(svg, "frag"), parts = all(svg, "cs-part"), tag = one(svg, "cs-tag"), cs = one(svg, "cs");
  const paths = SPOKEN.map((wd) => G.worlds.find((g) => g.id === wd.id)!.path);
  let shown = "";
  return (p, t, _cam, still) => {
    if (p < BEATS.languages[0] - 0.02 || p > BEATS.global[1]) return;
    frags.forEach((el, k) => {
      // Each world speaks in turn; the word leaves the world and fades into the runtime.
      const u = still ? 0.35 : frac(t / PERIOD + k / SPOKEN.length) * PERIOD / RIDE;
      if (u >= 1) { op(el, 0); return; }
      const q = paths[k].at(1 - 0.15 - u * 0.7);
      setA(el, "transform", `translate(${n2(q.x)} ${n2(q.y)})`);
      op(el, still ? 0.85 : Math.sin(Math.PI * u) ** 0.6);
    });
    // The code-switch: each part lights as it is spoken; the indicator follows the speaker.
    const ct = still ? 3 : frac(t / CS_PERIOD) * CS_PERIOD;
    let cur = -1;
    parts.forEach((el, k) => {
      const [a, b] = CS_PARTS[k];
      if (ct >= a && ct < b) cur = k;
      setA(el, "fill-opacity", (ct < a ? 0.12 : ct < b ? 1 : 0.5).toFixed(2));
    });
    const lang = cur >= 0 ? CODE_SWITCH.parts[cur].lang : CODE_SWITCH.parts[CODE_SWITCH.parts.length - 1].lang;
    const label = LANG_TAG[lang];
    if (tag && label !== shown) { tag.textContent = label; tag.style.fill = langColour(lang); shown = label; }
    op(cs, still ? 1 : ct < CS_OUT[0] ? Math.min(1, ct / 0.3) : 1 - Math.min(1, (ct - CS_OUT[0]) / (CS_OUT[1] - CS_OUT[0])));
  };
};

export function languageSignalsTimeline(T: Tw) {
  const [l0] = BEATS.languages;
  T.fromTo('[data-ws="lang"]', { opacity: 0 }, { opacity: 1, duration: 0.04 }, l0);
  // Quieter under the statements, gone when the worlds become points.
  T.to('[data-ws="lang"]', { opacity: 0.35, duration: 0.03 }, BEATS.statement[0] - 0.01);
  T.to('[data-ws="lang"]', { opacity: 0, duration: 0.03 }, BEATS.global[0] - 0.02);
}
