import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env, uploadRoot } from "./env";

/** Formats sharp can decode with its prebuilt binaries and browsers can show. */
const FORMATS = {
  jpeg: { ext: "jpg", mime: "image/jpeg" },
  png: { ext: "png", mime: "image/png" },
  webp: { ext: "webp", mime: "image/webp" },
  gif: { ext: "gif", mime: "image/gif" },
  avif: { ext: "avif", mime: "image/avif" },
} as const;
type Format = keyof typeof FORMATS;

export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,image/gif,image/avif";
const MAX_DIMENSION = 2400;
const THUMB_SIZE = 480;

export class UploadError extends Error {}

export type StoredImage = {
  filePath: string;
  thumbPath: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
};

/**
 * Validates an uploaded image by decoding it (not by trusting the file name or
 * MIME type), then stores a resized copy with metadata (incl. GPS) stripped,
 * plus a WebP thumbnail. Animated GIFs are kept as-is.
 */
export async function storeImage(projectId: string, file: File): Promise<StoredImage> {
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size === 0) throw new UploadError("That file is empty.");
  if (file.size > maxBytes) {
    throw new UploadError(`That image is larger than ${env().MAX_UPLOAD_MB} MB.`);
  }

  const input = Buffer.from(await file.arrayBuffer());
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new UploadError("That file isn't an image we can read. Use JPEG, PNG, WebP, GIF or AVIF.");
  }
  const format = meta.format as string | undefined;
  if (!format || !(format in FORMATS)) {
    const heic = format === "heif" ? " iPhone HEIC photos: set Camera → Formats → Most Compatible, or share as JPEG." : "";
    throw new UploadError(`Unsupported image format.${heic} Use JPEG, PNG, WebP, GIF or AVIF.`);
  }
  const fmt = format as Format;
  if ((meta.width ?? 0) * (meta.height ?? 0) > 100_000_000) {
    throw new UploadError("That image's dimensions are too large.");
  }

  const id = randomUUID();
  const dir = path.join(uploadRoot(), projectId);
  await mkdir(dir, { recursive: true });

  let output: Buffer;
  let width = meta.width ?? null;
  let height = meta.height ?? null;
  if (fmt === "gif") {
    output = input;
  } else {
    const result = await sharp(input)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .toFormat(fmt, fmt === "jpeg" ? { quality: 85, mozjpeg: true } : { quality: 85 })
      .toBuffer({ resolveWithObject: true });
    output = result.data;
    width = result.info.width;
    height = result.info.height;
  }

  const thumb = await sharp(input, { animated: false })
    .rotate()
    .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "cover", position: "attention" })
    .webp({ quality: 75 })
    .toBuffer();

  const fileName = `${id}.${FORMATS[fmt].ext}`;
  const thumbName = `${id}.thumb.webp`;
  await writeFile(path.join(dir, fileName), output);
  await writeFile(path.join(dir, thumbName), thumb);

  return {
    filePath: `${projectId}/${fileName}`,
    thumbPath: `${projectId}/${thumbName}`,
    mimeType: FORMATS[fmt].mime,
    sizeBytes: output.length,
    width,
    height,
  };
}

const SAFE_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/** Resolves a stored relative path inside UPLOAD_DIR, refusing anything that escapes it. */
export function resolveUploadPath(relative: string): string | null {
  const segments = relative.split("/");
  if (segments.length !== 2 || !segments.every((s) => SAFE_SEGMENT.test(s))) return null;
  const root = uploadRoot();
  const full = path.resolve(root, ...segments);
  return full.startsWith(root + path.sep) ? full : null;
}

export async function removeStoredFiles(...relativePaths: string[]): Promise<void> {
  for (const rel of relativePaths) {
    const full = resolveUploadPath(rel);
    if (full) await rm(full, { force: true });
  }
}

export async function removeProjectFiles(projectId: string): Promise<void> {
  if (!SAFE_SEGMENT.test(projectId)) return;
  await rm(path.join(uploadRoot(), projectId), { recursive: true, force: true });
}

export function mimeForPath(p: string): string {
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}
