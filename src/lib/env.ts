import path from "node:path";
import { z } from "zod";

/** Blank variables (e.g. `APP_PASSWORD=` or an unset compose `${VAR:-}`) count as unset. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

const schema = z
  .object({
    // Login is off unless a password is set.
    APP_PASSWORD: optional(z.string().min(8, "APP_PASSWORD must be at least 8 characters").optional()),
    SESSION_SECRET: optional(z.string().min(32, "SESSION_SECRET must be at least 32 characters").optional()),
    UPLOAD_DIR: optional(z.string().default("./data/uploads")),
    MAX_UPLOAD_MB: optional(z.coerce.number().positive().max(100).default(15)),
    COOKIE_SECURE: optional(
      z
        .enum(["true", "false"])
        .default("false")
        .transform((v) => v === "true"),
    ),
  })
  .refine((e) => !e.APP_PASSWORD || e.SESSION_SECRET, {
    message: "SESSION_SECRET is required when APP_PASSWORD is set",
    path: ["SESSION_SECRET"],
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

/** True when APP_PASSWORD is set; otherwise the app is open to anyone who can reach it. */
export function authEnabled(): boolean {
  return Boolean(env().APP_PASSWORD);
}
