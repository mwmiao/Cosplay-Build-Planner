import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/FormBits";
import { PublicProject } from "@/components/PublicProject";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProject } from "@/lib/community/view";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { RemoveForm } from "../../../(app)/admin/RemoveForm";
import { copyToMyProjects } from "./actions";
import { ReportForm } from "./ReportForm";

async function load(id: string) {
  return idSchema.safeParse(id).success ? getPublicProject(id) : null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await load(params.id);
  return { title: p ? p.title : getI18n().t.community.notFoundTitle };
}

export default async function CommunityProjectPage({ params }: { params: { id: string } }) {
  const { t, f } = getI18n();
  const C = t.community;
  const project = await load(params.id);
  if (!project) {
    return (
      <>
        <BackLink href="/community">{C.back}</BackLink>
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
          <h1 className="font-semibold">{C.notFoundTitle}</h1>
          <p className="mt-1 text-sm text-zinc-500">{C.notFoundText}</p>
        </div>
      </>
    );
  }
  const user = await getCurrentUser();
  // The owner manages their own project instead of copying it.
  const own = user
    ? await db.publication.findFirst({ where: { id: project.id, ownerId: user.id }, select: { projectId: true } })
    : null;
  return (
    <>
      <BackLink href="/community">{C.back}</BackLink>
      <PublicProject
        t={t}
        f={f}
        data={{
          title: project.title,
          series: project.series,
          description: project.description,
          tags: project.tags,
          creatorName: project.creator.displayName,
          publishedAt: project.publishedAt,
          updatedAt: project.updatedAt,
          snapshot: project.snapshot,
          images: project.images,
          progress: project.progress,
          coverId: project.cover?.id ?? null,
        }}
        actions={
          own ? (
            <div className="space-y-2 pt-2" data-testid="own-publication">
              <p className="text-sm font-medium">{C.yours}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/projects/${own.projectId}/publish`} className="btn-primary">
                  {C.manageYours}
                </Link>
                <Link href={`/projects/${own.projectId}`} className="btn-secondary">
                  {C.openYours}
                </Link>
              </div>
            </div>
          ) : user ? (
            <form action={copyToMyProjects.bind(null, project.id)} className="space-y-1 pt-2">
              <SubmitButton className="btn-primary w-full sm:w-auto" pendingText={C.copying}>
                {C.copyToMine}
              </SubmitButton>
              <p className="hint">{C.copyHint}</p>
            </form>
          ) : null
        }
      />
      {user && !user.isGuest && !own ? (
        <details className="card mt-8" data-testid="report">
          <summary className="expander text-sm">{C.report.title}</summary>
          <div className="pt-2">
            <ReportForm publicationId={project.id} />
          </div>
        </details>
      ) : null}
      {user?.isModerator ? (
        <section className="card mt-8 space-y-2 border-red-200 dark:border-red-900" aria-label={t.admin.adminTools}>
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">{t.admin.adminTools}</h2>
          <RemoveForm publicationId={project.id} />
        </section>
      ) : null}
      {user ? null : (
        <p className="mt-4">
            <Link href={`/login?next=${encodeURIComponent(`/community/${project.id}`)}`} className="link text-sm">
              {C.logInToCopy}
            </Link>
        </p>
      )}
    </>
  );
}
