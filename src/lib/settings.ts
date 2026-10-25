import "server-only";
import { type CurrencyCode, DEFAULT_BASE_CURRENCY, isCurrency } from "./currencies";
import { db } from "./db";

/** The user's base currency for new projects and shopping-list totals. */
export async function getDefaultCurrency(userId: string): Promise<CurrencyCode> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { defaultCurrency: true } });
  if (isCurrency(user?.defaultCurrency)) return user.defaultCurrency;
  const fromEnv = process.env.DEFAULT_CURRENCY?.trim().toUpperCase();
  return isCurrency(fromEnv) ? fromEnv : DEFAULT_BASE_CURRENCY;
}

export async function setDefaultCurrency(userId: string, code: CurrencyCode): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { defaultCurrency: code } });
}
