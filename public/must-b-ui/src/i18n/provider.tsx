import { createContext, useContext, useState, type ReactNode } from "react";
import { en, type Translations } from "./locales/en";
import { tr } from "./locales/tr";
import { de } from "./locales/de";

export type Locale = "en" | "tr" | "de";

const locales: Record<Locale, Translations> = { en, tr, de };

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
  };

  return (
    <I18nContext.Provider value={{ locale, t: locales[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
