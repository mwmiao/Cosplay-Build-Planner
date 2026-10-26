import type { Metadata } from "next";
import { ConfirmButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAccount } from "@/lib/auth";
import { parseTags } from "@/lib/community/snapshot";
import { parseIds } from "@/lib/community/view";
import { db } from "@/lib/db";
import { getProjectOr404 } from "@/lib/queries";
import { unpublish } from "./actions";
import { PublishForm } from "./PublishForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.community.publishTitle };
}

export default async function PublishPage({ params }: { params: { id: string } }) {
  const user = await requireAccount();
  const project = await getProjectOr404(params.id, user.id);
  const { t } = getI18n();
  const C = t.community;
  const [images, publication] = await Promise.all([
    // The main picture (first) and the reference images, in their manual order. Part photos stay private.
    db.referenceImage.findMany({
      where: { projectId: project.id, kind: { in: ["cover", "reference"] }, encrypted: false },
      orderBy: [{ kind: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    }),
    db.publication.findFirst({ where: { projectId: project.id, ownerId: user.id } }),
  ]);
  const existing = new Set(images.map((i) => i.id));
  const previouslySelected = parseIds(publication?.selectedImageIds ?? "[]").filter((id) => existing.has(id));

  return (
    <>
      <BackLink href={`/projects/${project.id}`}>{project.characterName}</BackLink>
      <h1 className="page-title mb-1">{C.publishTitle}</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{C.publishIntro}</p>

      <PublishForm
        projectId={project.id}
        published={!!publication}
        images={images.map((i) => ({
          id: i.id,
          caption: i.kind === "cover" ? (i.caption ?? C.mainPicture) : i.caption,
          thumbUrl: `/api/uploads/${i.thumbPath}`,
        }))}
        defaults={
          publication
            ? {
                title: publication.title,
                description: publication.description ?? "",
                tags: parseTags(publication.tags).join(", "),
                includeBudget: publication.includeBudget,
                includeCosts: publication.includeCosts,
                includeLinks: publication.includeLinks,
                imageMode: publication.imageMode === "selected" ? "selected" : "all",
                imageIds: previouslySelected,
              }
            : {
                // Nothing optional is public until the owner opts in; notes are never prefilled.
                title: project.characterName,
                description: "",
                tags: "",
                includeBudget: false,
                includeCosts: false,
                includeLinks: false,
                imageMode: "all",
                imageIds: [],
              }
        }
      />

      {publication ? (
        <form action={unpublish.bind(null, project.id)} className="card mt-8 space-y-2">
          <p className="hint">{C.unpublishConfirm}</p>
          <ConfirmButton message={C.unpublishConfirm} className="btn-danger">
            {C.unpublish}
          </ConfirmButton>
        </form>
      ) : null}
    </>
  );
}
