"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { GUEST_MAX_PROJECTS, guestUsage } from "@/lib/guest";
import { getMoneyContext } from "@/lib/queries";
import {
  ImportError,
  type ImportOptions,
  type ImportPreview,
  type ImportReport,
  applyImport,
  buildPreview,
  parseImportText,
} from "@/lib/transfer/import";
import { idSchema } from "@/lib/validation";

export type PreviewResult = { ok: true; preview: ImportPreview } | { ok: false; errors: string[] };
export type ImportResult = { ok: true; report: ImportReport } | { ok: false; errors: string[] };

/** Validates the file and summarises it (optionally against a target project). Changes nothing. */
export async function previewImport(text: string, targetId?: string): Promise<PreviewResult> {
  const user = await requireUser();
  const { t } = getI18n();
  const parsed = parseImportText(text, t);
  if (!parsed.ok) return parsed;
  const target = targetId && idSchema.safeParse(targetId).success ? targetId : undefined;
  return { ok: true, preview: await buildPreview(parsed.file, user.id, await getMoneyContext(user.id), t, target) };
}

/** Re-validates and imports in one transaction. */
export async function runImport(text: string, options: ImportOptions): Promise<ImportResult> {
  const user = await requireUser();
  const { t } = getI18n();
  const parsed = parseImportText(text, t);
  if (!parsed.ok) return parsed;

  if (options.mode === "create" && user.isGuest && (await guestUsage(user.id)).projects >= GUEST_MAX_PROJECTS) {
    return { ok: false, errors: [t.guest.projectLimit(GUEST_MAX_PROJECTS)] };
  }
  if (options.mode !== "create" && !idSchema.safeParse(options.targetId).success) {
    return { ok: false, errors: [t.transfer.errors.missingTarget] };
  }
  try {
    const report = await applyImport(parsed.file, options, user.id, await getMoneyContext(user.id), t);
    revalidatePath("/projects", "layout");
    revalidatePath("/shopping");
    return { ok: true, report };
  } catch (err) {
    if (err instanceof ImportError) return { ok: false, errors: [err.message] };
    console.error("Project import failed", err);
    return { ok: false, errors: [t.transfer.errors.failed] };
  }
}
