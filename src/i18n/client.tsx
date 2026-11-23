"use client";

import { createContext, useContext } from "react";
import { defaultLocale, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

const LocaleContext = createContext<Locale>(defaultLocale);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useDictionary() {
  return getDictionary(useContext(LocaleContext));
}
