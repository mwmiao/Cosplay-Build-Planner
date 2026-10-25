"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";
import { refreshLatestRates } from "@/lib/rates";
import { setDefaultCurrency } from "@/lib/settings";
import type { FormState } from "@/lib/validation";

export async function saveDefaultCurrency(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = z.enum(CURRENCY_CODES).safeParse(formData.get("defaultCurrency"));
  if (!parsed.success) return { ok: false, errors: { defaultCurrency: ["Pick a currency"] } };
  await setDefaultCurrency(parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, message: `Default currency set to ${parsed.data}.` };
}

export async function refreshRatesNow(_prev: FormState): Promise<FormState> {
  await requireAuth();
  try {
    await refreshLatestRates();
  } catch (err) {
    console.error("Manual rate refresh failed", err);
    return { ok: false, message: "Couldn't reach the exchange-rate services. The last saved rates are still used." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Exchange rates updated." };
}
