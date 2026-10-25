import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate, moneyInput } from "@/lib/format";
import { getProjectOr404, knownSuppliers } from "@/lib/queries";
import { idSchema } from "@/lib/validation";
import { deletePart, updatePart } from "../../actions";
import { PartForm } from "../../PartForm";

export const metadata: Metadata = { title: "Edit part" };

export default async function EditPartPage({ params }: { params: { id: string; partId: string } }) {
  const project = await getProjectOr404(params.id);
  const partId = idSchema.safeParse(params.partId);
  if (!partId.success) notFound();
  const part = await db.buildPart.findFirst({
    where: { id: partId.data, projectId: project.id, deletedAt: null },
  });
  if (!part) notFound();

  return (
    <>
      <BackLink href={`/projects/${project.id}#parts`}>{project.characterName}</BackLink>
      <h1 className="page-title mb-1">Edit part</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Added {formatDate(part.createdAt)}
        {part.completedAt ? ` · done ${formatDate(part.completedAt)}` : ""}
      </p>
      <div className="card">
        <PartForm
          action={updatePart.bind(null, project.id, part.id)}
          cancelHref={`/projects/${project.id}#parts`}
          submitLabel="Save part"
          suppliers={await knownSuppliers()}
          initial={{
            name: part.name,
            category: part.category,
            status: part.status,
            estimatedCost: moneyInput(part.estimatedCostCents),
            actualCost: moneyInput(part.actualCostCents),
            quantity: String(part.quantity),
            supplier: part.supplier ?? "",
            url: part.url ?? "",
            notes: part.notes ?? "",
          }}
        />
      </div>
      <form action={deletePart.bind(null, project.id, part.id)} className="mt-6">
        <ConfirmButton className="btn-danger w-full sm:w-auto" message={`Delete “${part.name}”?`}>
          Delete part
        </ConfirmButton>
      </form>
    </>
  );
}
