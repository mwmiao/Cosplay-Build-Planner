import type { Metadata } from "next";
import Link from "next/link";
import { LightboxGroup } from "@/components/Lightbox";
import { Sortable } from "@/components/Sortable";
import { EmptyState, BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getProjectOr404 } from "@/lib/queries";
import { ACCEPT_ATTR } from "@/lib/uploads";
import { reorderImages } from "./actions";
import { ImageCard, lightboxImages } from "./ImageCard";
import { UploadForm } from "./UploadForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.refs.title };
}

/** "" = ungrouped */
const UNGROUPED = "-";

export default async function ReferencesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { uploaded?: string; uploadError?: string; group?: string; reorder?: string };
}) {
  const user = await requireUser();
  const project = await getProjectOr404(params.id, user.id);
  const { t } = getI18n();
  const R = t.refs;
  const all = await db.referenceImage.findMany({
    where: { projectId: project.id, kind: "reference" },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const uploaded = Number(searchParams.uploaded ?? 0);

  // Groups in the order they first appear, ungrouped last.
  const groups = [...new Set(all.map((i) => i.groupName).filter((g): g is string => !!g))];
  const hasUngrouped = all.some((i) => !i.groupName);
  const group = searchParams.group === UNGROUPED || groups.includes(searchParams.group ?? "") ? searchParams.group : undefined;
  const images = group === undefined ? all : all.filter((i) => (group === UNGROUPED ? !i.groupName : i.groupName === group));
  const reorder = searchParams.reorder === "1" && images.length > 1;

  const href = (change: { group?: string | null; reorder?: boolean }) => {
    const next = { group: change.group === null ? undefined : (change.group ?? group), reorder: change.reorder ?? reorder };
    const qs = new URLSearchParams();
    if (next.group) qs.set("group", next.group);
    if (next.reorder) qs.set("reorder", "1");
    const s = qs.toString();
    return `/projects/${project.id}/references${s ? `?${s}` : ""}`;
  };

  // When showing everything and groups exist, show one section per group.
  const sections =
    group === undefined && groups.length
      ? [
          ...groups.map((g) => ({ key: g, title: g, items: images.filter((i) => i.groupName === g) })),
          ...(hasUngrouped ? [{ key: UNGROUPED, title: R.ungrouped, items: images.filter((i) => !i.groupName) }] : []),
        ]
      : [{ key: "all", title: null as string | null, items: images }];
  const ordered = sections.flatMap((s) => s.items);
  const indexOf = new Map(ordered.map((img, i) => [img.id, i]));

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

      <details className="card mb-6" open={all.length === 0}>
        <summary className="section-title flex min-h-11 cursor-pointer items-center">{R.addImages}</summary>
        <div className="pt-3">
          <UploadForm projectId={project.id} accept={ACCEPT_ATTR} maxMb={env().MAX_UPLOAD_MB} groups={groups} />
        </div>
      </details>

      {all.length === 0 ? (
        <EmptyState title={R.empty}>{R.emptyText}</EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            {groups.length ? (
              <div className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={R.filterGroup}>
                <Link href={href({ group: null })} className={group === undefined ? "chip-on" : "chip-off"}>
                  {R.allGroups} ({all.length})
                </Link>
                {groups.map((g) => (
                  <Link key={g} href={href({ group: g })} className={group === g ? "chip-on" : "chip-off"}>
                    {g} ({all.filter((i) => i.groupName === g).length})
                  </Link>
                ))}
                {hasUngrouped ? (
                  <Link href={href({ group: UNGROUPED })} className={group === UNGROUPED ? "chip-on" : "chip-off"}>
                    {R.ungrouped} ({all.filter((i) => !i.groupName).length})
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="hint">{R.groupsHint}</p>
            )}
            {images.length > 1 ? (
              <Link href={href({ reorder: !reorder })} className={reorder ? "btn-primary" : "btn-secondary"} aria-pressed={reorder}>
                {reorder ? R.doneReordering : R.reorder}
              </Link>
            ) : null}
          </div>

          {reorder ? (
            <Sortable
              layout="grid"
              onSave={reorderImages.bind(null, project.id)}
              items={images.map((img) => ({
                id: img.id,
                label: img.caption ?? img.originalName,
                content: (
                  <div>
                    <img
                      src={`/api/uploads/${img.thumbPath}`}
                      alt=""
                      className="aspect-square w-full rounded-lg object-cover"
                      draggable={false}
                    />
                    <p className="mt-1 truncate px-1 text-xs">{img.caption ?? img.groupName ?? ""}</p>
                  </div>
                ),
              }))}
            />
          ) : (
            <LightboxGroup images={lightboxImages(ordered)}>
              <div className="space-y-6">
                {sections.map((s) => (
                  <section key={s.key} aria-label={s.title ?? R.title}>
                    {s.title ? (
                      <h2 className="section-title mb-2">
                        {s.title} <span className="text-sm font-normal text-zinc-500">({s.items.length})</span>
                      </h2>
                    ) : null}
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {s.items.map((img) => (
                        <ImageCard key={img.id} projectId={project.id} image={img} index={indexOf.get(img.id) ?? 0} t={t} groups={groups} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </LightboxGroup>
          )}
        </>
      )}
    </>
  );
}
