"use client";

import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import { login } from "./actions";

export function LoginForm() {
  const { t } = useI18n();
  const [state, action] = useFormState(login, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field
        label={t.login.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        errors={state.errors?.password}
      />
      <SubmitButton className="btn-primary w-full">{t.login.submit}</SubmitButton>
    </form>
  );
}
