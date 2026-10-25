"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import { PASSWORD_MIN } from "@/lib/passwordRules";
import { changePassword, updateDisplayName } from "./actions";

export function DisplayNameForm({ name }: { name: string }) {
  const { t } = useI18n();
  const [state, action] = useFormState(updateDisplayName, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field
        label={t.auth.displayName}
        name="name"
        defaultValue={name}
        maxLength={60}
        required
        errors={state.errors?.name}
        hint={t.auth.displayNameHint}
      />
      <SubmitButton className="btn-secondary">{t.common.save}</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const { t } = useI18n();
  const A = t.auth;
  const [state, action] = useFormState(changePassword, {});
  const ref = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field label={A.currentPassword} name="current" type="password" autoComplete="current-password" required errors={e.current} />
      <Field
        label={A.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        errors={e.password}
        hint={A.passwordHint(PASSWORD_MIN)}
      />
      <Field label={A.confirmPassword} name="confirm" type="password" autoComplete="new-password" required errors={e.confirm} />
      <SubmitButton className="btn-secondary">{A.changePassword}</SubmitButton>
    </form>
  );
}
