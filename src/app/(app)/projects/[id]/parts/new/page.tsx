import type { Metadata } from "next";
import { BackLink } from "@/components/ui";
import { getProjectOr404, knownSuppliers } from "@/lib/queries";
import { createPart } from "../actions";
import { PartForm } from "../PartForm";

export const metadata: Metadata = { title: "Add part" };

export default async function NewPartPage({ params }: { params: { id: string } }) {
  const project = await getProjectOr404(params.id);
  return (
    <>
      <BackLink href={`/projects/${project.id}`}>{project.characterName}</BackLink>
      <h1 className="page-title mb-4">Add part</h1>
      <div className="card">
        <PartForm
          action={createPart.bind(null, project.id)}
          cancelHref={`/projects/${project.id}#parts`}
          submitLabel="Add part"
          allowAddAnother
          suppliers={await knownSuppliers()}
        />
      </div>
    </>
  );
}
