import "server-only";
import { type CurrencyCode, DEFAULT_BASE_CURRENCY, isCurrency } from "./currencies";
import { db } from "./db";

const DEFAULT_CURRENCY_KEY = "defaultCurrency";

/** Base currency for new projects and for shopping-list totals. */
export async function getDefaultCurrency(): Promise<CurrencyCode> {
  const row = await db.setting.findUnique({ where: { key: DEFAULT_CURRENCY_KEY } });
  if (row && isCurrency(row.value)) return row.value;
  const fromEnv = process.env.DEFAULT_CURRENCY?.trim().toUpperCase();
  return isCurrency(fromEnv) ? fromEnv : DEFAULT_BASE_CURRENCY;
}

export async function setDefaultCurrency(code: CurrencyCode): Promise<void> {
  await db.setting.upsert({
    where: { key: DEFAULT_CURRENCY_KEY },
    create: { key: DEFAULT_CURRENCY_KEY, value: code },
    update: { value: code },
  });
}
