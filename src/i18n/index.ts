// Shared by server and client code.
import { type Dict, en } from "./en";
import { ptPT } from "./pt-PT";

export type { Dict };

export const LOCALES = ["en", "pt-PT"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

const dictionaries: Record<Locale, Dict> = { en, "pt-PT": ptPT };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale];
}

/** Picks a supported locale from an Accept-Language header ("pt-PT,pt;q=0.9,en;q=0.8"). */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const tags = header
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    if (tag.startsWith("pt")) return "pt-PT";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

/** Option lists that need translated labels. */
export function currencyOptions(intl: string, codes: readonly string[]) {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([intl], { type: "currency" });
  } catch {
    names = null;
  }
  return codes.map((code) => {
    const name = names?.of(code);
    return { value: code, label: name && name !== code ? `${code} — ${name}` : code };
  });
}
