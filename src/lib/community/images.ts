import "server-only";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { uploadRoot } from "../env";
import { resolveUploadPath } from "../uploads";

// Published images are COPIES under <UPLOAD_DIR>/public/<publicationId>/ with
// fresh random names. Private originals stay behind the private route, and
// unpublishing removes the copies.

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

/** Copies a private image (display version + thumbnail) into the publication's folder. */
export async function copyToPublic(
  publicationId: string,
  image: { filePath: string; thumbPath: string },
): Promise<{ filePath: string; thumbPath: string }> {
  const src = resolveUploadPath(image.filePath);
  const srcThumb = resolveUploadPath(image.thumbPath);
  if (!src || !srcThumb) throw new Error("Invalid stored image path");
  const dir = path.join(publicRoot(), publicationId);
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const ext = path.extname(image.filePath).toLowerCase() || ".jpg";
  const file = `${id}${ext}`;
  const thumb = `${id}.thumb.webp`;
  await copyFile(src, path.join(dir, file));
  await copyFile(srcThumb, path.join(dir, thumb));
  return { filePath: `${publicationId}/${file}`, thumbPath: `${publicationId}/${thumb}` };
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
 * Copies a published image into a (new) private project folder, for "Copy to
 * My Projects". Returns paths relative to UPLOAD_DIR plus the copied size.
 */
export async function copyPublicToPrivate(
  image: { filePath: string; thumbPath: string },
  projectId: string,
): Promise<{ filePath: string; thumbPath: string; sizeBytes: number }> {
  const src = resolvePublicPath(image.filePath);
  const srcThumb = resolvePublicPath(image.thumbPath);
  if (!src || !srcThumb || !SAFE.test(projectId)) throw new Error("Invalid image path");
  const dir = path.join(uploadRoot(), projectId);
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const ext = path.extname(image.filePath).toLowerCase() || ".jpg";
  await copyFile(src, path.join(dir, `${id}${ext}`));
  await copyFile(srcThumb, path.join(dir, `${id}.thumb.webp`));
  const { size } = await stat(path.join(dir, `${id}${ext}`));
  return { filePath: `${projectId}/${id}${ext}`, thumbPath: `${projectId}/${id}.thumb.webp`, sizeBytes: size };
}
