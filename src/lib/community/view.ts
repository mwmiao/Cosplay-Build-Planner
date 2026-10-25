import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { type PublicSnapshot, parseSnapshot, parseTags } from "./snapshot";

// Public read model. Everything returned here may be shown to anyone who can
// reach the app, so it's assembled field by field (never by spreading a row).

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
  version: number;
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

const include = {
  owner: { select: { name: true } },
  images: { orderBy: { position: "asc" as const }, select: { id: true, caption: true } },
};

type Row = Prisma.PublicationGetPayload<{ include: typeof include }>;

function toView(p: Row): PublicProjectView {
  const images = p.images.map(imageView);
  const cover = images.find((i) => i.id === p.coverImageId) ?? images[0] ?? null;
  return {
    id: p.id,
    title: p.title,
    series: p.series,
    description: p.description,
    tags: parseTags(p.tags),
    creator: { displayName: p.owner.name },
    publishedAt: p.publishedAt.toISOString(),
    updatedAt: p.versionAt.toISOString(),
    version: p.version,
    cover,
    images,
    snapshot: parseSnapshot(p.snapshot),
  };
}

export async function getPublicProject(id: string): Promise<PublicProjectView | null> {
  const row = await db.publication.findFirst({ where: { id, ...visible }, include });
  return row ? toView(row) : null;
}

export type CommunitySort = "newest" | "updated";
export const PAGE_SIZE = 12;

export async function listPublicProjects(opts: { q?: string; sort: CommunitySort; page: number }) {
  const q = opts.q?.trim().slice(0, 100);
  const where: Prisma.PublicationWhereInput = {
    ...visible,
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { series: { contains: q } },
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
      include,
      orderBy: opts.sort === "updated" ? [{ versionAt: "desc" }, { id: "desc" }] : [{ publishedAt: "desc" }, { id: "desc" }],
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const items: PublicCardView[] = rows.map((r) => {
    const { images: _images, snapshot, ...card } = toView(r);
    return { ...card, progressPercent: snapshot.progress.percent };
  });
  return { items, total, page: opts.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
