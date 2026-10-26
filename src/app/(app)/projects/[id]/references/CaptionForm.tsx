"use client";

import { useId } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import type { FormState } from "@/lib/validation";

export function CaptionForm({
  action,
  caption,
  sourceUrl,
  groupName,
  groups = [],
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  caption: string;
  sourceUrl: string;
  /** Pass for reference images (shows the group field); omit for part photos. */
  groupName?: string;
  groups?: string[];
}) {
  const { t } = useI18n();
  const id = useId();
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field label={t.refs.caption} name="caption" defaultValue={caption} errors={state.errors?.caption} />
      {groupName !== undefined ? (
        <>
          <Field
            label={t.refs.group}
            name="groupName"
            defaultValue={groupName}
            errors={state.errors?.groupName}
            list={`${id}-groups`}
            autoComplete="off"
          />
          <datalist id={`${id}-groups`}>
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </>
      ) : null}
      <Field label={t.refs.sourceLink} name="sourceUrl" type="url" defaultValue={sourceUrl} errors={state.errors?.sourceUrl} />
      <SubmitButton className="btn-secondary w-full">{t.common.save}</SubmitButton>
    </form>
  );
}
