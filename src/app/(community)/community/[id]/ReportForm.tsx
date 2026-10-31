"use client";

import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import { REPORT_REASONS } from "@/lib/community/reports";
import { reportPublication } from "./actions";

/** "Report this project" (signed-in accounts, not the owner). */
export function ReportForm({ publicationId }: { publicationId: string }) {
  const { t } = useI18n();
  const R = t.community.report;
  const [state, action] = useFormState(reportPublication.bind(null, publicationId), {});
  if (state.ok) {
    return (
      <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="space-y-3" noValidate>
      <p className="hint">{R.intro}</p>
      <FormMessage state={state} />
      <Field
        as="select"
        label={R.reason}
        name="reason"
        required
        defaultValue="inappropriate"
        options={REPORT_REASONS.map((r) => ({ value: r, label: R.reasons[r] }))}
        errors={state.errors?.reason}
      />
      <Field as="textarea" label={R.note} name="note" rows={2} maxLength={500} />
      <SubmitButton className="btn-secondary" pendingText={t.common.working}>
        {R.submit}
      </SubmitButton>
    </form>
  );
}
