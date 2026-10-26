import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { decryptBytes } from "./crypto";
import { db } from "./db";
import { secureCookies } from "./env";
import { removeProjectFiles, resolveUploadPath } from "./uploads";

// Guests ("try without an account"):
// - a Better Auth anonymous user with a normal session cookie;
// - private projects only (can't publish), at most GUEST_MAX_PROJECTS projects
//   and GUEST_MAX_BYTES of images;
// - deleted GUEST_DAYS after creation unless they register (or log in), which
//   moves everything into that account;
// - their images are encrypted on disk with a random key that exists only in
//   the guest's browser cookie, so they can't be opened from the server's
//   files or database (see README → Guests for what this does and doesn't cover).

export const GUEST_DAYS = 30;
export const GUEST_MAX_PROJECTS = 5;
export const GUEST_MAX_BYTES = 50 * 1024 * 1024;

const KEY_COOKIE = () => (secureCookies() ? "__Secure-cbp.guest_key" : "cbp.guest_key");

export function guestExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + GUEST_DAYS * 86_400_000);
}

/** Creates the guest's encryption key and stores it only in their browser. */
export function issueGuestKey(): void {
  cookies().set(KEY_COOKIE(), randomBytes(32).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: GUEST_DAYS * 86_400,
  });
}

/** The guest's key from their cookie (null when missing or malformed). */
export function guestKey(): Buffer | null {
  const value = cookies().get(KEY_COOKIE())?.value;
  if (!value) return null;
  const key = Buffer.from(value, "base64url");
  return key.length === 32 ? key : null;
}

export function clearGuestKey(): void {
  cookies().delete(KEY_COOKIE());
}

export type GuestUsage = { projects: number; bytes: number };

/** Counts every project the guest still has (archived and deleted ones too, so the limit can't be dodged). */
export async function guestUsage(userId: string): Promise<GuestUsage> {
  const [projects, images] = await Promise.all([
    db.project.count({ where: { ownerId: userId } }),
    db.referenceImage.aggregate({ where: { project: { ownerId: userId } }, _sum: { sizeBytes: true } }),
  ]);
  return { projects, bytes: images._sum.sizeBytes ?? 0 };
}

/**
 * Moves a guest's projects and shopping items to `toUserId` (registration or
 * login), decrypting their images into normal files with `key`. Images that
 * can't be decrypted (key cookie lost) are dropped rather than kept unreadable.
 */
export async function moveGuestData(fromUserId: string, toUserId: string, key: Buffer | null): Promise<void> {
  const images = await db.referenceImage.findMany({ where: { encrypted: true, project: { ownerId: fromUserId } } });
  for (const img of images) {
    const src = resolveUploadPath(img.filePath);
    const srcThumb = resolveUploadPath(img.thumbPath);
    try {
      if (!key || !src || !srcThumb) throw new Error("No key");
      const [file, thumb] = await Promise.all([readFile(src), readFile(srcThumb)]);
      const id = randomUUID();
      const ext = img.mimeType === "image/png" ? "png" : img.mimeType === "image/webp" ? "webp" : img.mimeType === "image/gif" ? "gif" : img.mimeType === "image/avif" ? "avif" : "jpg";
      const dir = path.dirname(src);
      await writeFile(path.join(dir, `${id}.${ext}`), decryptBytes(file, key));
      await writeFile(path.join(dir, `${id}.thumb.webp`), decryptBytes(thumb, key));
      await db.referenceImage.update({
        where: { id: img.id },
        data: { filePath: `${img.projectId}/${id}.${ext}`, thumbPath: `${img.projectId}/${id}.thumb.webp`, encrypted: false },
      });
    } catch {
      await db.referenceImage.delete({ where: { id: img.id } });
    }
    for (const file of [src, srcThumb]) if (file) await rm(file, { force: true }).catch(() => undefined);
  }
  await db.$transaction([
    db.project.updateMany({ where: { ownerId: fromUserId }, data: { ownerId: toUserId } }),
    db.shoppingListItem.updateMany({ where: { ownerId: fromUserId }, data: { ownerId: toUserId } }),
  ]);
}

/** Deletes a guest and everything they created (projects, images, shopping items, sessions). */
export async function deleteGuest(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isAnonymous: true } });
  if (!user?.isAnonymous) return; // never touches real accounts
  const projects = await db.project.findMany({ where: { ownerId: userId }, select: { id: true } });
  await db.$transaction([
    db.shoppingListItem.deleteMany({ where: { ownerId: userId } }),
    db.project.deleteMany({ where: { ownerId: userId } }),
    db.user.delete({ where: { id: userId } }),
  ]);
  for (const p of projects) await removeProjectFiles(p.id);
}

/** Removes guests older than GUEST_DAYS. Returns how many were deleted. */
export async function cleanupExpiredGuests(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - GUEST_DAYS * 86_400_000);
  const expired = await db.user.findMany({ where: { isAnonymous: true, createdAt: { lt: cutoff } }, select: { id: true } });
  for (const g of expired) {
    try {
      await deleteGuest(g.id);
    } catch (err) {
      console.error("Removing expired guest failed", err);
    }
  }
  return expired.length;
}
