"use client";

import { useRef } from "react";
import { clamp } from "@/lib/landing/math";
import { useScrollProgress } from "@/lib/landing/scroll";
import { Waveform } from "@/components/shared/waveform";
import { PinProgress } from "./pin-progress";

const EN_FULL = "Could we meet at the main office tomorrow at 10 a.m.?";
const CHIPS = [
  { label: "Heard", at: 0.1 },
  { label: "Understood", at: 0.3 },
  { label: "Translated", at: 0.56 },
  { label: "Spoken", at: 0.8 },
];

/** Pinned: Korean in → the lime bridge fills → English types out; stage chips light up. */
export function BridgeDemo() {
  const ref = useRef<HTMLElement>(null);
  const b = useScrollProgress(ref, "pin");

  const koOn = b > 0.04 && b < 0.34 ? true : b >= 0.34 ? "done" : false;
  const typed = clamp((b - 0.52) / 0.36);
  const enOn = b > 0.52 && b < 0.97 ? true : b >= 0.97 ? "done" : false;

  return (
    <section id="bridge" className="sec alt pinsec" ref={ref} style={{ height: 1600 }}>
      <div className="pin" style={{ height: 760 }}>
        <PinProgress value={b} />
        <div className="wrap bridge-inner">
          <div className="head-row">
            <div className="head-col">
              <div className="mono">Two lanes, one bridge</div>
              <h2 className="h2">Two people. Two languages. <em>One conversation.</em></h2>
            </div>
            <p className="lede" style={{ maxWidth: 340 }}>Each person speaks naturally. Voice Labs listens, translates and speaks in the other language before the pause gets awkward.</p>
          </div>
          <div className="stage-grid">
            <div className="card lane">
              <div className="lane-head">
                <div className="who">
                  <span className="avatar plum">J</span>
                  <div className="who-text"><span className="strong">Ji-woo</span><span className="mono sm"><span lang="ko">한국어</span> · Korean</span></div>
                </div>
                <span className="mono sm t-plum">{b < 0.04 ? "Waiting" : b < 0.34 ? "Speaking" : "Listening"}</span>
              </div>
              <p className="lane-text" lang="ko" style={{ opacity: 0.3 + 0.7 * clamp(b / 0.08) }}>내일 오전 10시에 본사에서 만날 수 있을까요?</p>
              <Waveform n={32} seed={3} max={52} on={koOn} className="t-plum" />
            </div>
            <div className="bridge-col">
              <span className="mono sm">{b < 0.3 ? "Listening" : b < 0.58 ? "Translating" : "Delivered"}</span>
              <div className="bridge-track"><div className="bridge-fill" style={{ width: `${(clamp((b - 0.28) / 0.3) * 100).toFixed(1)}%` }} /></div>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="t-muted"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </div>
            <div className="card lane">
              <div className="lane-head">
                <div className="who">
                  <span className="avatar teal">Y</span>
                  <div className="who-text"><span className="strong">You</span><span className="mono sm">English</span></div>
                </div>
                <span className="mono sm t-teal">{b < 0.52 ? "Listening" : b < 0.97 ? "Hearing it" : "Heard"}</span>
              </div>
              <p className="lane-text"><span>{EN_FULL.slice(0, Math.round(EN_FULL.length * typed))}</span><span className="caret" aria-hidden="true" hidden={!(typed > 0 && typed < 1)} /></p>
              <Waveform n={32} seed={3} max={52} on={enOn} className="t-teal" />
            </div>
          </div>
          <div className="chips">
            {CHIPS.map((c) => <span key={c.label} className="chip" data-on={String(b >= c.at)}>{c.label}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
