import type { Metadata } from "next";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getDefaultCurrency } from "@/lib/settings";
import { createProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.projectForm.newTitle };
}

export default async function NewProjectPage() {
  const user = await requireUser();
  const { t } = getI18n();
  return (
    <>
      <BackLink href="/projects">{t.projects.title}</BackLink>
      <h1 className="page-title mb-4">{t.projectForm.newTitle}</h1>
      <div className="card">
        <ProjectForm
          action={createProject}
          cancelHref="/projects"
          submitLabel={t.projectForm.create}
          defaultCurrency={await getDefaultCurrency(user.id)}
        />
      </div>
    </>
  );
}
