"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, StickyActions, SubmitButton } from "@/components/FormBits";
import { currencyOptions } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { PROJECT_STATUSES } from "@/lib/constants";
import { CURRENCY_CODES } from "@/lib/currencies";
import type { FormState } from "@/lib/validation";

export type ProjectFormValues = {
  characterName: string;
  series: string;
  conventionName: string;
  startDate: string;
  deadline: string;
  status: string;
  currency: string;
  budget: string;
  notes: string;
};


export function ProjectForm({
  action,
  initial,
  cancelHref,
  submitLabel,
  defaultCurrency,
  currencyNote,
  eventNames = [],
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: ProjectFormValues;
  defaultCurrency: string;
  /** e.g. why the base currency can't be changed any more */
  currencyNote?: string;
  cancelHref: string;
  submitLabel: string;
  /** Upcoming event names, suggested for the convention field */
  eventNames?: string[];
}) {
  const { t } = useI18n();
  const F = t.projectForm;
  const [state, formAction] = useFormState(action, {});
  const e = state.errors ?? {};
  const statusOptions = PROJECT_STATUSES.map((s) => ({ value: s, label: t.status[s] ?? s }));
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        label={F.characterName}
        name="characterName"
        required
        defaultValue={initial?.characterName}
        errors={e.characterName}
        placeholder={F.characterPlaceholder}
        autoComplete="off"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={F.series} name="series" defaultValue={initial?.series} errors={e.series} placeholder={F.seriesPlaceholder} />
        <Field as="select" label={F.status} name="status" options={statusOptions} defaultValue={initial?.status ?? "idea"} errors={e.status} />
      </div>
      <Field
        label={F.convention}
        name="conventionName"
        defaultValue={initial?.conventionName}
        errors={e.conventionName}
        placeholder={F.conventionPlaceholder}
        list={eventNames.length ? "event-names" : undefined}
        autoComplete="off"
      />
      {eventNames.length ? (
        <datalist id="event-names">
          {eventNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={F.startDate} name="startDate" type="date" defaultValue={initial?.startDate} errors={e.startDate} />
        <Field label={F.deadline} name="deadline" type="date" defaultValue={initial?.deadline} errors={e.deadline} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          as="select"
          label={F.baseCurrency}
          name="currency"
          options={currencyOptions(t.intl, CURRENCY_CODES)}
          defaultValue={initial?.currency ?? defaultCurrency}
          errors={e.currency}
          hint={currencyNote ?? F.baseCurrencyHint}
        />
        <Field label={F.budget} name="budgetCents" inputMode="decimal" defaultValue={initial?.budget} errors={e.budgetCents} placeholder="0.00" />
      </div>
      <Field as="textarea" label={F.notes} name="notes" defaultValue={initial?.notes} errors={e.notes} rows={4} />
      <StickyActions>
        <SubmitButton className="btn-primary flex-1 sm:flex-none">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="btn-secondary hidden sm:inline-flex">
          {t.common.cancel}
        </Link>
      </StickyActions>
    </form>
  );
}
