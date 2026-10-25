import "server-only";
import type { Prisma } from "@prisma/client";
import type { ZodIssue } from "zod";
import type { Dict } from "@/i18n";
import { snapshotDatabase } from "../backup";
import { CATEGORIES } from "../constants";
import { db } from "../db";
import { type MoneyContext, projectCurrency } from "../projects";
import { crossRate } from "../rates";
import { syncShoppingItemForPart } from "../shopping";
import {
  EXPORT_FORMAT,
  EXPORT_SCHEMA_VERSION,
  type ExportFile,
  type ExportPart,
  exportFileSchema,
  findDuplicateIds,
} from "./format";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_LISTED_ERRORS = 25;

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Parsing and validation

export type ParseResult = { ok: true; file: ExportFile } | { ok: false; errors: string[] };

function pathLabel(path: (string | number)[]): string {
  return path.reduce<string>((acc, p) => (typeof p === "number" ? `${acc}[${p}]` : acc ? `${acc}.${p}` : p), "");
}

function formatIssue(issue: ZodIssue, t: Dict): string {
  const T = t.transfer.issue;
  let msg: string;
  if (issue.code === "custom" && issue.params?.key && issue.params.key in T) {
    msg = (T as Record<string, unknown>)[issue.params.key] as string;
  } else if (issue.code === "invalid_type") {
    msg = issue.received === "undefined" ? T.missing : T.wrongType(issue.expected);
  } else if (issue.code === "invalid_enum_value") {
    msg = T.oneOf(issue.options.join(", "));
  } else if (issue.code === "too_small" || issue.code === "too_big") {
    msg = T.outOfRange;
  } else {
    msg = T.invalid;
  }
  const where = pathLabel(issue.path);
  return where ? `${where}: ${msg}` : msg;
}

/** Validates the file text: JSON, format, schema version, then every field. */
export function parseImportText(text: string, t: Dict): ParseResult {
  const E = t.transfer.errors;
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) return { ok: false, errors: [E.tooLarge] };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: [E.notJson] };
  }
  const head = raw as { format?: unknown; schemaVersion?: unknown } | null;
  if (!head || typeof head !== "object" || head.format !== EXPORT_FORMAT) {
    return { ok: false, errors: [E.notExport] };
  }
  if (typeof head.schemaVersion === "number" && head.schemaVersion > EXPORT_SCHEMA_VERSION) {
    return { ok: false, errors: [E.newerVersion(head.schemaVersion, EXPORT_SCHEMA_VERSION)] };
  }
  if (head.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return { ok: false, errors: [E.unsupportedVersion(head.schemaVersion)] };
  }

  const parsed = exportFileSchema.safeParse(raw);
  const duplicates = findDuplicateIds(raw).map(([section, i]) => `${section}[${i}].id: ${t.transfer.issue.duplicateId}`);
  if (!parsed.success || duplicates.length) {
    const all = [...duplicates, ...(parsed.success ? [] : parsed.error.issues.map((i) => formatIssue(i, t)))];
    const errors = all.slice(0, MAX_LISTED_ERRORS);
    if (all.length > MAX_LISTED_ERRORS) errors.push(E.more(all.length - MAX_LISTED_ERRORS));
    return { ok: false, errors };
  }
  return { ok: true, file: parsed.data };
}

// ---------------------------------------------------------------------------
// Preview

export type TargetSummary = {
  id: string;
  name: string;
  base: string;
  currencyMismatch: boolean;
  existingParts: number;
  existingItems: number;
  newParts: number;
  duplicateParts: number;
  newItems: number;
  duplicateItems: number;
};

export type ImportPreview = {
  projectName: string;
  series: string | null;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string | null;
  base: string;
  partCount: number;
  paidCount: number;
  shoppingItemCount: number;
  referenceCount: number;
  currencies: string[];
  paidCents: number;
  plannedCents: number;
  plannedConverted: boolean;
  budgetCents: number | null;
  warnings: string[];
  matchingProject: { id: string; name: string } | null;
  target: TargetSummary | null;
};

function plannedTotal(file: ExportFile, ctx: MoneyContext) {
  const base = file.project.currency;
  let total = 0;
  let converted = false;
  const missing = new Set<string>();
  for (const p of file.parts) {
    if (p.payment) continue;
    const each = p.actualCostCents ?? p.estimatedCostCents;
    if (each === null) continue;
    const rate = crossRate(ctx.rates, p.currency, base);
    if (rate === null) {
      missing.add(p.currency);
      continue;
    }
    if (p.currency !== base) converted = true;
    total += Math.round(each * p.quantity * rate);
  }
  return { total, converted, missing: [...missing] };
}

async function summarizeTarget(
  file: ExportFile,
  targetId: string,
  userId: string,
  ctx: MoneyContext,
): Promise<TargetSummary | null> {
  const target = await db.project.findFirst({
    where: { id: targetId, ownerId: userId, deletedAt: null },
    include: {
      parts: { select: { uid: true, deletedAt: true } },
      shoppingItems: { where: { partId: null }, select: { uid: true, deletedAt: true } },
    },
  });
  if (!target) return null;
  const partUids = new Set(target.parts.map((p) => p.uid));
  const itemUids = new Set(target.shoppingItems.map((s) => s.uid));
  const duplicateParts = file.parts.filter((p) => partUids.has(p.id)).length;
  const duplicateItems = file.shoppingItems.filter((s) => itemUids.has(s.id)).length;
  const base = projectCurrency(target, ctx);
  return {
    id: target.id,
    name: target.characterName,
    base,
    currencyMismatch: base !== file.project.currency,
    existingParts: target.parts.filter((p) => !p.deletedAt).length,
    existingItems: target.shoppingItems.filter((s) => !s.deletedAt).length,
    newParts: file.parts.length - duplicateParts,
    duplicateParts,
    newItems: file.shoppingItems.length - duplicateItems,
    duplicateItems,
  };
}

export async function buildPreview(
  file: ExportFile,
  userId: string,
  ctx: MoneyContext,
  t: Dict,
  targetId?: string,
): Promise<ImportPreview> {
  const W = t.transfer.warn;
  const warnings: string[] = [];

  const unknown = [...new Set(file.parts.map((p) => p.category).filter((c) => !(CATEGORIES as readonly string[]).includes(c)))];
  if (unknown.length) warnings.push(W.unknownCategories(unknown.join(", ")));
  if (file.references.length) warnings.push(W.references(file.references.length));
  if (file.project.archived) warnings.push(W.archived);

  const planned = plannedTotal(file, ctx);
  if (planned.missing.length) warnings.push(W.missingRates(planned.missing.join(", ")));

  let matchingProject: ImportPreview["matchingProject"] = null;
  if (file.project.id) {
    // Only the user's own projects can be suggested; the file's ids grant nothing.
    const match = await db.project.findFirst({
      where: { id: file.project.id, ownerId: userId, deletedAt: null },
      select: { id: true, characterName: true },
    });
    if (match) {
      matchingProject = { id: match.id, name: match.characterName };
      warnings.push(W.matchesExisting(match.characterName));
    }
  }

  const currencies = new Set<string>([file.project.currency]);
  for (const p of file.parts) currencies.add(p.currency);
  for (const s of file.shoppingItems) currencies.add(s.currency);

  return {
    projectName: file.project.characterName,
    series: file.project.series,
    schemaVersion: file.schemaVersion,
    exportedAt: file.exportedAt,
    appVersion: file.app?.version ?? null,
    base: file.project.currency,
    partCount: file.parts.length,
    paidCount: file.parts.filter((p) => p.payment).length,
    shoppingItemCount: file.shoppingItems.length,
    referenceCount: file.references.length,
    currencies: [...currencies].sort(),
    paidCents: file.parts.reduce((sum, p) => sum + (p.payment?.baseAmountCents ?? 0), 0),
    plannedCents: planned.total,
    plannedConverted: planned.converted,
    budgetCents: file.project.budgetCents,
    warnings,
    matchingProject,
    target: targetId ? await summarizeTarget(file, targetId, userId, ctx) : null,
  };
}

// ---------------------------------------------------------------------------
// Applying an import

export type ImportOptions =
  | { mode: "create" }
  | { mode: "merge"; targetId: string }
  | { mode: "replace"; targetId: string; confirm: string };

export type ImportReport = {
  mode: ImportOptions["mode"];
  projectId: string;
  projectName: string;
  partsCreated: number;
  paidPreserved: number;
  partsSkipped: number;
  partsRemoved: number;
  itemsCreated: number;
  itemsSkipped: number;
  itemsRemoved: number;
  referencesSkipped: number;
  backup: string | null;
  warnings: string[];
};

export class ImportError extends Error {}

const toDay = (s: string) => new Date(`${s}T00:00:00.000Z`);
const toDate = (s: string | null | undefined) => (s ? new Date(s) : null);

function projectData(file: ExportFile) {
  const p = file.project;
  return {
    characterName: p.characterName,
    series: p.series,
    conventionName: p.conventionName,
    deadline: p.deadline ? toDay(p.deadline) : null,
    status: p.status,
    currency: p.currency,
    budgetCents: p.budgetCents,
    notes: p.notes,
  };
}

/** Part row with the payment copied verbatim: no rate lookup, no recalculation. */
function partData(part: ExportPart, projectId: string) {
  const pay = part.payment;
  return {
    uid: part.id,
    projectId,
    name: part.name,
    category: (CATEGORIES as readonly string[]).includes(part.category) ? part.category : "other",
    status: part.status,
    currency: part.currency,
    quantity: part.quantity,
    estimatedCostCents: part.estimatedCostCents,
    actualCostCents: part.actualCostCents,
    supplier: part.supplier,
    url: part.url,
    notes: part.notes,
    completedAt: toDate(part.completedAt),
    createdAt: new Date(part.createdAt),
    paidAt: pay ? toDay(pay.paidAt) : null,
    paidBaseCents: pay ? pay.baseAmountCents : null,
    fxRate: pay ? pay.fxRate : null,
    fxRateDate: pay ? pay.fxRateDate : null,
    fxSource: pay ? pay.fxSource : null,
    fxManual: pay ? pay.fxManual : false,
  };
}

async function insertRows(
  tx: Tx,
  file: ExportFile,
  projectId: string,
  ownerId: string,
  skipPartUids: Set<string>,
  skipItemUids: Set<string>,
) {
  let partsCreated = 0;
  let paidPreserved = 0;
  for (const p of file.parts) {
    if (skipPartUids.has(p.id)) continue;
    // New database ids every time; only the stable uid comes from the file.
    const part = await tx.buildPart.create({ data: partData(p, projectId) });
    await syncShoppingItemForPart(tx, part, ownerId);
    partsCreated += 1;
    if (p.payment) paidPreserved += 1;
  }
  let itemsCreated = 0;
  for (const s of file.shoppingItems) {
    if (skipItemUids.has(s.id)) continue;
    await tx.shoppingListItem.create({
      data: {
        uid: s.id,
        ownerId,
        projectId,
        name: s.name,
        category: (CATEGORIES as readonly string[]).includes(s.category) ? s.category : "other",
        supplier: s.supplier,
        url: s.url,
        quantity: s.quantity,
        currency: s.currency,
        estimatedCostCents: s.estimatedCostCents,
        notes: s.notes,
        purchased: s.purchased,
        purchasedAt: toDate(s.purchasedAt),
        createdAt: new Date(s.createdAt),
      },
    });
    itemsCreated += 1;
  }
  return { partsCreated, paidPreserved, itemsCreated };
}

/**
 * Imports a validated file in one transaction: either everything is written or
 * nothing is. Merge and replace take a database snapshot first.
 */
export async function applyImport(
  file: ExportFile,
  options: ImportOptions,
  userId: string,
  ctx: MoneyContext,
  t: Dict,
): Promise<ImportReport> {
  const E = t.transfer.errors;
  const preview = await buildPreview(file, userId, ctx, t, options.mode === "create" ? undefined : options.targetId);
  const warnings = preview.warnings.filter((w) => w !== (preview.matchingProject ? t.transfer.warn.matchesExisting(preview.matchingProject.name) : ""));

  let backup: string | null = null;
  if (options.mode !== "create") {
    const target = preview.target;
    if (!target) throw new ImportError(E.targetNotFound);
    if (options.mode === "merge" && target.currencyMismatch) {
      throw new ImportError(t.transfer.currencyMismatch(file.project.currency, target.base));
    }
    if (options.mode === "replace" && options.confirm.trim() !== target.name) {
      throw new ImportError(t.transfer.confirmMismatch);
    }
    try {
      backup = await snapshotDatabase("pre-import");
    } catch (err) {
      console.error("Pre-import backup failed", err);
      throw new ImportError(E.backupFailed);
    }
  }

  const base = {
    referencesSkipped: file.references.length,
    backup,
    warnings,
  };

  return db.$transaction(
    async (tx) => {
      if (options.mode === "create") {
        // Always a new private project owned by the importing user.
        const project = await tx.project.create({ data: { ...projectData(file), ownerId: userId } });
        const r = await insertRows(tx, file, project.id, userId, new Set(), new Set());
        return {
          mode: "create",
          projectId: project.id,
          projectName: project.characterName,
          ...r,
          partsSkipped: 0,
          partsRemoved: 0,
          itemsSkipped: 0,
          itemsRemoved: 0,
          ...base,
        } satisfies ImportReport;
      }

      const target = await tx.project.findFirst({ where: { id: options.targetId, ownerId: userId, deletedAt: null } });
      if (!target) throw new ImportError(E.targetNotFound);

      if (options.mode === "replace") {
        const removedItems = await tx.shoppingListItem.deleteMany({ where: { projectId: target.id, partId: null } });
        await tx.shoppingListItem.deleteMany({ where: { projectId: target.id } });
        const removedParts = await tx.buildPart.deleteMany({ where: { projectId: target.id } });
        const updated = await tx.project.update({ where: { id: target.id }, data: projectData(file) });
        const r = await insertRows(tx, file, target.id, userId, new Set(), new Set());
        return {
          mode: "replace",
          projectId: target.id,
          projectName: updated.characterName,
          ...r,
          partsSkipped: 0,
          partsRemoved: removedParts.count,
          itemsSkipped: 0,
          // Part-linked items are rebuilt from the imported parts; only hand-added ones count as removed.
          itemsRemoved: removedItems.count,
          ...base,
        } satisfies ImportReport;
      }

      // Merge: add only what isn't there yet (stable IDs, deleted rows included).
      const [parts, items] = await Promise.all([
        tx.buildPart.findMany({ where: { projectId: target.id }, select: { uid: true } }),
        tx.shoppingListItem.findMany({ where: { projectId: target.id }, select: { uid: true } }),
      ]);
      const partUids = new Set(parts.map((p) => p.uid));
      const itemUids = new Set(items.map((s) => s.uid));
      const r = await insertRows(tx, file, target.id, userId, partUids, itemUids);
      if (!target.currency) {
        await tx.project.update({ where: { id: target.id }, data: { currency: file.project.currency } });
      }
      return {
        mode: "merge",
        projectId: target.id,
        projectName: target.characterName,
        ...r,
        partsSkipped: file.parts.length - r.partsCreated,
        partsRemoved: 0,
        itemsSkipped: file.shoppingItems.length - r.itemsCreated,
        itemsRemoved: 0,
        ...base,
      } satisfies ImportReport;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
