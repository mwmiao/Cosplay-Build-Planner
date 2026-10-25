// Currencies offered in forms. Shared by client and server code.
// Amounts are always stored ×100 ("cents") whatever the currency; display
// formatting decides how many decimals to show (e.g. none for JPY).
// Names are shown in the UI language via Intl.DisplayNames (see currencyOptions).

export const CURRENCY_CODES = [
  "EUR", "GBP", "USD", "JPY", "CNY", "KRW", "TWD", "HKD", "SGD", "MYR", "THB", "PHP",
  "IDR", "INR", "AUD", "NZD", "CAD", "MXN", "BRL", "ARS", "CLP", "CHF", "SEK", "NOK",
  "DKK", "PLN", "CZK", "HUF", "RON", "TRY", "ILS", "AED", "SAR", "ZAR",
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];
export const DEFAULT_BASE_CURRENCY: CurrencyCode = "EUR";

export function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}
