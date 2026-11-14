import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { formatters } from "@/lib/format";
import { LOCALE_COOKIE, type Locale, getDictionary, isLocale, localeFromAcceptLanguage } from "./index";

/** The visitor's language: their saved choice, else their browser's language. */
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

/** Dictionary + locale-aware formatters for server components, actions and routes. */
export const getI18n = cache(async () => {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return { locale, t, f: formatters(t.intl) };
});
