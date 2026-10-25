import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

/** Folder next to the SQLite file (same place as scripts/backup.mjs uses). */
function backupDir(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = url.replace(/^file:/, "");
  // Relative SQLite paths in Prisma are relative to the prisma/ folder.
  const dbPath = path.isAbsolute(file) ? file : path.resolve("prisma", file);
  return process.env.BACKUP_DIR ?? path.join(path.dirname(dbPath), "backups");
}

/**
 * Consistent snapshot of the database (SQLite VACUUM INTO), e.g. before an
 * import changes an existing project. Returns the file name. These labelled
 * snapshots aren't pruned by the scheduled backup rotation.
 */
export async function snapshotDatabase(label: string): Promise<string> {
  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  // Millisecond timestamp + random suffix: two imports in the same second must not collide.
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 18);
  const suffix = randomBytes(2).toString("hex");
  const name = `cosplay-${stamp}-${suffix}-${label.replace(/[^a-z0-9-]/gi, "")}.db`;
  const target = path.join(dir, name);
  await db.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return name;
}
