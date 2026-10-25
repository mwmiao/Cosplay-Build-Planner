"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import { PASSWORD_MIN } from "@/lib/passwordRules";
import { requestPasswordReset, resetPassword, signIn, signUp } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const A = t.auth;
  const [state, action] = useFormState(signIn, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field label={A.email} name="email" type="email" autoComplete="email" required autoFocus />
      <Field label={A.password} name="password" type="password" autoComplete="current-password" required />
      <SubmitButton className="btn-primary w-full" pendingText={t.common.working}>
        {A.submitLogin}
      </SubmitButton>
      <div className="flex flex-col items-center gap-2 pt-2 text-sm">
        <Link href="/forgot-password" className="link">
          {A.forgot}
        </Link>
        <p className="text-zinc-500 dark:text-zinc-400">
          {A.noAccount}{" "}
          <Link href="/register" className="link">
            {A.createAccount}
          </Link>
        </p>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const { t } = useI18n();
  const A = t.auth;
  const [state, action] = useFormState(signUp, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label={A.displayName} name="name" required autoComplete="nickname" errors={e.name} hint={A.displayNameHint} maxLength={60} />
      <Field label={A.email} name="email" type="email" required autoComplete="email" errors={e.email} />
      <Field
        label={A.password}
        name="password"
        type="password"
        required
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        errors={e.password}
        hint={A.passwordHint(PASSWORD_MIN)}
      />
      <Field label={A.confirmPassword} name="confirm" type="password" required autoComplete="new-password" errors={e.confirm} />
      <SubmitButton className="btn-primary w-full" pendingText={t.common.working}>
        {A.submitRegister}
      </SubmitButton>
      <p className="pt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {A.haveAccount}{" "}
        <Link href="/login" className="link">
          {A.submitLogin}
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const { t } = useI18n();
  const A = t.auth;
  const [state, action] = useFormState(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {state.ok ? null : (
        <>
          <Field label={A.email} name="email" type="email" required autoComplete="email" errors={state.errors?.email} />
          <SubmitButton className="btn-primary w-full" pendingText={t.common.working}>
            {A.sendLink}
          </SubmitButton>
        </>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="link">
          {A.backToLogin}
        </Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { t } = useI18n();
  const A = t.auth;
  const [state, action] = useFormState(resetPassword, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {state.ok ? null : (
        <>
          <input type="hidden" name="token" value={token} />
          <Field
            label={A.newPassword}
            name="password"
            type="password"
            required
            autoComplete="new-password"
            errors={e.password}
            hint={A.passwordHint(PASSWORD_MIN)}
          />
          <Field label={A.confirmPassword} name="confirm" type="password" required autoComplete="new-password" errors={e.confirm} />
          <SubmitButton className="btn-primary w-full" pendingText={t.common.working}>
            {A.submitReset}
          </SubmitButton>
        </>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="link">
          {A.backToLogin}
        </Link>
      </p>
    </form>
  );
}
