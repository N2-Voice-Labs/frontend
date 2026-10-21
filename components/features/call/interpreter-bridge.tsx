import { memo } from "react";
import { bridgeLabel, type BridgeMode, type Names, type Seat } from "@/lib/call-state";
import { LevelMeter } from "./level-meter";
import type { LevelStore } from "./level-store";

/**
 * The interpreter, drawn as the link between the two people rather than as a third person
 * (design system §3.9). `toward` is the listener: in the horizontal layout "self" is on the left,
 * so the arrow points left toward you and right toward them. The words always carry the direction.
 */
export const InterpreterBridge = memo(function InterpreterBridge({
  mode,
  toward,
  names,
  levels,
  layout = "horizontal",
}: {
  mode: BridgeMode;
  toward: Seat | null;
  names: Names;
  levels?: LevelStore | null;
  layout?: "horizontal" | "inline";
}) {
  const label = bridgeLabel(mode, toward, names);
  return (
    <div className="bridge" data-mode={mode} data-toward={toward ?? "none"} data-layout={layout} role="img" aria-label={label}>
      <span className="bridge-track" aria-hidden="true">
        <span className="bridge-line" />
        {(mode === "translating" || mode === "speaking") && toward && <span className="bridge-arrow" />}
        {mode === "translating" && toward && <span className="bridge-packet" />}
      </span>
      <span className="bridge-label" aria-hidden="true">
        {mode === "speaking" && toward === "self" && <LevelMeter store={levels} source="interp" tone="interp" active size="sm" />}
        {label}
      </span>
    </div>
  );
});
