import { interpreterLanguages, languageLabel, languageName, nativeLanguageName } from "@/lib/languages";

/**
 * "Korean · 한국어", with `lang` only on the native-script part. The English name stays in the page
 * language, so a screen reader does not read the word "Korean" with a Korean voice (WCAG 3.1.2).
 */
export function LanguageName({ id, native = true }: { id: string; native?: boolean }) {
  const name = languageName(id);
  const nativeName = nativeLanguageName(id);
  if (!native || nativeName === name) return <>{name}</>;
  return <>{name} · <span lang={id}>{nativeName}</span></>;
}

/**
 * Language selector (design system §3.8). Native select; each option carries the English and native
 * names so typeahead works in either (an <option> cannot hold a `lang` span; accepted). `exclude`
 * removes the other person's language (the backend rejects two people with the same language).
 */
export function LanguageSelect({ id, label, value, onChange, exclude, hint }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  exclude?: string;
  hint?: string;
}) {
  return (
    <div className="call-field">
      <label htmlFor={id}>{label}</label>
      <div className="lang-select">
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={hint ? `${id}-hint` : undefined}>
          {interpreterLanguages.filter((item) => item.id !== exclude).map((item) => (
            <option key={item.id} value={item.id}>{languageLabel(item.id)}</option>
          ))}
        </select>
        <span className="lang-code" aria-hidden="true">{value.toUpperCase()}</span>
      </div>
      {hint && <p className="call-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

/** Read-only language (in call, invite panel and join screen): text plus code chip, no select. */
export function LanguageReadout({ language }: { language: string }) {
  return (
    <span className="lang-readout">
      <span><LanguageName id={language} /></span>
      <span className="lang-code" aria-hidden="true">{language.toUpperCase()}</span>
    </span>
  );
}
