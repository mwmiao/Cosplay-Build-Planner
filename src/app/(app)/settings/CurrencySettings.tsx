"use client";

import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { refreshRatesNow, saveDefaultCurrency } from "./actions";

export function DefaultCurrencyForm({ current }: { current: string }) {
  const [state, action] = useFormState(saveDefaultCurrency, {});
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field
        as="select"
        label="Default currency"
        name="defaultCurrency"
        options={CURRENCY_OPTIONS}
        defaultValue={current}
        errors={state.errors?.defaultCurrency}
        hint="Used for new projects, the shopping-list totals, and projects that haven't picked their own base currency."
      />
      <SubmitButton className="btn-secondary">Save</SubmitButton>
    </form>
  );
}

export function RefreshRatesButton() {
  const [state, action] = useFormState(refreshRatesNow, {});
  return (
    <form action={action} className="space-y-2">
      <FormMessage state={state} />
      <SubmitButton className="btn-secondary" pendingText="Updating…">
        Update rates now
      </SubmitButton>
    </form>
  );
}
