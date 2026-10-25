import "server-only";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./dataDir";

let cached: string | null = null;

/**
 * Secret that signs session cookies. AUTH_SECRET wins if set; otherwise one is
 * generated ONCE into <data>/secrets/auth-secret (mode 600) and reused, so it
 * survives container replacements (it lives on the data volume).
 */
export function getAuthSecret(): string {
  if (cached) return cached;
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) {
    if (fromEnv.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
    cached = fromEnv;
    return cached;
  }
  const dir = process.env.SECRETS_DIR ?? path.join(dataDir(), "secrets");
  const file = path.join(dir, "auth-secret");
  if (existsSync(file)) {
    const value = readFileSync(file, "utf8").trim();
    if (value.length >= 32) {
      cached = value;
      return cached;
    }
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const value = randomBytes(48).toString("base64url");
  // "wx": never overwrite a secret another process wrote first.
  try {
    writeFileSync(file, `${value}\n`, { flag: "wx", mode: 0o600 });
    cached = value;
  } catch {
    cached = readFileSync(file, "utf8").trim();
  }
  try {
    chmodSync(file, 0o600);
  } catch {
    /* not supported on this filesystem */
  }
  return cached;
}
