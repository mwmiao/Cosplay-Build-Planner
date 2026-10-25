// Consistent SQLite snapshot using VACUUM INTO (safe while the app is running).
// Usage: node scripts/backup.mjs   (in Docker: docker exec cosplay-planner node scripts/backup.mjs)
// Writes <data>/backups/cosplay-YYYYMMDD-HHMMSS.db and keeps the newest BACKUP_KEEP files.
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const dbFile = url.replace(/^file:/, "");
// Relative SQLite paths in Prisma are relative to the prisma/ folder.
const dbPath = path.isAbsolute(dbFile) ? dbFile : path.resolve("prisma", dbFile);
const backupDir = process.env.BACKUP_DIR ?? path.join(path.dirname(dbPath), "backups");
const keep = Number(process.env.BACKUP_KEEP ?? 14);

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const target = path.join(backupDir, `cosplay-${stamp}.db`);

await mkdir(backupDir, { recursive: true });
const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  console.log(`Backup written: ${target}`);
} finally {
  await prisma.$disconnect();
}

const files = (await readdir(backupDir))
  .filter((f) => /^cosplay-\d{8}-\d{6}\.db$/.test(f))
  .sort()
  .reverse();
for (const old of files.slice(keep)) {
  await rm(path.join(backupDir, old));
  console.log(`Pruned old backup: ${old}`);
}
