import type { Metadata } from "next";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { ImportWizard } from "./ImportWizard";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.transfer.importTitle };
}

export default async function ImportPage() {
  const { t } = getI18n();
  const projects = await db.project.findMany({
    where: { deletedAt: null },
    select: { id: true, characterName: true },
    orderBy: { characterName: "asc" },
  });
  return (
    <>
      <BackLink href="/projects">{t.projects.title}</BackLink>
      <h1 className="page-title mb-1">{t.transfer.importTitle}</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{t.transfer.importIntro}</p>
      <ImportWizard projects={projects.map((p) => ({ id: p.id, name: p.characterName }))} />
    </>
  );
}
