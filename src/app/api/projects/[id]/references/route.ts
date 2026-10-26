import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sameOrigin } from "@/lib/http";
import { db } from "@/lib/db";
import { UploadError, removeStoredFiles, storeImage } from "@/lib/uploads";
import { getI18n } from "@/i18n/server";
import { env } from "@/lib/env";
import { GUEST_MAX_BYTES, guestKey, guestUsage } from "@/lib/guest";
import { idSchema, schemas } from "@/lib/validation";

export const dynamic = "force-dynamic";

const KINDS = ["reference", "part", "cover"] as const;
type Kind = (typeof KINDS)[number];

/**
 * Multipart upload of project images: reference images (several), a part's
 * photos (several, with partId) or the project's main picture (one; replaces
 * the previous one). Handled as a route (not a server action) so large photos
 * aren't limited by the server-action body size. Works as a plain HTML form
 * post: redirects back with ?uploaded= or ?uploadError=.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Cookie-authenticated POST outside server actions: reject cross-site requests.
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const idResult = idSchema.safeParse(params.id);
  if (!idResult.success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const projectId = idResult.data;

  // Only the owner may attach files; another user's project looks missing.
  const project = await db.project.findFirst({ where: { id: projectId, ownerId: user.id, deletedAt: null } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { t } = getI18n();
  const E = t.refs.errors;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    form = new FormData();
  }
  const kindValue = form.get("kind");
  const kind: Kind = (KINDS as readonly unknown[]).includes(kindValue) ? (kindValue as Kind) : "reference";

  // A part's photos need a live part of this project.
  let partId: string | null = null;
  if (kind === "part") {
    const pid = idSchema.safeParse(form.get("partId"));
    const part = pid.success
      ? await db.buildPart.findFirst({ where: { id: pid.data, projectId, deletedAt: null }, select: { id: true } })
      : null;
    if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });
    partId = part.id;
  }

  // Relative Location so the redirect works whatever host name the NAS is reached by.
  const backPath =
    kind === "part"
      ? `/projects/${projectId}/parts/${partId}/edit`
      : kind === "cover"
        ? `/projects/${projectId}/edit`
        : `/projects/${projectId}/references`;
  const anchor = kind === "part" ? "#photos" : kind === "cover" ? "#cover" : "";
  const back = (query: Record<string, string>) => {
    const qs = new URLSearchParams(query).toString();
    return new NextResponse(null, { status: 303, headers: { Location: `${backPath}${qs ? `?${qs}` : ""}${anchor}` } });
  };
  if (!form.has("kind") && !form.has("images")) return back({ uploadError: E.noUpload });

  const meta = schemas(t).reference.safeParse({
    caption: kind === "cover" ? undefined : (form.get("caption") ?? undefined),
    sourceUrl: kind === "cover" ? undefined : (form.get("sourceUrl") ?? undefined),
    groupName: kind === "reference" ? (form.get("groupName") ?? undefined) : undefined,
  });
  if (!meta.success) {
    return back({ uploadError: meta.error.issues[0]?.message ?? E.checkFields });
  }

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return back({ uploadError: t.refs.chooseOne });
  if (files.length > (kind === "cover" ? 1 : 20)) return back({ uploadError: E.tooMany });

  // Guests: images are encrypted with the key only their browser has, within a storage limit.
  let key: Buffer | null = null;
  let guestRoom = Number.POSITIVE_INFINITY;
  if (user.isGuest) {
    key = guestKey();
    if (!key) return back({ uploadError: t.guest.keyMissing });
    guestRoom = GUEST_MAX_BYTES - (await guestUsage(user.id)).bytes;
  }

  // New images go after the existing ones of the same kind (and part).
  const last = await db.referenceImage.aggregate({
    where: { projectId, kind, ...(partId ? { partId } : {}) },
    _max: { position: true },
  });
  let position = (last._max.position ?? -1) + 1;

  let saved = 0;
  const errors: string[] = [];
  for (const file of files) {
    try {
      if (file.size > guestRoom) {
        errors.push(`${file.name}: ${t.guest.storageFull(Math.round(GUEST_MAX_BYTES / 1024 / 1024))}`);
        continue;
      }
      const stored = await storeImage(projectId, file, key);
      guestRoom -= stored.sizeBytes;
      try {
        const data = {
          projectId,
          kind,
          partId,
          groupName: meta.data.groupName ?? null,
          position,
          ...stored,
          originalName: file.name.slice(0, 200) || "image",
          caption: meta.data.caption ?? null,
          sourceUrl: meta.data.sourceUrl ?? null,
        };
        if (kind === "cover") {
          // One main picture per project: swap it in, then remove the old files.
          const previous = await db.$transaction(async (tx) => {
            const old = await tx.referenceImage.findMany({ where: { projectId, kind: "cover" } });
            await tx.referenceImage.deleteMany({ where: { projectId, kind: "cover" } });
            await tx.referenceImage.create({ data });
            return old;
          });
          await removeStoredFiles(...previous.flatMap((p) => [p.filePath, p.thumbPath]));
        } else {
          await db.referenceImage.create({ data });
        }
      } catch (err) {
        await removeStoredFiles(stored.filePath, stored.thumbPath);
        throw err;
      }
      saved += 1;
      position += 1;
    } catch (err) {
      if (err instanceof UploadError) {
        errors.push(`${file.name}: ${err.code === "tooLarge" ? E.tooLarge(env().MAX_UPLOAD_MB) : E[err.code]}`);
      } else {
        console.error("Image upload failed", err);
        errors.push(`${file.name}: ${E.notSaved}`);
      }
    }
  }

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
  const query: Record<string, string> = { uploaded: String(saved) };
  if (errors.length) query.uploadError = errors.join(" ").slice(0, 500);
  return back(query);
}
