import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import { UploadError, removeStoredFiles, storeImage } from "@/lib/uploads";
import { idSchema, referenceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Multipart upload of one or more reference images. Handled as a route (not a
 * server action) so large photos aren't limited by the server-action body size.
 * Works as a plain HTML form post: redirects back with ?uploaded= or ?uploadError=.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back({ uploadError: "The upload didn't come through. Try again." });
  }

  const meta = referenceSchema.safeParse({
    caption: form.get("caption") ?? undefined,
    sourceUrl: form.get("sourceUrl") ?? undefined,
  });
  if (!meta.success) {
    return back({ uploadError: meta.error.issues[0]?.message ?? "Check the caption and link." });
  }

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return back({ uploadError: "Choose at least one image." });
  if (files.length > 20) return back({ uploadError: "Upload up to 20 images at a time." });

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
        errors.push(`${file.name}: ${err.message}`);
      } else {
        console.error("Reference upload failed", err);
        errors.push(`${file.name}: couldn't be saved.`);
      }
    }
  }

  revalidatePath(`/projects/${projectId}`, "layout");
  const query: Record<string, string> = { uploaded: String(saved) };
  if (errors.length) query.uploadError = errors.join(" ").slice(0, 500);
  return back(query);
}
