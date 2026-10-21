import type { CSSProperties } from "react";

/** A small generated "voice orb" avatar. Colour comes from the agent's hue; bars animate via CSS. */
export function AgentOrb({ hue, size = 46 }: Readonly<{ hue: number; size?: number }>) {
  return (
    <span className="agent-orb" style={{ "--hue": hue, "--size": `${size}px` } as CSSProperties} aria-hidden="true">
      <span className="agent-orb-bars"><i /><i /><i /><i /><i /></span>
    </span>
  );
}
