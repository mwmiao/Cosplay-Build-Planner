"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, StickyActions, SubmitButton } from "@/components/FormBits";
import { CATEGORIES, CATEGORY_LABELS, PART_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import type { FormState } from "@/lib/validation";

export type PartFormValues = {
  name: string;
  category: string;
  status: string;
  currency: string;
  estimatedCost: string;
  actualCost: string;
  quantity: string;
  supplier: string;
  url: string;
  notes: string;
  paid: boolean;
  paidAt: string;
  /** Only filled when the stored conversion was entered manually */
  chargedBase: string;
};

const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));
const statusOptions = PART_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PartForm({
  action,
  initial,
  defaultCurrency,
  baseCurrency,
  cancelHref,
  submitLabel,
  allowAddAnother = false,
  suppliers = [],
  conversion,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: PartFormValues;
  /** Pre-selected currency for new parts (the project's base currency) */
  defaultCurrency: string;
  /** The project's base currency, which paid amounts are converted into */
  baseCurrency: string;
  cancelHref: string;
  submitLabel: string;
  allowAddAnother?: boolean;
  suppliers?: string[];
  /** Read-only summary of the stored conversion, shown under the payment fields */
  conversion?: React.ReactNode;
}) {
  const [state, formAction] = useFormState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [paid, setPaid] = useState(initial?.paid ?? false);
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const e = state.errors ?? {};

  // After "Save & add another", clear the form for the next part.
  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset();
      setPaid(false);
      setCurrency(defaultCurrency);
      formRef.current.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    }
  }, [state, defaultCurrency]);

  const foreign = currency !== baseCurrency;

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Part name" name="name" required defaultValue={initial?.name} errors={e.name} placeholder="e.g. Shoulder armor" autoComplete="off" />
      <div className="grid grid-cols-2 gap-4">
        <Field as="select" label="Category" name="category" options={categoryOptions} defaultValue={initial?.category ?? "other"} errors={e.category} />
        <Field as="select" label="Status" name="status" options={statusOptions} defaultValue={initial?.status ?? "needed"} errors={e.status} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field
          as="select"
          label="Currency"
          name="currency"
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={(ev) => setCurrency(ev.currentTarget.value)}
          errors={e.currency}
        />
        <Field label="Qty" name="quantity" type="number" inputMode="numeric" min={1} max={9999} defaultValue={initial?.quantity ?? "1"} errors={e.quantity} />
        <Field label="Est. cost (each)" name="estimatedCostCents" inputMode="decimal" defaultValue={initial?.estimatedCost} errors={e.estimatedCostCents} placeholder="0.00" />
        <Field label="Actual (each)" name="actualCostCents" inputMode="decimal" defaultValue={initial?.actualCost} errors={e.actualCostCents} placeholder="0.00" />
      </div>
      {foreign ? (
        <p className="hint -mt-2">
          Amounts in {currency}. Totals are shown in {baseCurrency}: estimates at today&apos;s rate, payments at the rate of the
          payment date.
        </p>
      ) : null}

      <fieldset className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-sm font-semibold">Payment</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="paid"
            checked={paid}
            onChange={(ev) => setPaid(ev.currentTarget.checked)}
            className="h-5 w-5 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium">Paid</span>
        </label>
        {paid ? (
          <div className="mt-2 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Paid on"
                name="paidAt"
                type="date"
                max={todayLocal()}
                defaultValue={initial?.paidAt || todayLocal()}
                errors={e.paidAt}
              />
              <Field
                label={`Amount charged in ${baseCurrency} (total, optional)`}
                name="chargedBaseCents"
                inputMode="decimal"
                defaultValue={initial?.chargedBase}
                errors={e.chargedBaseCents}
                placeholder={foreign ? "From your bank/PayPal" : "0.00"}
                hint={
                  foreign
                    ? `Leave blank to convert automatically at the ${currency}→${baseCurrency} rate for the payment date.`
                    : "Leave blank to use actual × quantity."
                }
              />
            </div>
            {conversion}
          </div>
        ) : (
          <p className="hint">Tick when paid: the amount is converted to {baseCurrency} once and kept.</p>
        )}
      </fieldset>

      <Field label="Supplier" name="supplier" defaultValue={initial?.supplier} errors={e.supplier} placeholder="e.g. Etsy, local craft store" list="supplier-options" autoComplete="off" />
      <datalist id="supplier-options">
        {suppliers.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Field label="Link" name="url" type="url" inputMode="url" defaultValue={initial?.url} errors={e.url} placeholder="https://" />
      <Field as="textarea" label="Notes" name="notes" defaultValue={initial?.notes} errors={e.notes} rows={3} />
      <StickyActions>
        <SubmitButton className="btn-primary flex-1 sm:flex-none" name="intent" value="save">
          {submitLabel}
        </SubmitButton>
        {allowAddAnother ? (
          <SubmitButton className="btn-secondary" name="intent" value="add-another">
            Save &amp; add another
          </SubmitButton>
        ) : null}
        <Link href={cancelHref} className="btn-ghost">
          Cancel
        </Link>
      </StickyActions>
    </form>
  );
}
