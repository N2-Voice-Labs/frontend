"use client";

import { useRef } from "react";
import { LATENCY_STAGES } from "@/lib/landing/config";
import { clamp, formatSeconds } from "@/lib/landing/math";
import { useScrollProgress } from "@/lib/landing/scroll";
import { useDemoSnapshot } from "./demo-session";
import { PinProgress } from "./pin-progress";

/** Pinned: a lime pulse travels through the NS-01 stages T0–T5. */
export function LatencyTimeline() {
  const ref = useRef<HTMLElement>(null);
  const { medianTurn } = useDemoSnapshot();
  const progress = useScrollProgress(ref, "pin");
  const l = clamp((progress - 0.05) / 0.85);
  const pct = `${(l * 100).toFixed(2)}%`;
  const n = LATENCY_STAGES.length;

  return (
    <section id="latency" className="sec pinsec" ref={ref} style={{ height: 1340 }}>
      <div className="pin" style={{ height: 680 }}>
        <PinProgress value={progress} />
        <div className="wrap latency-inner">
          {/* Title only: the explanation sits under the timeline it describes. */}
          <div className="head-col">
            <div className="mono">Measured, not guessed</div>
            <h2 className="h2">Every millisecond has an address.</h2>
          </div>
          <div className="lat">
            <div className="lat-track" aria-hidden="true">
              <div className="lat-fill" style={{ width: pct }} />
              <div className="lat-dot pulse" style={{ left: pct }} />
            </div>
            <ol className="lat-grid">
              {LATENCY_STAGES.map((s, i) => (
                <li key={s.id} className="stage" data-on={String(l >= (i + 0.5) / n - 0.001)}>
                  <span className="node" />
                  <span className="mono sm">{s.id}</span>
                  <span className="stage-label">{s.label}</span>
                  <span className="stage-val">{s.p50Ms === null ? "[p50 ms]" : `${s.p50Ms} ms`}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="lat-foot">
            <p className="lede">Our live benchmark times each stage of a call, from the first syllable to the moment the other person hears the translation.</p>
            <p className="lat-yours" hidden={medianTurn === null}>
              <span className="ldot pulse" />
              <span>Your session: <b>{medianTurn === null ? "—" : formatSeconds(medianTurn)}</b> median response, measured in your browser</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
