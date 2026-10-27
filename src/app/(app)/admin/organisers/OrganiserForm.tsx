"use client";

import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import { EVENT_TYPES } from "@/lib/events/types";
import type { FormState } from "@/lib/validation";

export type OrganiserValues = {
  name: string;
  website: string;
  city: string;
  usualVenue: string;
  usualAddress: string;
  eventType: string;
  active: boolean;
};

export function OrganiserForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: OrganiserValues;
  submitLabel: string;
}) {
  const { t } = useI18n();
  const O = t.organisers;
  const [formState, formAction] = useFormState(action, {});
  // Saving redirects back to this same page, where the state can come back undefined.
  const state = formState ?? {};
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={O.name} name="name" required defaultValue={initial?.name} errors={e.name} placeholder="Quimera Art Market" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={O.website} name="website" type="url" inputMode="url" defaultValue={initial?.website} errors={e.website} placeholder="https://" />
        <Field
          as="select"
          label={t.events.eventType}
          name="eventType"
          options={EVENT_TYPES.map((v) => ({ value: v, label: t.events.types[v] }))}
          defaultValue={initial?.eventType ?? "other"}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t.events.city} name="city" defaultValue={initial?.city} errors={e.city} />
        <Field label={O.usualVenue} name="usualVenue" defaultValue={initial?.usualVenue} errors={e.usualVenue} />
        <Field label={O.usualAddress} name="usualAddress" defaultValue={initial?.usualAddress} errors={e.usualAddress} />
      </div>
      <label className="flex cursor-pointer gap-3">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="mt-1 h-5 w-5 rounded border-zinc-300 text-brand-600" />
        <span>
          <span className="block text-sm font-medium">{O.active}</span>
          <span className="hint block">{O.activeHint}</span>
        </span>
      </label>
      <SubmitButton className="btn-primary">{submitLabel}</SubmitButton>
    </form>
  );
}
