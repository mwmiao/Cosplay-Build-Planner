import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton, SubmitButton } from "@/components/FormBits";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { GUEST_MAX_BYTES, GUEST_MAX_PROJECTS, guestUsage } from "@/lib/guest";
import { signOut } from "../../(auth)/actions";
import { ChangePasswordForm, DeleteAccountForm, DisplayNameForm } from "./AccountForms";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.auth.accountTitle };
}

export default async function AccountPage() {
  const user = await requireUser();
  const { t } = getI18n();
  const A = t.auth;
  if (user.isGuest) {
    const G = t.guest;
    const usage = await guestUsage(user.id);
    const mb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;
    return (
      <>
        <h1 className="page-title mb-4">{G.guestAccount}</h1>
        <section className="card mb-6 space-y-3">
          <p className="text-sm">{G.accountIntro}</p>
          <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
            <li>{G.usageProjects(usage.projects, GUEST_MAX_PROJECTS)}</li>
            <li>{G.usageStorage(mb(usage.bytes), mb(GUEST_MAX_BYTES))}</li>
          </ul>
          <p className="hint">{G.encryptionNote}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/register" className="btn-primary">
              {G.createAccount}
            </Link>
            <Link href="/login" className="btn-secondary">
              {G.logIn}
            </Link>
          </div>
        </section>
        <form action={signOut}>
          <ConfirmButton className="btn-danger w-full sm:w-auto" message={G.leaveConfirm}>
            {G.leave}
          </ConfirmButton>
        </form>
      </>
    );
  }
  return (
    <>
      <h1 className="page-title mb-4">{A.accountTitle}</h1>

      <section className="card mb-6 space-y-4" aria-labelledby="profile-title">
        <h2 id="profile-title" className="section-title">
          {A.profile}
        </h2>
        <div className="text-sm">
          <div className="text-zinc-600 dark:text-zinc-400">{A.email}</div>
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

      <section className="card mb-6 space-y-3" aria-labelledby="data-title">
        <h2 id="data-title" className="section-title">
          {A.yourData}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{A.yourDataText}</p>
        <a href="/api/export/account" className="btn-secondary w-full sm:w-auto" data-testid="export-account">
          {A.exportData}
        </a>
      </section>

      <form action={signOut} className="mb-6">
        <SubmitButton className="btn-secondary w-full sm:w-auto" pendingText={A.loggingOut}>
          {A.logout}
        </SubmitButton>
      </form>

      <section className="card space-y-3 border-red-300 dark:border-red-900" aria-labelledby="delete-title" data-testid="delete-account">
        <h2 id="delete-title" className="section-title text-red-700 dark:text-red-400">
          {A.deleteTitle}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{A.deleteText}</p>
        {user.isAdmin ? <p className="text-sm">{A.deleteAdminBlocked}</p> : <DeleteAccountForm />}
      </section>
    </>
  );
}
