import type { Metadata } from "next";
import { SubmitButton } from "@/components/FormBits";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { signOut } from "../../(auth)/actions";
import { ChangePasswordForm, DisplayNameForm } from "./AccountForms";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.auth.accountTitle };
}

export default async function AccountPage() {
  const user = await requireUser();
  const { t } = getI18n();
  const A = t.auth;
  return (
    <>
      <h1 className="page-title mb-4">{A.accountTitle}</h1>

      <section className="card mb-6 space-y-4" aria-labelledby="profile-title">
        <h2 id="profile-title" className="section-title">
          {A.profile}
        </h2>
        <div className="text-sm">
          <div className="text-zinc-500 dark:text-zinc-400">{A.email}</div>
          <div className="font-medium">{user.email}</div>
          <p className="hint">{A.emailPrivate}</p>
        </div>
        <DisplayNameForm name={user.name} />
      </section>

      <section className="card mb-6 space-y-4" aria-labelledby="password-title">
        <h2 id="password-title" className="section-title">
          {A.changePassword}
        </h2>
        <ChangePasswordForm />
      </section>

      <form action={signOut}>
        <SubmitButton className="btn-secondary w-full sm:w-auto" pendingText={A.loggingOut}>
          {A.logout}
        </SubmitButton>
      </form>
    </>
  );
}
