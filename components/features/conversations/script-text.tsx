import type { ReactNode } from "react";

export type Script = "cyrillic" | "latin";
export type Segment = { text: string; script: Script | null };

const scriptOf = (token: string): Script | null => (/[Ѐ-ӿ]/.test(token) ? "cyrillic" : /[A-Za-z]/.test(token) ? "latin" : null);

/**
 * Splits text into runs of the same script. Whitespace, digits and punctuation join the current run.
 * Returns a single untagged segment unless the text really mixes Cyrillic and Latin.
 */
export function splitByScript(text: string): Segment[] {
  const segments: Segment[] = [];
  for (const token of text.split(/(\s+)/)) {
    if (token === "") continue;
    const script = scriptOf(token);
    const last = segments[segments.length - 1];
    if (!last) segments.push({ text: token, script });
    else if (script === null || last.script === null || last.script === script) {
      last.text += token;
      last.script = last.script ?? script;
    } else segments.push({ text: token, script });
  }
  const scripts = new Set(segments.map((segment) => segment.script).filter(Boolean));
  return scripts.size < 2 ? [{ text, script: null }] : segments;
}

export const isMixedScript = (text: string) => splitByScript(text).length > 1;

/** Plain text normally; tinted runs only when a message switches between Cyrillic and Latin. */
export function ScriptText({ text }: Readonly<{ text: string }>): ReactNode {
  const segments = splitByScript(text);
  if (segments.length === 1) return text;
  return segments.map((segment, index) => <span className={`seg seg-${segment.script ?? "neutral"}`} key={index}>{segment.text}</span>);
}
