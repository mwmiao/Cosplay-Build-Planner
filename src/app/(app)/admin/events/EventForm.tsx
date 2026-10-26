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
  address: string;
  mapUrl: string;
  url: string;
  sourceUrl: string;
  notes: string;
};

/** Admin add/edit form; with `suggest`, the user-facing suggestion form (no exact map link). */
export function EventForm({
  action,
  initial,
  submitLabel,
  suggest = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: EventFormValues;
  submitLabel: string;
  suggest?: boolean;
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
        <Field label={E.venue} name="venue" defaultValue={initial?.venue} errors={e.venue} placeholder="FIL – Parque das Nações" hint={E.venueHint} />
      </div>
      <Field label={E.address} name="address" defaultValue={initial?.address} errors={e.address} hint={E.addressHint} />
      {suggest ? null : (
        <Field label={E.mapUrl} name="mapUrl" type="url" inputMode="url" defaultValue={initial?.mapUrl} errors={e.mapUrl} placeholder="https://maps.app.goo.gl/…" hint={E.mapUrlHint} />
      )}
      <Field label={E.link} name="url" type="url" inputMode="url" defaultValue={initial?.url} errors={e.url} placeholder="https://" hint={E.linkHint} />
      {suggest ? (
        <Field label={E.sourceUrl} name="sourceUrl" type="url" inputMode="url" defaultValue={initial?.sourceUrl} errors={e.sourceUrl} placeholder="https://www.instagram.com/p/…" hint={E.sourceUrlHint} />
      ) : (
        <input type="hidden" name="sourceUrl" value={initial?.sourceUrl ?? ""} />
      )}
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
