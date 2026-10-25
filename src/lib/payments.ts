import "server-only";
import type { BuildPart } from "@prisma/client";
import { historicalRate } from "./rates";

export type PaymentFields = Pick<
  BuildPart,
  "paidAt" | "paidBaseCents" | "fxRate" | "fxRateDate" | "fxSource" | "fxManual"
>;

export const UNPAID: PaymentFields = {
  paidAt: null,
  paidBaseCents: null,
  fxRate: null,
  fxRateDate: null,
  fxSource: null,
  fxManual: false,
};

export const MANUAL_SOURCE = "Manual (amount charged by bank/PayPal)";

type PaymentInput = {
  currency: string;
  actualCostCents: number;
  quantity: number;
  paidAt: Date;
  /** Total charged in the base currency, if the user typed it in. */
  chargedBaseCents?: number;
};

type Previous = Pick<BuildPart, "currency" | "actualCostCents" | "quantity"> & PaymentFields;

function sameInputs(prev: Previous, input: PaymentInput, base: string): boolean {
  if (!prev.paidAt || prev.paidBaseCents === null) return false;
  const prevManual = prev.fxManual ? prev.paidBaseCents : undefined;
  return (
    (prev.currency ?? base) === input.currency &&
    prev.actualCostCents === input.actualCostCents &&
    prev.quantity === input.quantity &&
    prev.paidAt.getTime() === input.paidAt.getTime() &&
    prevManual === input.chargedBaseCents
  );
}

/**
 * Converts a payment into the project's base currency, once.
 *
 * - Nothing about the payment changed → the stored conversion is kept as-is
 *   (never redone at today's rate).
 * - Charged amount typed in → used as-is; the implied rate is stored.
 * - Otherwise → the rate for the payment date is looked up and stored.
 *
 * Throws RateUnavailableError when no rate exists for that date.
 */
export async function convertPayment(
  input: PaymentInput,
  base: string,
  previous: Previous | null,
): Promise<PaymentFields> {
  if (previous && sameInputs(previous, input, base)) {
    const { paidAt, paidBaseCents, fxRate, fxRateDate, fxSource, fxManual } = previous;
    return { paidAt, paidBaseCents, fxRate, fxRateDate, fxSource, fxManual };
  }

  const original = input.actualCostCents * input.quantity;
  const day = input.paidAt.toISOString().slice(0, 10);

  if (input.chargedBaseCents !== undefined) {
    return {
      paidAt: input.paidAt,
      paidBaseCents: input.chargedBaseCents,
      fxRate: original > 0 ? input.chargedBaseCents / original : null,
      fxRateDate: day,
      fxSource: input.currency === base ? "Same currency (amount entered)" : MANUAL_SOURCE,
      fxManual: true,
    };
  }

  const { rate, rateDate, source } = await historicalRate(input.currency, base, day);
  return {
    paidAt: input.paidAt,
    paidBaseCents: Math.round(original * rate),
    fxRate: rate,
    fxRateDate: rateDate,
    fxSource: source,
    fxManual: false,
  };
}
