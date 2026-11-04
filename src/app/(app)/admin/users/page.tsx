import type { Metadata } from "next";
import { ConfirmButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { setModerator, setSuspended } from "../actions";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.admin.users };
}

const PAGE_SIZE = 50;

/**
 * Admins grant or remove the moderator role. Emails are never listed (admins
 * don't see them): an account can be found by display name, or by typing its
 * exact email.
 */
export default async function UsersPage({ searchParams }: { searchParams: { q?: string; changed?: string; error?: string } }) {
  const admin = await requireAdmin();
  const { t, f } = getI18n();
  const A = t.admin;
  const q = (searchParams.q ?? "").trim().slice(0, 100);
  const users = await db.user.findMany({
    where: {
      isAnonymous: false,
      ...(q ? { OR: [{ name: { contains: q } }, { email: q.toLowerCase() }] } : {}),
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    take: PAGE_SIZE,
    select: { id: true, name: true, role: true, createdAt: true, suspendedAt: true },
  });
  const recent = await db.roleChange.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  const changed = searchParams.changed ? users.find((u) => u.id === searchParams.changed) : undefined;
  return (
    <>
      <BackLink href="/admin">{A.title}</BackLink>
      <h1 className="page-title">{A.users}</h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{A.usersIntro}</p>
      {changed ? (
        <p role="status" className="mb-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          {A.roleChanged(changed.name)}
        </p>
      ) : null}
      {searchParams.error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {A.roleNotAllowed}
        </p>
      ) : null}
      <form className="mb-4 flex items-end gap-2" role="search">
        <div className="min-w-0 flex-1">
          <label htmlFor="users-q" className="label">
            {A.usersSearch}
          </label>
          <input id="users-q" name="q" type="search" defaultValue={q} className="input" autoComplete="off" />
        </div>
        <button type="submit" className="btn-primary">
          {A.usersSearchButton}
        </button>
      </form>
      {users.length === 0 ? (
        <p className="text-sm text-zinc-600">{A.usersNone}</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => {
            const role = (A.roles as Record<string, string>)[u.role] ?? u.role;
            const isModerator = u.role === "moderator";
            return (
              <li key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-3" data-testid="user-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-semibold">{u.name}</span>
                    <span className="rounded-full bg-zinc-100 px-2 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{role}</span>
                    {u.suspendedAt ? (
                      <span className="rounded-full bg-red-100 px-2 text-[11px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-300" data-testid="suspended-badge">
                        {A.roles.suspended}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{A.joined(f.date(u.createdAt))}</p>
                </div>
                {u.role === "admin" || u.id === admin.id ? null : (
                  <div className="flex flex-wrap gap-2">
                    {u.suspendedAt ? null : (
                      <form action={setModerator.bind(null, u.id, !isModerator)}>
                        <ConfirmButton
                          message={isModerator ? A.removeModeratorConfirm(u.name) : A.makeModeratorConfirm(u.name)}
                          className={isModerator ? "btn-danger" : "btn-secondary"}
                        >
                          {isModerator ? A.removeModerator : A.makeModerator}
                        </ConfirmButton>
                      </form>
                    )}
                    <form action={setSuspended.bind(null, u.id, !u.suspendedAt)}>
                      <ConfirmButton
                        message={u.suspendedAt ? A.restoreConfirm(u.name) : A.suspendConfirm(u.name)}
                        className={u.suspendedAt ? "btn-secondary" : "btn-danger"}
                      >
                        {u.suspendedAt ? A.restore : A.suspend}
                      </ConfirmButton>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {recent.length ? (
        <section className="mt-8" aria-labelledby="role-log">
          <h2 id="role-log" className="section-title mb-2">
            {A.roleLog}
          </h2>
          <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300" data-testid="role-log">
            {recent.map((r) => (
              <li key={r.id}>
                {A.roleLogEntry(r.actorName, r.targetName, (A.roles as Record<string, string>)[r.toRole] ?? r.toRole)}{" "}
                <span className="text-xs text-zinc-600 dark:text-zinc-400">· {f.date(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
