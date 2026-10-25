import path from "node:path";
import { z } from "zod";

/** Blank variables (e.g. `REGISTRATION_CODE=` or an unset compose `${VAR:-}`) count as unset. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

const schema = z.object({
  UPLOAD_DIR: optional(z.string().default("./data/uploads")),
  MAX_UPLOAD_MB: optional(z.coerce.number().positive().max(100).default(15)),
  /** Public address of the app, e.g. https://nas.tailnet.ts.net — used in reset links and for secure cookies. */
  APP_URL: optional(z.string().url().optional()),
  /** Invite code required to register. Unset = registration closed. */
  REGISTRATION_CODE: optional(z.string().min(6, "REGISTRATION_CODE must be at least 6 characters").optional()),
  /** Override the Secure cookie flag (defaults to true when APP_URL is https). */
  COOKIE_SECURE: optional(z.enum(["true", "false"]).optional()),
});

let cached: z.infer<typeof schema> | null = null;

/** Server-only configuration, validated once on first use. */
export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function uploadRoot(): string {
  return path.resolve(env().UPLOAD_DIR);
}

export function appUrl(): string {
  return (env().APP_URL ?? "http://localhost:1337").replace(/\/+$/, "");
}

/** Secure cookies need HTTPS; over plain http:// browsers would drop them and login would loop. */
export function secureCookies(): boolean {
  const e = env();
  if (e.COOKIE_SECURE) return e.COOKIE_SECURE === "true";
  return appUrl().startsWith("https://");
}

export function registrationOpen(): boolean {
  return Boolean(env().REGISTRATION_CODE);
}
