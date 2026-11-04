import "server-only";
import type { Dict } from "@/i18n";
import pkg from "../../package.json";
import { removePublicationFolder } from "./community/images";
import { db } from "./db";
import type { MoneyContext } from "./projects";
import { buildProjectExport } from "./transfer/export";
import { removeProjectFiles } from "./uploads";

/**
 * Everything the account owns, as one JSON file: the profile, each project in
 * the same format as the single-project export (re-importable one by one), and
 * shopping-list items that aren't tied to a project. Image files are not included.
 */
export async function buildAccountExport(userId: string, ctx: MoneyContext, t: Dict) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, defaultCurrency: true, createdAt: true } });
  if (!user) return null;
  const projectIds = await db.project.findMany({
    where: { ownerId: userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const projects = [];
  for (const { id } of projectIds) {
    const data = await buildProjectExport(id, userId, ctx, t);
    if (data) projects.push(data);
  }
  const general = await db.shoppingListItem.findMany({
    where: { ownerId: userId, projectId: null, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return {
    format: "cosplay-build-planner/account",
    exportedAt: new Date().toISOString(),
    app: { name: "Cosplay Build Planner", version: process.env.APP_VERSION ?? pkg.version },
    profile: {
      displayName: user.name,
      email: user.email,
      defaultCurrency: user.defaultCurrency,
      createdAt: user.createdAt.toISOString(),
    },
    projects,
    shoppingItems: general.map((s) => ({
      name: s.name,
      category: s.category,
      supplier: s.supplier,
      url: s.url,
      quantity: s.quantity,
      currency: s.currency,
      estimatedCostCents: s.estimatedCostCents,
      notes: s.notes,
      purchased: s.purchased,
      purchasedAt: s.purchasedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

/**
 * Permanently removes an account and everything it owns: projects (including
 * archived and deleted ones) with their images, publications, shopping items,
 * sessions, reports, saves, reactions and event plans. Records that other people
 * rely on keep no link to the person: role-change history keeps only a neutral
 * name, and events they suggested lose the "suggested by" id.
 */
export async function deleteAccountData(userId: string): Promise<void> {
  const [user, projects, publications] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
    db.project.findMany({ where: { ownerId: userId }, select: { id: true } }),
    db.publication.findMany({ where: { ownerId: userId }, select: { id: true } }),
  ]);
  if (!user) return;
  await db.$transaction([
    db.shoppingListItem.deleteMany({ where: { ownerId: userId } }),
    db.project.deleteMany({ where: { ownerId: userId } }), // parts, images, publication, attendance follow
    db.event.updateMany({ where: { createdBy: userId }, data: { createdBy: null } }),
    db.roleChange.updateMany({ where: { targetId: userId }, data: { targetName: "Deleted account" } }),
    db.roleChange.updateMany({ where: { actorId: userId }, data: { actorName: "Deleted account" } }),
    db.verification.deleteMany({ where: { OR: [{ value: userId }, { identifier: user.email }] } }),
    db.user.delete({ where: { id: userId } }), // sessions, sign-in methods, reports, saves, reactions follow
  ]);
  for (const p of projects) await removeProjectFiles(p.id);
  for (const p of publications) await removePublicationFolder(p.id);
}
