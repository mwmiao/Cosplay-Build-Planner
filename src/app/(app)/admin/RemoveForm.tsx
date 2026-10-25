"use client";

import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { ConfirmButton, FormMessage } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import { removePublication } from "./actions";

/** Reason + confirm. Used on the moderation page and on public project pages (admins only). */
export function RemoveForm({ publicationId }: { publicationId: string }) {
  const { t } = useI18n();
  const A = t.admin;
  const [state, action] = useFormState(removePublication.bind(null, publicationId), {});
  if (state.ok) {
    return (
      <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="space-y-2" noValidate>
      <FormMessage state={state} />
      <Field
        as="textarea"
        label={A.reason}
        name="reason"
        rows={2}
        maxLength={500}
        required
        hint={A.reasonHint}
        errors={state.errors?.reason}
      />
      <ConfirmButton message={A.removeConfirm} className="btn-danger">
        {A.remove}
      </ConfirmButton>
    </form>
  );
}
