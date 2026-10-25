// One-time claim of projects created before accounts existed.
//
//   docker exec cosplay-planner node scripts/claim-projects.js --email you@example.com --dry-run
//   docker exec cosplay-planner node scripts/claim-projects.js --email you@example.com
//
// Assigns every UNCLAIMED project (owner = none), its shopping items, your
// general shopping items and the old app-wide default currency to the account
// with that email. Projects that already have an owner are never touched, so
// running it again changes nothing. A database snapshot is made first and the
// change runs in a single transaction. Paid amounts and FX conversions are not
// modified in any way.
import { arg, fail, flag, prisma, snapshot } from "./common";

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const dryRun = flag("dry-run");
  if (!email) fail("Pass the account to receive the projects: --email you@example.com");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) fail(`No account with the email ${email}. Register in the app first, then run this again.`);

  const projects = await prisma.project.findMany({
    where: { ownerId: null },
    select: {
      id: true,
      characterName: true,
      archivedAt: true,
      deletedAt: true,
      _count: { select: { parts: true, references: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const projectIds = projects.map((p) => p.id);
  const paidParts = await prisma.buildPart.count({ where: { projectId: { in: projectIds }, paidAt: { not: null } } });
  const items = await prisma.shoppingListItem.count({
    where: { ownerId: null, OR: [{ projectId: null }, { projectId: { in: projectIds } }] },
  });
  const legacyCurrency = await prisma.setting.findUnique({ where: { key: "defaultCurrency" } });

  console.log(`\nAccount: ${user.name} <${user.email}>`);
  console.log(`Unclaimed projects: ${projects.length}`);
  for (const p of projects) {
    const flags = [p.deletedAt ? "deleted" : null, p.archivedAt ? "archived" : null].filter(Boolean).join(", ");
    console.log(`  - ${p.characterName}${flags ? ` (${flags})` : ""}: ${p._count.parts} parts, ${p._count.references} images`);
  }
  console.log(`Paid parts (conversions kept exactly): ${paidParts}`);
  console.log(`Shopping items: ${items}`);
  if (legacyCurrency && !user.defaultCurrency) console.log(`Default currency: ${legacyCurrency.value}`);

  if (projects.length === 0 && items === 0) {
    console.log("\nNothing to claim.\n");
    return;
  }
  if (dryRun) {
    console.log("\nDry run: nothing was changed. Run again without --dry-run to claim.\n");
    return;
  }

  const backup = await snapshot("pre-claim");
  console.log(`\nBackup written: ${backup}`);

  await prisma.$transaction(async (tx) => {
    // ownerId: null in every filter: an already-claimed row can never be reassigned.
    await tx.project.updateMany({ where: { id: { in: projectIds }, ownerId: null }, data: { ownerId: user.id } });
    await tx.shoppingListItem.updateMany({
      where: { ownerId: null, OR: [{ projectId: null }, { projectId: { in: projectIds } }] },
      data: { ownerId: user.id },
    });
    if (legacyCurrency && !user.defaultCurrency) {
      await tx.user.update({ where: { id: user.id }, data: { defaultCurrency: legacyCurrency.value } });
    }
  });
  console.log(`Claimed ${projects.length} project(s) and ${items} shopping item(s) for ${user.email}.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
