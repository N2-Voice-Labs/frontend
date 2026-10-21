"use client";

import { useRef } from "react";
import { useScrollProgress } from "@/lib/landing/scroll";
import { Waveform } from "@/components/shared/waveform";

const ROWS = [
  { code: "EN", name: "English", phrase: "Could we meet tomorrow?", lang: undefined, seed: 1, color: "var(--teal)" },
  { code: "RU", name: "Русский", phrase: "Можем встретиться завтра?", lang: "ru", seed: 5, color: "var(--plum)" },
  { code: "KO", name: "한국어", phrase: "내일 만날 수 있을까요?", lang: "ko", seed: 7, color: "var(--ink)" },
] as const;

/** Code-switching sentence + three voiceprints; the active row follows scroll. */
export function LanguageFluid() {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref, "through");
  const active = Math.min(2, Math.floor(p * 3));

  return (
    <section id="languages" className="sec languages" ref={ref}>
      <div className="wrap split">
        <div className="lang-copy">
          <div className="mono">Code-switching</div>
          <h2 className="h2">Language is fluid. <em>Your agent is too.</em></h2>
          <p className="lede">Callers start in one language and finish in another. Voice Labs follows the switch without asking them to choose again.</p>
          <div className="card quote">
            <span className="mono sm">One sentence, two languages</span>
            <p><span lang="ru" className="t-plum">Мне нужно узнать</span> <span className="t-teal">what documents I need for my visa.</span></p>
          </div>
        </div>
        <div className="lang-rows">
          {ROWS.map((row, i) => (
            <div key={row.code} className="card lang-row" data-active={String(i === active)}>
              <span className="code">{row.code}</span>
              <div className="lang-body">
                <div className="lang-top">
                  <span className="strong lang-name" lang={row.lang}>{row.name}</span>
                  <span className="lang-phrase" lang={row.lang}>{row.phrase}</span>
                </div>
                <Waveform seed={row.seed} style={{ color: row.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
