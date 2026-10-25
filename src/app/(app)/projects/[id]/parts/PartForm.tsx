"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, StickyActions, SubmitButton } from "@/components/FormBits";
import { currencyOptions } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { CATEGORIES, PART_STATUSES } from "@/lib/constants";
import { CURRENCY_CODES } from "@/lib/currencies";
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
  const { t } = useI18n();
  const F = t.partForm;
  const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: t.category[c] ?? c }));
  const statusOptions = PART_STATUSES.map((s) => ({ value: s, label: t.status[s] ?? s }));
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
      <Field label={F.name} name="name" required defaultValue={initial?.name} errors={e.name} placeholder={F.namePlaceholder} autoComplete="off" />
      <div className="grid grid-cols-2 gap-4">
        <Field as="select" label={F.category} name="category" options={categoryOptions} defaultValue={initial?.category ?? "other"} errors={e.category} />
        <Field as="select" label={F.status} name="status" options={statusOptions} defaultValue={initial?.status ?? "needed"} errors={e.status} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field
          as="select"
          label={F.currency}
          name="currency"
          options={currencyOptions(t.intl, CURRENCY_CODES)}
          value={currency}
          onChange={(ev) => setCurrency(ev.currentTarget.value)}
          errors={e.currency}
        />
        <Field label={F.qty} name="quantity" type="number" inputMode="numeric" min={1} max={9999} defaultValue={initial?.quantity ?? "1"} errors={e.quantity} />
        <Field label={F.estimated} name="estimatedCostCents" inputMode="decimal" defaultValue={initial?.estimatedCost} errors={e.estimatedCostCents} placeholder="0.00" />
        <Field label={F.actual} name="actualCostCents" inputMode="decimal" defaultValue={initial?.actualCost} errors={e.actualCostCents} placeholder="0.00" />
      </div>
      {foreign ? (
        <p className="hint -mt-2">{F.foreignNote(currency, baseCurrency)}</p>
      ) : null}

      <fieldset className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-sm font-semibold">{F.payment}</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="paid"
            checked={paid}
            onChange={(ev) => setPaid(ev.currentTarget.checked)}
            className="h-5 w-5 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium">{F.paid}</span>
        </label>
        {paid ? (
          <div className="mt-2 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={F.paidOn}
                name="paidAt"
                type="date"
                max={todayLocal()}
                defaultValue={initial?.paidAt || todayLocal()}
                errors={e.paidAt}
              />
              <Field
                label={F.charged(baseCurrency)}
                name="chargedBaseCents"
                inputMode="decimal"
                defaultValue={initial?.chargedBase}
                errors={e.chargedBaseCents}
                placeholder={foreign ? F.chargedPlaceholder : "0.00"}
                hint={foreign ? F.chargedHintForeign(currency, baseCurrency) : F.chargedHintSame}
              />
            </div>
            {conversion}
          </div>
        ) : (
          <p className="hint">{F.tickWhenPaid(baseCurrency)}</p>
        )}
      </fieldset>

      <Field label={F.supplier} name="supplier" defaultValue={initial?.supplier} errors={e.supplier} placeholder={F.supplierPlaceholder} list="supplier-options" autoComplete="off" />
      <datalist id="supplier-options">
        {suppliers.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Field label={F.link} name="url" type="url" inputMode="url" defaultValue={initial?.url} errors={e.url} placeholder="https://" />
      <Field as="textarea" label={F.notes} name="notes" defaultValue={initial?.notes} errors={e.notes} rows={3} />
      <StickyActions>
        <SubmitButton className="btn-primary flex-1 sm:flex-none" name="intent" value="save">
          {submitLabel}
        </SubmitButton>
        {allowAddAnother ? (
          <SubmitButton className="btn-secondary" name="intent" value="add-another">
            {F.saveAndAdd}
          </SubmitButton>
        ) : null}
        <Link href={cancelHref} className="btn-ghost hidden sm:inline-flex">
          {t.common.cancel}
        </Link>
      </StickyActions>
    </form>
  );
}
