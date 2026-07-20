import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, getTranslation, normalizeLanguage, type AppLanguage } from "../lib/i18n";

type LanguageContextType = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const LANGUAGE_STORAGE_KEY = "metoyou-language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return normalizeLanguage(saved ?? DEFAULT_LANGUAGE);
  });

  const setLanguage = useCallback((lang: AppLanguage) => {
    const normalized = normalizeLanguage(lang);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    setLanguageState(normalized);
  }, []);

  const t = useMemo(() => (key: string) => getTranslation(language, key), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
