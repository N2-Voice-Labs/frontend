/* eslint-disable @next/next/no-img-element -- pre-optimized WebP; the Cloudflare build has no image optimizer */

/**
 * The portal's dragon mascot. One pose per moment of the student's visit:
 * wave (home), headset (assistant), reading (chat, before the first question), writing (answer on its way),
 * clock (waiting for an officer), megaphone (call to talk to a person), celebrate (call finished),
 * confused (errors, page not found). Files live in public/portal/mascot at 320, 640 and 960 px wide.
 * With `speech`, the dragon gets a speech bubble: real page text (the picture itself stays decorative).
 */
export type MascotPose = "wave" | "headset" | "reading" | "writing" | "clock" | "megaphone" | "celebrate" | "confused";

/** Intrinsic aspect (height / width) of each trimmed image, so the box is reserved before it loads. */
const ASPECT: Record<MascotPose, number> = {
  wave: 736 / 640,
  clock: 657 / 640,
  headset: 816 / 640,
  megaphone: 641 / 640,
  writing: 888 / 640,
  celebrate: 687 / 640,
  confused: 791 / 640,
  reading: 726 / 640,
};

export function Mascot({ pose, width, label, priority = false, className, speech, speechSide = "left" }: {
  pose: MascotPose;
  /** Displayed width in CSS pixels (CSS may scale it down on small screens). */
  width: number;
  /** Alt text. Leave empty for decoration next to text that already says the same thing. */
  label?: string;
  priority?: boolean;
  className?: string;
  /** A short line the dragon "says". Rendered as text, so screen readers read it. */
  speech?: React.ReactNode;
  /** Which side of the dragon the bubble sits on (wide screens; it stacks on phones). */
  speechSide?: "left" | "top";
}) {
  const base = `/portal/mascot/${pose}`;
  const img = (
    <img
      className={["portal-mascot", speech ? undefined : className].filter(Boolean).join(" ")}
      src={`${base}-320.webp`}
      srcSet={`${base}-320.webp 320w, ${base}-640.webp 640w, ${base}-960.webp 960w`}
      sizes={`${width}px`}
      width={width}
      height={Math.round(width * ASPECT[pose])}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      draggable={false}
    />
  );
  if (!speech) return img;
  return (
    <figure className={["portal-sticker", className].filter(Boolean).join(" ")} data-side={speechSide} style={{ "--sticker-w": `${width}px` } as React.CSSProperties}>
      <figcaption className="portal-bubble">{speech}</figcaption>
      {img}
    </figure>
  );
}
