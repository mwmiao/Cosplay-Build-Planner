import type { Metadata } from "next";
import { ConfirmButton, SubmitButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { dateInput, moneyInput } from "@/lib/format";
import { getProjectOr404 } from "@/lib/queries";
import { deleteProject, setProjectArchived, updateProject } from "../../actions";
import { ProjectForm } from "../../ProjectForm";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const project = await getProjectOr404(params.id);
  const archived = project.archivedAt !== null;

  return (
    <>
      <BackLink href={`/projects/${project.id}`}>{project.characterName}</BackLink>
      <h1 className="page-title mb-4">Edit project</h1>
      <div className="card">
        <ProjectForm
          action={updateProject.bind(null, project.id)}
          cancelHref={`/projects/${project.id}`}
          submitLabel="Save changes"
          initial={{
            characterName: project.characterName,
            series: project.series ?? "",
            conventionName: project.conventionName ?? "",
            deadline: dateInput(project.deadline),
            status: project.status,
            budget: moneyInput(project.budgetCents),
            spent: moneyInput(project.spentCents),
            notes: project.notes ?? "",
          }}
        />
      </div>

      <section className="card mt-6 space-y-4" aria-labelledby="danger-zone">
        <h2 id="danger-zone" className="section-title">
          Archive or delete
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <form action={setProjectArchived.bind(null, project.id, !archived)}>
            <SubmitButton className="btn-secondary w-full sm:w-auto" pendingText="Working…">
              {archived ? "Unarchive project" : "Archive project"}
            </SubmitButton>
          </form>
          <form action={deleteProject.bind(null, project.id)}>
            <ConfirmButton
              className="btn-danger w-full sm:w-auto"
              message={`Delete “${project.characterName}”? You can restore it from Settings.`}
            >
              Delete project
            </ConfirmButton>
          </form>
        </div>
        <p className="hint">
          Archived projects are hidden from the list and shopping list. Deleted projects can be restored from Settings.
        </p>
      </section>
    </>
  );
}
