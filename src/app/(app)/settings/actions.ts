"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCALE_COOKIE, isLocale } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";
import { refreshLatestRates } from "@/lib/rates";
import { setDefaultCurrency } from "@/lib/settings";
import type { FormState } from "@/lib/validation";

export async function saveDefaultCurrency(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { t } = getI18n();
  const parsed = z.enum(CURRENCY_CODES).safeParse(formData.get("defaultCurrency"));
  if (!parsed.success) return { ok: false, errors: { defaultCurrency: [t.settings.pickCurrency] } };
  await setDefaultCurrency(user.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, message: t.settings.defaultCurrencySaved(parsed.data) };
}

export async function refreshRatesNow(_prev: FormState): Promise<FormState> {
  await requireUser();
  const { t } = getI18n();
  try {
    await refreshLatestRates();
  } catch (err) {
    console.error("Manual rate refresh failed", err);
    return { ok: false, message: t.settings.ratesFailed };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: t.settings.ratesUpdated };
}

/** Saves the UI language for this device (cookie, one year). No login needed: it's only a display preference. */
export async function setLanguage(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  cookies().set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
