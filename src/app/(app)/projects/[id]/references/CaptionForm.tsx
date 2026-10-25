"use client";

import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
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
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field label="Caption" name="caption" defaultValue={caption} errors={state.errors?.caption} />
      <Field label="Source link" name="sourceUrl" type="url" defaultValue={sourceUrl} errors={state.errors?.sourceUrl} />
      <SubmitButton className="btn-secondary w-full">Save</SubmitButton>
    </form>
  );
}
