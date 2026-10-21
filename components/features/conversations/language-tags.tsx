/** The languages detected in one message. Two or more means the speaker switched mid-message. */
export function LanguageTags({ primary, detected }: Readonly<{ primary: string | null; detected: string[] }>) {
  const languages = [...new Set([...(primary ? [primary] : []), ...detected])];
  if (languages.length === 0) return null;
  return <span className="lang-tags" role="group" aria-label="Languages in this message">
    {languages.map((language) => <span className="lang-tag" data-primary={language === primary} key={language}>{language.toUpperCase()}</span>)}
    {detected.length > 1 && <span className="lang-switch">switch</span>}
  </span>;
}
