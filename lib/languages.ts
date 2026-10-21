/** Languages the workspace offers when configuring agents and voices. Kept to EN/RU (agent form tests). */
export const languageOptions = [
  { id: "en", label: "English" },
  { id: "ru", label: "Russian" },
];

export type InterpreterLanguage = { id: string; label: string; native: string };

/**
 * The 14 languages the Platform accepts for interpreters
 * (`INTERPRETER_LANGUAGES`, backend `platform/src/platform/validation.py`).
 */
export const interpreterLanguages: readonly InterpreterLanguage[] = [
  { id: "en", label: "English", native: "English" },
  { id: "ko", label: "Korean", native: "한국어" },
  { id: "ja", label: "Japanese", native: "日本語" },
  { id: "zh", label: "Chinese", native: "中文" },
  { id: "es", label: "Spanish", native: "Español" },
  { id: "fr", label: "French", native: "Français" },
  { id: "de", label: "German", native: "Deutsch" },
  { id: "it", label: "Italian", native: "Italiano" },
  { id: "pt", label: "Portuguese", native: "Português" },
  { id: "nl", label: "Dutch", native: "Nederlands" },
  { id: "ru", label: "Russian", native: "Русский" },
  { id: "hi", label: "Hindi", native: "हिन्दी" },
  { id: "tr", label: "Turkish", native: "Türkçe" },
  { id: "pl", label: "Polish", native: "Polski" },
];

/**
 * Languages Deepgram can code-switch between. `direction: "auto"` is only valid when both
 * interpreter languages are in this set (`AUTO_DIRECTION_LANGUAGES`, backend validation.py).
 */
export const AUTO_DIRECTION_LANGUAGES: ReadonlySet<string> = new Set(["en", "es", "fr", "de", "hi", "ru", "pt", "ja", "it", "nl"]);

export const isInterpreterLanguage = (id: string) => interpreterLanguages.some((item) => item.id === id);

/** `auto` when the backend allows it for this pair, otherwise `one_way` (e.g. any pair with Korean). */
export function interpreterDirection(a: string, b: string): "auto" | "one_way" {
  return AUTO_DIRECTION_LANGUAGES.has(a) && AUTO_DIRECTION_LANGUAGES.has(b) ? "auto" : "one_way";
}

export const languageName = (id: string) =>
  languageOptions.find((item) => item.id === id)?.label
  ?? interpreterLanguages.find((item) => item.id === id)?.label
  ?? id.toUpperCase();

export const nativeLanguageName = (id: string) => interpreterLanguages.find((item) => item.id === id)?.native ?? languageName(id);

/** "Korean · 한국어"; just "English" when the two names are the same. */
export function languageLabel(id: string) {
  const name = languageName(id);
  const native = nativeLanguageName(id);
  return native === name ? name : `${name} · ${native}`;
}
