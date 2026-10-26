import type { Metadata } from "next";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getProjectOr404, knownSuppliers } from "@/lib/queries";
import { getDefaultCurrency } from "@/lib/settings";
import { createPart } from "../actions";
import { PartForm } from "../PartForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.partForm.newTitle };
}

export default async function NewPartPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const project = await getProjectOr404(params.id, user.id);
  const base = project.currency ?? (await getDefaultCurrency(user.id));
  const { t } = getI18n();
  return (
    <>
      <BackLink href={`/projects/${project.id}`}>{project.characterName}</BackLink>
      <h1 className="page-title mb-4">{t.partForm.newTitle}</h1>
      <div className="card">
        <PartForm
          action={createPart.bind(null, project.id)}
          defaultCurrency={base}
          baseCurrency={base}
          cancelHref={`/projects/${project.id}#parts`}
          submitLabel={t.partForm.add}
          allowAddAnother
          suppliers={await knownSuppliers(user.id)}
        />
      </div>
      <p className="hint mt-3">{t.partForm.photosAfterSave}</p>
    </>
  );
}
