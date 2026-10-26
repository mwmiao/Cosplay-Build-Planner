import type { Metadata } from "next";
import { ConfirmButton, SubmitButton } from "@/components/FormBits";
import { LightboxGroup, LightboxThumb } from "@/components/Lightbox";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { dateInput, moneyInput } from "@/lib/format";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { upcomingEventNames } from "@/lib/events";
import { getProjectOr404 } from "@/lib/queries";
import { getDefaultCurrency } from "@/lib/settings";
import { ACCEPT_ATTR } from "@/lib/uploads";
import { deleteProject, setProjectArchived, updateProject } from "../../actions";
import { removeCover } from "../references/actions";
import { lightboxImages } from "../references/ImageCard";
import { UploadForm } from "../references/UploadForm";
import { ProjectForm } from "../../ProjectForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.projectForm.editTitle };
}

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { uploaded?: string; uploadError?: string };
}) {
  const user = await requireUser();
  const project = await getProjectOr404(params.id, user.id);
  const { t } = getI18n();
  const F = t.projectForm;
  const archived = project.archivedAt !== null;
  const base = project.currency ?? (await getDefaultCurrency(user.id));
  const [converted, cover, eventNames] = await Promise.all([
    db.buildPart.count({
      where: { projectId: project.id, deletedAt: null, paidAt: { not: null }, currency: { not: null } },
    }),
    db.referenceImage.findFirst({ where: { projectId: project.id, kind: "cover" } }),
    upcomingEventNames(),
  ]);

  return (
    <>
      <BackLink href={`/projects/${project.id}`}>{project.characterName}</BackLink>
      <h1 className="page-title mb-4">{F.editTitle}</h1>

      <section id="cover" aria-labelledby="cover-title" className="card mb-6 scroll-mt-4">
        <h2 id="cover-title" className="section-title mb-1">
          {F.cover}
        </h2>
        <p className="hint mb-3">{F.coverHint}</p>
        {searchParams.uploadError ? (
          <div role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {searchParams.uploadError}
          </div>
        ) : Number(searchParams.uploaded ?? 0) > 0 ? (
          <div role="status" className="mb-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            {F.coverSaved}
          </div>
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {cover ? (
            <div className="w-full shrink-0 sm:w-48">
              <LightboxGroup images={lightboxImages([cover])}>
                <LightboxThumb index={0} label={t.lightbox.open(F.cover)}>
                  <img src={`/api/uploads/${cover.thumbPath}`} alt={F.cover} className="aspect-square w-full object-cover" data-testid="cover-preview" />
                </LightboxThumb>
              </LightboxGroup>
              <form action={removeCover.bind(null, project.id)} className="mt-2">
                <ConfirmButton className="btn-ghost w-full text-red-700 dark:text-red-400" message={F.coverRemoveConfirm}>
                  {F.coverRemove}
                </ConfirmButton>
              </form>
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <UploadForm
              projectId={project.id}
              accept={ACCEPT_ATTR}
              maxMb={env().MAX_UPLOAD_MB}
              kind="cover"
              submitLabel={cover ? F.coverReplace : F.coverUpload}
            />
          </div>
        </div>
      </section>

      <div className="card">
        <ProjectForm
          action={updateProject.bind(null, project.id)}
          cancelHref={`/projects/${project.id}`}
          submitLabel={F.saveChanges}
          defaultCurrency={base}
          eventNames={eventNames}
          currencyNote={
            converted > 0
              ? F.currencyLocked(converted, base)
              : undefined
          }
          initial={{
            characterName: project.characterName,
            series: project.series ?? "",
            conventionName: project.conventionName ?? "",
            startDate: dateInput(project.startDate),
            deadline: dateInput(project.deadline),
            status: project.status,
            currency: base,
            budget: moneyInput(project.budgetCents),
            notes: project.notes ?? "",
          }}
        />
      </div>

      <section className="card mt-6 space-y-4" aria-labelledby="danger-zone">
        <h2 id="danger-zone" className="section-title">
          {F.archiveTitle}
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <form action={setProjectArchived.bind(null, project.id, !archived)}>
            <SubmitButton className="btn-secondary w-full sm:w-auto" pendingText={t.common.working}>
              {archived ? F.unarchive : F.archive}
            </SubmitButton>
          </form>
          <form action={deleteProject.bind(null, project.id)}>
            <ConfirmButton
              className="btn-danger w-full sm:w-auto"
              message={F.deleteConfirm(project.characterName)}
            >
              {F.delete}
            </ConfirmButton>
          </form>
        </div>
        <p className="hint">
          {F.archiveHint}
        </p>
      </section>
    </>
  );
}
