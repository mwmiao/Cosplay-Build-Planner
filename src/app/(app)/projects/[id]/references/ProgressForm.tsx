"use client";

import { useId } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import type { FormState } from "@/lib/validation";

/** Edit a progress photo's day, stage and caption. */
export function ProgressForm({
  action,
  caption,
  stage,
  takenAt,
  stages,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  caption: string;
  stage: string;
  takenAt: string;
  stages: string[];
}) {
  const { t } = useI18n();
  const R = t.refs;
  const id = useId();
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field label={R.progressDate} name="takenAt" type="date" defaultValue={takenAt} errors={state.errors?.takenAt} />
      <Field label={R.stage} name="stage" defaultValue={stage} errors={state.errors?.stage} list={`${id}-stages`} autoComplete="off" />
      <datalist id={`${id}-stages`}>
        {[...new Set([...stages, ...R.stageSuggestions])].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <Field label={R.caption} name="caption" defaultValue={caption} errors={state.errors?.caption} />
      <SubmitButton className="btn-secondary w-full">{t.common.save}</SubmitButton>
    </form>
  );
}
