import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sameOrigin } from "@/lib/http";
import { db } from "@/lib/db";
import { UploadError, removeStoredFiles, storeImage } from "@/lib/uploads";
import { getI18n } from "@/i18n/server";
import { env } from "@/lib/env";
import { idSchema, schemas } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Multipart upload of one or more reference images. Handled as a route (not a
 * server action) so large photos aren't limited by the server-action body size.
 * Works as a plain HTML form post: redirects back with ?uploaded= or ?uploadError=.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Cookie-authenticated POST outside server actions: reject cross-site requests.
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const idResult = idSchema.safeParse(params.id);
  if (!idResult.success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const projectId = idResult.data;

  // Relative Location so the redirect works whatever host name the NAS is reached by.
  const back = (query: Record<string, string>) => {
    const qs = new URLSearchParams(query).toString();
    return new NextResponse(null, {
      status: 303,
      headers: { Location: `/projects/${projectId}/references${qs ? `?${qs}` : ""}` },
    });
  };

  // Only the owner may attach files; another user's project looks missing.
  const project = await db.project.findFirst({ where: { id: projectId, ownerId: user.id, deletedAt: null } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { t } = getI18n();
  const E = t.refs.errors;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back({ uploadError: E.noUpload });
  }

  const meta = schemas(t).reference.safeParse({
    caption: form.get("caption") ?? undefined,
    sourceUrl: form.get("sourceUrl") ?? undefined,
  });
  if (!meta.success) {
    return back({ uploadError: meta.error.issues[0]?.message ?? E.checkFields });
  }

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return back({ uploadError: t.refs.chooseOne });
  if (files.length > 20) return back({ uploadError: E.tooMany });

  let saved = 0;
  const errors: string[] = [];
  for (const file of files) {
    try {
      const stored = await storeImage(projectId, file);
      try {
        await db.referenceImage.create({
          data: {
            projectId,
            ...stored,
            originalName: file.name.slice(0, 200) || "image",
            caption: meta.data.caption,
            sourceUrl: meta.data.sourceUrl,
          },
        });
      } catch (err) {
        await removeStoredFiles(stored.filePath, stored.thumbPath);
        throw err;
      }
      saved += 1;
    } catch (err) {
      if (err instanceof UploadError) {
        errors.push(`${file.name}: ${err.code === "tooLarge" ? E.tooLarge(env().MAX_UPLOAD_MB) : E[err.code]}`);
      } else {
        console.error("Reference upload failed", err);
        errors.push(`${file.name}: ${E.notSaved}`);
      }
    }
  }

  revalidatePath(`/projects/${projectId}`, "layout");
  const query: Record<string, string> = { uploaded: String(saved) };
  if (errors.length) query.uploadError = errors.join(" ").slice(0, 500);
  return back(query);
}
