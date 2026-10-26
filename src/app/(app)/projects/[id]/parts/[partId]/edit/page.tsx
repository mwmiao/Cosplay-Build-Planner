import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConversionDetails } from "@/components/Conversion";
import { ConfirmButton } from "@/components/FormBits";
import { LightboxGroup } from "@/components/Lightbox";
import { Sortable } from "@/components/Sortable";
import { BackLink } from "@/components/ui";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { dateInput, moneyInput } from "@/lib/format";
import { getProjectOr404, knownSuppliers } from "@/lib/queries";
import { getDefaultCurrency } from "@/lib/settings";
import { ACCEPT_ATTR } from "@/lib/uploads";
import { idSchema } from "@/lib/validation";
import { reorderImages } from "../../../references/actions";
import { ImageCard, lightboxImages } from "../../../references/ImageCard";
import { UploadForm } from "../../../references/UploadForm";
import { deletePart, updatePart } from "../../actions";
import { PartForm } from "../../PartForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.partForm.editTitle };
}

export default async function EditPartPage({
  params,
  searchParams,
}: {
  params: { id: string; partId: string };
  searchParams: { uploaded?: string; uploadError?: string; reorder?: string };
}) {
  const user = await requireUser();
  const project = await getProjectOr404(params.id, user.id);
  const partId = idSchema.safeParse(params.partId);
  if (!partId.success) notFound();
  const part = await db.buildPart.findFirst({
    where: { id: partId.data, projectId: project.id, deletedAt: null },
  });
  if (!part) notFound();
  const base = project.currency ?? (await getDefaultCurrency(user.id));
  const { t, f } = getI18n();
  const F = t.partForm;
  const photos = await db.referenceImage.findMany({
    where: { projectId: project.id, kind: "part", partId: part.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const uploaded = Number(searchParams.uploaded ?? 0);
  const reorder = searchParams.reorder === "1" && photos.length > 1;
  const editHref = `/projects/${project.id}/parts/${part.id}/edit`;

  return (
    <>
      <BackLink href={`/projects/${project.id}#parts`}>{project.characterName}</BackLink>
      <h1 className="page-title mb-1">{F.editTitle}</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        {F.addedOn(f.date(part.createdAt))}
        {part.completedAt ? F.doneOn(f.date(part.completedAt)) : ""}
      </p>
      <div className="card">
        <PartForm
          action={updatePart.bind(null, project.id, part.id)}
          defaultCurrency={base}
          baseCurrency={base}
          cancelHref={`/projects/${project.id}#parts`}
          submitLabel={F.save}
          suppliers={await knownSuppliers(user.id)}
          conversion={<ConversionDetails part={part} base={base} />}
          initial={{
            name: part.name,
            category: part.category,
            status: part.status,
            currency: part.currency ?? base,
            estimatedCost: moneyInput(part.estimatedCostCents),
            actualCost: moneyInput(part.actualCostCents),
            quantity: String(part.quantity),
            supplier: part.supplier ?? "",
            url: part.url ?? "",
            notes: part.notes ?? "",
            paid: part.paidAt !== null,
            paidAt: dateInput(part.paidAt),
            chargedBase: part.fxManual ? moneyInput(part.paidBaseCents) : "",
          }}
        />
      </div>
      <section id="photos" aria-labelledby="photos-title" className="mt-6 scroll-mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="photos-title" className="section-title">
            {F.photos} {photos.length ? <span className="text-sm font-normal text-zinc-500">({photos.length})</span> : null}
          </h2>
          {photos.length > 1 ? (
            <a
              href={reorder ? `${editHref}#photos` : `${editHref}?reorder=1#photos`}
              className={reorder ? "btn-primary" : "btn-secondary"}
              aria-pressed={reorder}
            >
              {reorder ? t.refs.doneReordering : t.refs.reorder}
            </a>
          ) : null}
        </div>
        {uploaded > 0 ? (
          <div role="status" className="mb-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            {t.refs.uploaded(uploaded)}
          </div>
        ) : null}
        {searchParams.uploadError ? (
          <div role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {searchParams.uploadError}
          </div>
        ) : null}
        {reorder ? (
          <Sortable
            layout="grid"
            onSave={reorderImages.bind(null, project.id)}
            items={photos.map((img) => ({
              id: img.id,
              label: img.caption ?? img.originalName,
              content: <img src={`/api/uploads/${img.thumbPath}`} alt="" className="aspect-square w-full rounded-lg object-cover" draggable={false} />,
            }))}
          />
        ) : photos.length ? (
          <LightboxGroup images={lightboxImages(photos)}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((img, i) => (
                <ImageCard key={img.id} projectId={project.id} image={img} index={i} t={t} />
              ))}
            </ul>
          </LightboxGroup>
        ) : (
          <p className="hint">{F.photosHint}</p>
        )}
        <details className="card mt-3" open={photos.length === 0}>
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{F.addPhotos}</summary>
          <div className="pt-3">
            <UploadForm projectId={project.id} accept={ACCEPT_ATTR} maxMb={env().MAX_UPLOAD_MB} kind="part" partId={part.id} />
          </div>
        </details>
      </section>

      <form action={deletePart.bind(null, project.id, part.id)} className="mt-6">
        <ConfirmButton className="btn-danger w-full sm:w-auto" message={F.deleteConfirm(part.name)}>
          {F.delete}
        </ConfirmButton>
      </form>
    </>
  );
}
