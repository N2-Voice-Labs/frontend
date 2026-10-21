/** Progress line at the top of a pinned panel (hidden under 900px, where sections are not pinned). */
export function PinProgress({ value }: { value: number }) {
  return <span className="pin-progress" aria-hidden="true"><i style={{ transform: `scaleX(${value})` }} /></span>;
}
