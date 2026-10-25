// Shared helpers for the admin commands (run inside the container or with tsx locally).
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : undefined;
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function fail(message: string): never {
  console.error(`\nError: ${message}\n`);
  process.exit(1);
}

function dataDir(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = url.replace(/^file:/, "");
  const dbPath = path.isAbsolute(file) ? file : path.resolve("prisma", file);
  return path.dirname(dbPath);
}

/** Consistent snapshot (SQLite VACUUM INTO) into <data>/backups; returns its path. */
export async function snapshot(label: string): Promise<string> {
  const dir = process.env.BACKUP_DIR ?? path.join(dataDir(), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 18);
  const target = path.join(dir, `cosplay-${stamp}-${randomBytes(2).toString("hex")}-${label}.db`);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return target;
}
