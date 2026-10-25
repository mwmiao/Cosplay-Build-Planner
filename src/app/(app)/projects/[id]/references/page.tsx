import type { Metadata } from "next";
import { ConfirmButton } from "@/components/FormBits";
import { EmptyState, BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hostname } from "@/lib/format";
import { getProjectOr404 } from "@/lib/queries";
import { ACCEPT_ATTR } from "@/lib/uploads";
import { deleteReference, updateReference } from "./actions";
import { CaptionForm } from "./CaptionForm";
import { UploadForm } from "./UploadForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.refs.title };
}

export default async function ReferencesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { uploaded?: string; uploadError?: string };
}) {
  const project = await getProjectOr404(params.id);
  const { t } = getI18n();
  const R = t.refs;
  const images = await db.referenceImage.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
  });
  const uploaded = Number(searchParams.uploaded ?? 0);

  return (
    <>
      <BackLink href={`/projects/${project.id}`}>{project.characterName}</BackLink>
      <h1 className="page-title mb-4">{R.title}</h1>

      {uploaded > 0 ? (
        <div role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          {R.uploaded(uploaded)}
        </div>
      ) : null}
      {searchParams.uploadError ? (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {searchParams.uploadError}
        </div>
      ) : null}

      <section className="card mb-6" aria-labelledby="upload-title">
        <h2 id="upload-title" className="section-title mb-3">
          {R.addImages}
        </h2>
        <UploadForm projectId={project.id} accept={ACCEPT_ATTR} maxMb={env().MAX_UPLOAD_MB} />
      </section>

      {images.length === 0 ? (
        <EmptyState title={R.empty}>{R.emptyText}</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} id={`ref-${img.id}`} className="card flex scroll-mt-4 flex-col gap-2 p-2">
              <a href={`/api/uploads/${img.filePath}`} target="_blank" rel="noopener" className="block">
                <img
                  src={`/api/uploads/${img.thumbPath}`}
                  alt={img.caption ?? img.originalName}
                  loading="lazy"
                  width={480}
                  height={480}
                  className="aspect-square w-full rounded-xl object-cover"
                />
              </a>
              {img.caption ? <p className="px-1 text-sm font-medium">{img.caption}</p> : null}
              {img.sourceUrl ? (
                <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="link truncate px-1 text-xs">
                  {R.source(hostname(img.sourceUrl) ?? img.sourceUrl)}
                </a>
              ) : null}
              <details className="px-1 text-sm">
                <summary className="flex min-h-11 cursor-pointer items-center text-zinc-600 dark:text-zinc-400">
                  {R.edit}
                </summary>
                <div className="space-y-3 pb-2">
                  <CaptionForm
                    action={updateReference.bind(null, project.id, img.id)}
                    caption={img.caption ?? ""}
                    sourceUrl={img.sourceUrl ?? ""}
                  />
                  <form action={deleteReference.bind(null, project.id, img.id)}>
                    <ConfirmButton className="btn-danger w-full" message={R.deleteConfirm}>
                      {R.delete}
                    </ConfirmButton>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
