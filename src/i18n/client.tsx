"use client";

import { createContext, useContext, useMemo } from "react";
import { formatters } from "@/lib/format";
import { DEFAULT_LOCALE, type Locale, getDictionary } from "./index";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Dictionary + formatters for client components. */
export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(() => {
    const t = getDictionary(locale);
    return { locale, t, f: formatters(t.intl) };
  }, [locale]);
}
