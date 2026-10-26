import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { getMoneyContext } from "../queries";
import { type PublicSnapshot, buildPublicSnapshot, parseTags } from "./snapshot";

// Public read model. Published projects are LIVE: every view is built from
// the project as it is now, through the same allow-list as always
// (buildPublicSnapshot). The owner's publish settings decide which optional
// fields and which images are public. Everything returned here may be shown to
// anyone who can reach the app, so it's assembled field by field (never by
// spreading a row).

export type PublicImageView = { id: string; caption: string | null; thumbUrl: string; fullUrl: string };

export type PublicProjectView = {
  id: string;
  title: string;
  series: string | null;
  description: string | null;
  tags: string[];
  creator: { displayName: string };
  publishedAt: string;
  updatedAt: string;
  cover: PublicImageView | null;
  images: PublicImageView[];
  snapshot: PublicSnapshot;
};

export type PublicCardView = Omit<PublicProjectView, "images" | "snapshot"> & { progressPercent: number };

const imageView = (img: { id: string; caption: string | null }): PublicImageView => ({
  id: img.id,
  caption: img.caption,
  thumbUrl: `/api/community/images/${img.id}/thumb`,
  fullUrl: `/api/community/images/${img.id}/full`,
});

/** Visible publications: the project still exists (soft-deleted projects drop out). */
const visible: Prisma.PublicationWhereInput = { project: { deletedAt: null } };

export function parseIds(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Images a publication currently shows: the main picture first, then the
 * reference images in the owner's order. "all" includes new uploads
 * automatically; "selected" only the chosen ones. Part photos and encrypted
 * (guest) images are never public.
 */
export async function publicImagesFor(pubs: { projectId: string; imageMode: string; selectedImageIds: string }[]) {
  const rows = pubs.length
    ? await db.referenceImage.findMany({
        where: { projectId: { in: pubs.map((p) => p.projectId) }, kind: { in: ["cover", "reference"] }, encrypted: false },
        orderBy: [{ kind: "asc" }, { position: "asc" }, { createdAt: "asc" }],
        select: { id: true, projectId: true, kind: true, caption: true },
      })
    : [];
  const out = new Map<string, { images: PublicImageView[]; cover: PublicImageView | null }>();
  for (const p of pubs) {
    const selected = p.imageMode === "selected" ? new Set(parseIds(p.selectedImageIds)) : null;
    const mine = rows.filter((r) => r.projectId === p.projectId && (!selected || selected.has(r.id)));
    const images = mine.map(imageView);
    const coverRow = mine.find((r) => r.kind === "cover") ?? mine[0];
    out.set(p.projectId, { images, cover: coverRow ? imageView(coverRow) : null });
  }
  return out;
}

const latest = (...dates: (Date | null | undefined)[]) =>
  new Date(Math.max(...dates.filter((d): d is Date => !!d).map((d) => d.getTime())));

export async function getPublicProject(id: string): Promise<PublicProjectView | null> {
  const p = await db.publication.findFirst({
    where: { id, ...visible },
    include: {
      owner: { select: { name: true } },
      project: { include: { parts: { where: { deletedAt: null }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] } } },
    },
  });
  if (!p) return null;
  const ctx = await getMoneyContext(p.ownerId);
  const snapshot = buildPublicSnapshot(p.project, p.project.parts, p, ctx);
  const imgs = (await publicImagesFor([p])).get(p.projectId) ?? { images: [], cover: null };
  return {
    id: p.id,
    title: p.title,
    series: p.project.series,
    description: p.description,
    tags: parseTags(p.tags),
    creator: { displayName: p.owner.name },
    publishedAt: p.publishedAt.toISOString(),
    updatedAt: latest(p.versionAt, p.project.updatedAt, ...p.project.parts.map((x) => x.updatedAt)).toISOString(),
    cover: imgs.cover,
    images: imgs.images,
    snapshot,
  };
}

export const COMMUNITY_SORTS = ["newest", "updated", "oldest", "title"] as const;
export type CommunitySort = (typeof COMMUNITY_SORTS)[number];

const ORDER: Record<CommunitySort, Prisma.PublicationOrderByWithRelationInput[]> = {
  newest: [{ publishedAt: "desc" }, { id: "desc" }],
  updated: [{ project: { updatedAt: "desc" } }, { id: "desc" }],
  oldest: [{ publishedAt: "asc" }, { id: "asc" }],
  title: [{ title: "asc" }, { id: "asc" }],
};
export const PAGE_SIZE = 12;

export async function listPublicProjects(opts: { q?: string; sort: CommunitySort; page: number }) {
  const q = opts.q?.trim().slice(0, 100);
  const where: Prisma.PublicationWhereInput = {
    ...visible,
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { project: { series: { contains: q } } },
            { tags: { contains: q.toLowerCase() } },
            { description: { contains: q } },
            { owner: { name: { contains: q } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.publication.count({ where }),
    db.publication.findMany({
      where,
      include: {
        owner: { select: { name: true } },
        project: { select: { series: true, status: true, updatedAt: true, parts: { where: { deletedAt: null }, select: { status: true } } } },
      },
      orderBy: ORDER[opts.sort],
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const images = await publicImagesFor(rows);
  const items: PublicCardView[] = rows.map((r) => {
    const parts = r.project.parts;
    const done = parts.filter((x) => x.status === "done").length;
    return {
      id: r.id,
      title: r.title,
      series: r.project.series,
      description: r.description,
      tags: parseTags(r.tags),
      creator: { displayName: r.owner.name },
      publishedAt: r.publishedAt.toISOString(),
      updatedAt: latest(r.versionAt, r.project.updatedAt).toISOString(),
      cover: images.get(r.projectId)?.cover ?? null,
      // Same rule as projectStats: a finished project is 100%.
      progressPercent: r.project.status === "finished" ? 100 : parts.length ? Math.round((done / parts.length) * 100) : 0,
    };
  });
  return { items, total, page: opts.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
