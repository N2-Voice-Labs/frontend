/** Inline 24×24 stroke icons for the call UI (decorative: always aria-hidden; the label carries meaning). */
type IconName =
  | "mic" | "mic-off" | "speaker" | "transcript" | "more" | "end" | "swap" | "link" | "copy" | "share"
  | "check" | "alert" | "info" | "close" | "details" | "keyboard" | "sound" | "spinner" | "phone";

const paths: Record<IconName, React.ReactNode> = {
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  "mic-off": <><path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5" /><path d="M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3M4 4l16 16" /></>,
  speaker: <><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></>,
  sound: <><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></>,
  transcript: <path d="M5 6h14M5 11h14M5 16h9" />,
  more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  end: <path d="M3 14.5c5-4.7 13-4.7 18 0l-2.4 2.6-3.4-1.6v-2.6a12 12 0 0 0-6.4 0v2.6l-3.4 1.6z" />,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />,
  swap: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  share: <><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <><path d="M12 4 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.2" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  details: <><path d="M4 6h10M4 12h16M4 18h12" /><circle cx="18" cy="6" r="2" /></>,
  keyboard: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></>,
  spinner: <path d="M12 3a9 9 0 1 0 9 9" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={`call-icon${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
