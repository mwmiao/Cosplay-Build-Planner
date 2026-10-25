import path from "node:path";

/** Folder that holds the SQLite file (the persistent data volume in Docker: /app/data). */
export function dataDir(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = url.replace(/^file:/, "");
  // Relative SQLite paths in Prisma are relative to the prisma/ folder.
  const dbPath = path.isAbsolute(file) ? file : path.resolve("prisma", file);
  return path.dirname(dbPath);
}
