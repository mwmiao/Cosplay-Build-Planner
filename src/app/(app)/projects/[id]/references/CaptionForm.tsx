"use client";

import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import type { FormState } from "@/lib/validation";

export function CaptionForm({
  action,
  caption,
  sourceUrl,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  caption: string;
  sourceUrl: string;
}) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field label={t.refs.caption} name="caption" defaultValue={caption} errors={state.errors?.caption} />
      <Field label={t.refs.sourceLink} name="sourceUrl" type="url" defaultValue={sourceUrl} errors={state.errors?.sourceUrl} />
      <SubmitButton className="btn-secondary w-full">{t.common.save}</SubmitButton>
    </form>
  );
}
