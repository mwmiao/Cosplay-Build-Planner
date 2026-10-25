// Currencies offered in forms. Shared by client and server code.
// Amounts are always stored ×100 ("cents") whatever the currency; display
// formatting decides how many decimals to show (e.g. none for JPY).

export const CURRENCIES = [
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British pound" },
  { code: "USD", name: "US dollar" },
  { code: "JPY", name: "Japanese yen" },
  { code: "CNY", name: "Chinese yuan" },
  { code: "KRW", name: "South Korean won" },
  { code: "TWD", name: "Taiwan dollar" },
  { code: "HKD", name: "Hong Kong dollar" },
  { code: "SGD", name: "Singapore dollar" },
  { code: "MYR", name: "Malaysian ringgit" },
  { code: "THB", name: "Thai baht" },
  { code: "PHP", name: "Philippine peso" },
  { code: "IDR", name: "Indonesian rupiah" },
  { code: "INR", name: "Indian rupee" },
  { code: "AUD", name: "Australian dollar" },
  { code: "NZD", name: "New Zealand dollar" },
  { code: "CAD", name: "Canadian dollar" },
  { code: "MXN", name: "Mexican peso" },
  { code: "BRL", name: "Brazilian real" },
  { code: "ARS", name: "Argentine peso" },
  { code: "CLP", name: "Chilean peso" },
  { code: "CHF", name: "Swiss franc" },
  { code: "SEK", name: "Swedish krona" },
  { code: "NOK", name: "Norwegian krone" },
  { code: "DKK", name: "Danish krone" },
  { code: "PLN", name: "Polish złoty" },
  { code: "CZK", name: "Czech koruna" },
  { code: "HUF", name: "Hungarian forint" },
  { code: "RON", name: "Romanian leu" },
  { code: "TRY", name: "Turkish lira" },
  { code: "ILS", name: "Israeli shekel" },
  { code: "AED", name: "UAE dirham" },
  { code: "SAR", name: "Saudi riyal" },
  { code: "ZAR", name: "South African rand" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];
export const DEFAULT_BASE_CURRENCY: CurrencyCode = "EUR";

export function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}

export const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));
