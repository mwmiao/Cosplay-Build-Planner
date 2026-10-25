"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { addShoppingItem } from "./actions";

const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

export function AddItemForm({
  projects,
  defaultCurrency,
}: {
  projects: { id: string; characterName: string }[];
  defaultCurrency: string;
}) {
  const [state, action] = useFormState(addShoppingItem, {});
  const ref = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  const projectOptions = [
    { value: "", label: "General (no project)" },
    ...projects.map((p) => ({ value: p.id, label: p.characterName })),
  ];

  return (
    <form ref={ref} action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Item" name="name" required errors={e.name} placeholder="e.g. Contact cement" autoComplete="off" />
      <div className="grid grid-cols-2 gap-4">
        <Field as="select" label="Category" name="category" options={categoryOptions} defaultValue="materials" errors={e.category} />
        <Field as="select" label="Project" name="projectId" options={projectOptions} defaultValue="" errors={e.projectId} />
      </div>
      <Field label="Supplier" name="supplier" errors={e.supplier} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field as="select" label="Currency" name="currency" options={CURRENCY_OPTIONS} defaultValue={defaultCurrency} errors={e.currency} />
        <Field label="Est. cost (each)" name="estimatedCostCents" inputMode="decimal" placeholder="0.00" errors={e.estimatedCostCents} />
        <Field label="Qty" name="quantity" type="number" inputMode="numeric" min={1} defaultValue="1" errors={e.quantity} />
      </div>
      <Field label="Link" name="url" type="url" inputMode="url" placeholder="https://" errors={e.url} />
      <SubmitButton className="btn-primary w-full sm:w-auto">Add to list</SubmitButton>
    </form>
  );
}
