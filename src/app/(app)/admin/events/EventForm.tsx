"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, StickyActions, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import type { FormState } from "@/lib/validation";

export type EventFormValues = {
  name: string;
  startDate: string;
  endDate: string;
  city: string;
  venue: string;
  url: string;
  notes: string;
};

export function EventForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: EventFormValues;
  submitLabel: string;
}) {
  const { t } = useI18n();
  const E = t.events;
  const [state, formAction] = useFormState(action, {});
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label={E.name} name="name" required defaultValue={initial?.name} errors={e.name} placeholder="Lisboa Games Week 2027" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={E.startDate} name="startDate" type="date" required defaultValue={initial?.startDate} errors={e.startDate} />
        <Field label={E.endDate} name="endDate" type="date" defaultValue={initial?.endDate} errors={e.endDate} hint={E.endDateHint} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={E.city} name="city" required defaultValue={initial?.city} errors={e.city} placeholder="Lisboa" />
        <Field label={E.venue} name="venue" defaultValue={initial?.venue} errors={e.venue} placeholder="FIL" />
      </div>
      <Field label={E.link} name="url" type="url" inputMode="url" defaultValue={initial?.url} errors={e.url} placeholder="https://" hint={E.linkHint} />
      <Field as="textarea" label={E.notes} name="notes" defaultValue={initial?.notes} errors={e.notes} rows={3} />
      <StickyActions>
        <SubmitButton className="btn-primary flex-1 sm:flex-none">{submitLabel}</SubmitButton>
        <Link href="/events" className="btn-secondary hidden sm:inline-flex">
          {t.common.cancel}
        </Link>
      </StickyActions>
    </form>
  );
}
