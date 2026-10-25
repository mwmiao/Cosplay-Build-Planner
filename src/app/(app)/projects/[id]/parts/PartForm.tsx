"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, StickyActions, SubmitButton } from "@/components/FormBits";
import { CATEGORIES, CATEGORY_LABELS, PART_STATUSES, STATUS_LABELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";

export type PartFormValues = {
  name: string;
  category: string;
  status: string;
  estimatedCost: string;
  actualCost: string;
  quantity: string;
  supplier: string;
  url: string;
  notes: string;
};

const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));
const statusOptions = PART_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

export function PartForm({
  action,
  initial,
  cancelHref,
  submitLabel,
  allowAddAnother = false,
  suppliers = [],
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: PartFormValues;
  cancelHref: string;
  submitLabel: string;
  allowAddAnother?: boolean;
  suppliers?: string[];
}) {
  const [state, formAction] = useFormState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  // After "Save & add another", clear the form for the next part.
  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset();
      formRef.current.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Part name" name="name" required defaultValue={initial?.name} errors={e.name} placeholder="e.g. Shoulder armor" autoComplete="off" />
      <div className="grid grid-cols-2 gap-4">
        <Field as="select" label="Category" name="category" options={categoryOptions} defaultValue={initial?.category ?? "other"} errors={e.category} />
        <Field as="select" label="Status" name="status" options={statusOptions} defaultValue={initial?.status ?? "needed"} errors={e.status} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Est. cost (each)" name="estimatedCostCents" inputMode="decimal" defaultValue={initial?.estimatedCost} errors={e.estimatedCostCents} placeholder="0.00" />
        <Field label="Actual (each)" name="actualCostCents" inputMode="decimal" defaultValue={initial?.actualCost} errors={e.actualCostCents} placeholder="0.00" />
        <Field label="Qty" name="quantity" type="number" inputMode="numeric" min={1} max={9999} defaultValue={initial?.quantity ?? "1"} errors={e.quantity} />
      </div>
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
