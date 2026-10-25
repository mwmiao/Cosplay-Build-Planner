"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { currencyOptions } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { CATEGORIES } from "@/lib/constants";
import { CURRENCY_CODES } from "@/lib/currencies";
import { addShoppingItem } from "./actions";


export function AddItemForm({
  projects,
  defaultCurrency,
}: {
  projects: { id: string; characterName: string }[];
  defaultCurrency: string;
}) {
  const { t } = useI18n();
  const S = t.shopping;
  const [state, action] = useFormState(addShoppingItem, {});
  const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: t.category[c] ?? c }));
  const ref = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  const projectOptions = [
    { value: "", label: S.noProject },
    ...projects.map((p) => ({ value: p.id, label: p.characterName })),
  ];

  return (
    <form ref={ref} action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label={S.item} name="name" required errors={e.name} placeholder={S.itemPlaceholder} autoComplete="off" />
      <div className="grid grid-cols-2 gap-4">
        <Field as="select" label={S.category} name="category" options={categoryOptions} defaultValue="materials" errors={e.category} />
        <Field as="select" label={S.project} name="projectId" options={projectOptions} defaultValue="" errors={e.projectId} />
      </div>
      <Field label={S.supplier} name="supplier" errors={e.supplier} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field as="select" label={S.currency} name="currency" options={currencyOptions(t.intl, CURRENCY_CODES)} defaultValue={defaultCurrency} errors={e.currency} />
        <Field label={S.estimated} name="estimatedCostCents" inputMode="decimal" placeholder="0.00" errors={e.estimatedCostCents} />
        <Field label={S.qty} name="quantity" type="number" inputMode="numeric" min={1} defaultValue="1" errors={e.quantity} />
      </div>
      <Field label={S.link} name="url" type="url" inputMode="url" placeholder="https://" errors={e.url} />
      <SubmitButton className="btn-primary w-full sm:w-auto">{S.add}</SubmitButton>
    </form>
  );
}
