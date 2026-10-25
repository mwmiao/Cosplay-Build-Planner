import type { Metadata } from "next";
import { ConfirmButton, SubmitButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { dateInput, moneyInput } from "@/lib/format";
import { db } from "@/lib/db";
import { getProjectOr404 } from "@/lib/queries";
import { getDefaultCurrency } from "@/lib/settings";
import { deleteProject, setProjectArchived, updateProject } from "../../actions";
import { ProjectForm } from "../../ProjectForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.projectForm.editTitle };
}

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const project = await getProjectOr404(params.id, user.id);
  const { t } = getI18n();
  const F = t.projectForm;
  const archived = project.archivedAt !== null;
  const base = project.currency ?? (await getDefaultCurrency(user.id));
  const converted = await db.buildPart.count({
    where: { projectId: project.id, deletedAt: null, paidAt: { not: null }, currency: { not: null } },
  });

  return (
    <>
      <BackLink href={`/projects/${project.id}`}>{project.characterName}</BackLink>
      <h1 className="page-title mb-4">{F.editTitle}</h1>
      <div className="card">
        <ProjectForm
          action={updateProject.bind(null, project.id)}
          cancelHref={`/projects/${project.id}`}
          submitLabel={F.saveChanges}
          defaultCurrency={base}
          currencyNote={
            converted > 0
              ? F.currencyLocked(converted, base)
              : undefined
          }
          initial={{
            characterName: project.characterName,
            series: project.series ?? "",
            conventionName: project.conventionName ?? "",
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
