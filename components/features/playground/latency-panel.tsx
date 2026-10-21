import { SoonNote } from "@/components/features/workspace/ui";
import { latencyStages, type LatencyStage } from "@/lib/latency";

/** Per-turn timings for speech, language and voice. Empty (and labelled) until the Runtime reports them. */
export function LatencyPanel({ values }: Readonly<{ values: Partial<Record<LatencyStage, number>> }>) {
  const any = Object.keys(values).length > 0;
  return <section className="play-diag" aria-labelledby="latency-title">
    <h2 id="latency-title">Latency</h2>
    <dl className="latency">
      {latencyStages.map((stage) => <div key={stage.key}>
        <dt>{stage.label}</dt>
        <dd>{values[stage.key] === undefined ? "—" : `${values[stage.key]} ms`}</dd>
      </div>)}
    </dl>
    {!any && <SoonNote capability="liveLatency" />}
  </section>;
}
