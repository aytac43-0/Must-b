import { createContext, useContext, useState, type ReactNode } from "react";
import { en, type Translations } from "./locales/en";
import { tr } from "./locales/tr";
import { de } from "./locales/de";
import { fr } from "./locales/fr";
import { es } from "./locales/es";
import { ja } from "./locales/ja";
import { zh } from "./locales/zh";
import { pt } from "./locales/pt";

export type Locale = "en" | "tr" | "de" | "fr" | "es" | "ja" | "zh" | "pt";

const locales: Record<Locale, Translations> = { en, tr, de, fr, es, ja, zh, pt };

interface I18nContextType {
  locale: Locale;
  t: Translations;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  t: en,
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const saved = (
    typeof localStorage !== "undefined" ? localStorage.getItem("mustb-lang") : null
  ) as Locale | null;

  const [locale, setLocaleState] = useState<Locale>(
    saved && saved in locales ? saved : "en"
  );

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem("mustb-lang", l); } catch { /* incognito */ }
    // Persist to backend so LLM system prompt adopts the new language
    fetch("/api/settings/language", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ language: l }),
    }).catch(() => {});
  };

  return (
    <I18nContext.Provider value={{ locale, t: locales[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
