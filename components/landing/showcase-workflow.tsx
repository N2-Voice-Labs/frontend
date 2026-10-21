import type { ReactNode } from "react";
import { Waveform } from "@/components/shared/waveform";
import { ROUTES } from "@/lib/landing/config";

const ARROW = <svg className="ft-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>;
const ico = (children: ReactNode, join = false) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin={join ? "round" : undefined} aria-hidden="true">{children}</svg>
);

type Tile = { n: string; href: string; wide?: boolean; icon: ReactNode; art: ReactNode; artClass: string; title: string; text: string };

const TILES: Tile[] = [
  {
    n: "01", href: "#bridge", wide: true, artClass: "art-lanes", title: "Live translation", text: "Two people, two languages, one call.",
    icon: ico(<path d="M3 12h4M17 12h4M7 7v10M17 7v10M10 12h4" />),
    art: <>
      <Waveform seed={31} n={44} max={30} on style={{ height: 34, color: "var(--teal)" }} />
      <div className="art-bridge"><i /></div>
      <Waveform seed={37} n={44} max={30} on style={{ height: 34, color: "var(--plum)" }} />
    </>,
  },
  {
    n: "02", href: "#languages", artClass: "art-switch", title: "Code-switching", text: "Follows callers between languages.",
    icon: ico(<path d="M7 7h11l-3-3M17 17H6l3 3" />, true),
    art: <><span className="cs ru" lang="ru">Мне нужно</span><span className="cs en">documents</span><span className="cs ru" lang="ru">для визы</span></>,
  },
  {
    n: "03", href: ROUTES.agents, artClass: "art-gloss", title: "Glossary", text: "Your terms, translated your way.",
    icon: ico(<><path d="M4 5h12a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3z" /><path d="M8 9h7M8 13h5" /></>, true),
    art: <>
      <div><span>residence permit</span><i /><span lang="ru">вид на жительство</span></div>
      <div><span>residence permit</span><i /><span lang="ko">체류 허가</span></div>
    </>,
  },
  {
    n: "04", href: "#top", artClass: "art-interrupt", title: "Interruptions", text: "Talk over it. It stops and listens.",
    icon: ico(<path d="M8 5v14M16 5v14" />),
    art: <>
      <Waveform seed={41} n={30} max={26} on="done" style={{ height: 30, color: "var(--muted)" }} />
      <Waveform seed={43} n={30} max={26} on style={{ height: 30, color: "var(--teal)" }} />
    </>,
  },
  {
    n: "05", href: ROUTES.agents, artClass: "art-prov", title: "Providers", text: "Swap speech, language or voice per agent.",
    icon: ico(<><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" /><circle cx="15" cy="12" r="2" fill="currentColor" /><circle cx="7" cy="18" r="2" fill="currentColor" /></>),
    art: <>
      <div><span>Speech</span><b>Deepgram</b></div>
      <div className="on"><span>Language</span><b>OpenAI</b></div>
      <div><span>Voice</span><b>Cartesia</b></div>
    </>,
  },
  {
    n: "06", href: ROUTES.conversations, artClass: "art-trans", title: "Transcripts", text: "Every call, searchable afterwards.",
    icon: ico(<><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h4" /></>, true),
    art: <>
      <div className="trans-wave"><Waveform seed={47} n={40} max={22} className="static" style={{ height: 26, color: "var(--muted)" }} /><i className="playhead" /></div>
      <div className="pills"><i /><i /><i className="hot" /><i /><i /><i /><i /></div>
    </>,
  },
  {
    n: "07", href: "#latency", artClass: "art-lat", title: "Latency, measured", text: "Every stage of a call, timed.",
    icon: ico(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M10 2h4" /></>),
    art: <>
      <div className="lat-line"><i /></div>
      <div className="lat-dots"><b /><b /><b /><b /><b /><b /></div>
    </>,
  },
];

/**
 * Numbered tiles with small CSS/SVG illustrations. Each links to where it is shown or used: a page section,
 * the live demo (interruptions: talk over it), or the workspace (glossary, providers, transcripts).
 */
export function ShowcaseWorkflow() {
  return (
    <div className="flow">
      {TILES.map((t) => (
        <a key={t.n} className={t.wide ? "ft ft-6" : "ft ft-3"} href={t.href}>
          <div className="ft-top"><span className="ft-id">{t.icon}{t.n}</span>{ARROW}</div>
          <div className={`ft-art ${t.artClass}`} aria-hidden="true">{t.art}</div>
          <div className="ft-text"><h3>{t.title}</h3><p>{t.text}</p></div>
        </a>
      ))}
    </div>
  );
}
