const TICKS = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2, r1 = 16, r2 = i % 2 ? 19 : 21;
  return { x1: (24 + Math.cos(a) * r1).toFixed(1), y1: (24 + Math.sin(a) * r1).toFixed(1), x2: (24 + Math.cos(a) * r2).toFixed(1), y2: (24 + Math.sin(a) * r2).toFixed(1) };
});

/** Dial icon with a letter in the middle (translate scenarios, agent inspector). Decorative. */
export function TickIcon({ letter, size = 48 }: { letter: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        {TICKS.map((t, i) => <line key={i} {...t} />)}
      </g>
      <circle cx="24" cy="24" r="12" style={{ fill: "var(--surface)" }} stroke="currentColor" strokeOpacity=".45" />
      <text x="24" y="28.5" textAnchor="middle" style={{ fontFamily: "var(--font-code)" }} fontSize="12" fill="currentColor">{letter}</text>
    </svg>
  );
}
