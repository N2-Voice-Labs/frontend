import { Fragment, type ElementType } from "react";

/** A line of a title; `{ em }` sets the whole line in the italic serif. */
export type TitleLine = string | { em: string };

type Props = {
  as?: ElementType;
  lines: readonly TitleLine[];
  className?: string;
  lang?: string;
  id?: string;
};

/**
 * Film-title text: every word sits in its own mask so scene timelines can raise it word by word
 * (`.ct-i`, see revealWords). The words stay real text, so the sentence reads normally without motion.
 */
export function CinematicText({ as: Tag = "p", lines, className, lang, id }: Props) {
  return (
    <Tag className={className ? `ct ${className}` : "ct"} lang={lang} id={id} data-reveal="">
      {lines.map((line, li) => {
        const em = typeof line !== "string";
        const words = (em ? line.em : line).split(" ");
        const body = words.map((word, wi) => (
          <Fragment key={wi}>
            <span className="ct-w"><span className="ct-i">{word}</span></span>
            {wi < words.length - 1 ? " " : null}
          </Fragment>
        ));
        return (
          <Fragment key={li}>
            <span className="ct-line">{em ? <em>{body}</em> : body}</span>
            {li < lines.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </Tag>
  );
}
