import "server-only";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { uploadRoot } from "../env";
import { encryptBytes } from "../crypto";
import { resolveUploadPath } from "../uploads";

// Before 1.6, published images were COPIES under <UPLOAD_DIR>/public/<publicationId>/.
// Public pages are live now (images served by /api/community/images after an
// allow check), so these helpers only clean up old copies, plus the copy used by
// "Copy to My Projects".

const SAFE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

export function publicRoot(): string {
  return path.join(uploadRoot(), "public");
}

/** Resolves "<publicationId>/<file>" inside the public folder, or null. */
export function resolvePublicPath(relative: string): string | null {
  const parts = relative.split("/");
  if (parts.length !== 2 || !parts.every((p) => SAFE.test(p))) return null;
  const root = publicRoot();
  const full = path.resolve(root, ...parts);
  return full.startsWith(root + path.sep) ? full : null;
}

export async function removePublicFiles(...relativePaths: string[]): Promise<void> {
  for (const rel of relativePaths) {
    const full = resolvePublicPath(rel);
    if (full) await rm(full, { force: true });
  }
}

export async function removePublicationFolder(publicationId: string): Promise<void> {
  if (!SAFE.test(publicationId)) return;
  await rm(path.join(publicRoot(), publicationId), { recursive: true, force: true });
}

/**
 * Copies a published (plain) image into a new private project folder, for
 * "Copy to My Projects". With `key` (a guest copying), the copy is encrypted.
 * Returns paths relative to UPLOAD_DIR plus the stored size.
 */
export async function copyImageToProject(
  image: { filePath: string; thumbPath: string },
  projectId: string,
  key: Buffer | null,
): Promise<{ filePath: string; thumbPath: string; sizeBytes: number; encrypted: boolean }> {
  const src = resolveUploadPath(image.filePath);
  const srcThumb = resolveUploadPath(image.thumbPath);
  if (!src || !srcThumb || !SAFE.test(projectId)) throw new Error("Invalid image path");
  const dir = path.join(uploadRoot(), projectId);
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const ext = key ? ".enc" : path.extname(image.filePath).toLowerCase() || ".jpg";
  const thumbExt = key ? ".thumb.enc" : ".thumb.webp";
  if (key) {
    await writeFile(path.join(dir, `${id}${ext}`), encryptBytes(await readFile(src), key));
    await writeFile(path.join(dir, `${id}${thumbExt}`), encryptBytes(await readFile(srcThumb), key));
  } else {
    await copyFile(src, path.join(dir, `${id}${ext}`));
    await copyFile(srcThumb, path.join(dir, `${id}${thumbExt}`));
  }
  const { size } = await stat(path.join(dir, `${id}${ext}`));
  return { filePath: `${projectId}/${id}${ext}`, thumbPath: `${projectId}/${id}${thumbExt}`, sizeBytes: size, encrypted: !!key };
}
