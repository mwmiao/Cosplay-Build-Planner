"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, StickyActions, SubmitButton } from "@/components/FormBits";
import { PROJECT_STATUSES, STATUS_LABELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";

export type ProjectFormValues = {
  characterName: string;
  series: string;
  conventionName: string;
  deadline: string;
  status: string;
  budget: string;
  spent: string;
  notes: string;
};

const statusOptions = PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

export function ProjectForm({
  action,
  initial,
  cancelHref,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: ProjectFormValues;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, {});
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Character name"
        name="characterName"
        required
        defaultValue={initial?.characterName}
        errors={e.characterName}
        placeholder="e.g. Jinx"
        autoComplete="off"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Series / game" name="series" defaultValue={initial?.series} errors={e.series} placeholder="e.g. Arcane" />
        <Field as="select" label="Status" name="status" options={statusOptions} defaultValue={initial?.status ?? "idea"} errors={e.status} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Convention" name="conventionName" defaultValue={initial?.conventionName} errors={e.conventionName} placeholder="e.g. MCM London" />
        <Field label="Deadline" name="deadline" type="date" defaultValue={initial?.deadline} errors={e.deadline} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Budget" name="budgetCents" inputMode="decimal" defaultValue={initial?.budget} errors={e.budgetCents} placeholder="0.00" />
        <Field
          label="Total spent (override)"
          name="spentCents"
          inputMode="decimal"
          defaultValue={initial?.spent}
          errors={e.spentCents}
          placeholder="Calculated from parts"
          hint="Leave blank to add up the parts' actual costs."
        />
      </div>
      <Field as="textarea" label="Notes" name="notes" defaultValue={initial?.notes} errors={e.notes} rows={4} />
      <StickyActions>
        <SubmitButton className="btn-primary flex-1 sm:flex-none">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="btn-secondary">
          Cancel
        </Link>
      </StickyActions>
    </form>
  );
}
