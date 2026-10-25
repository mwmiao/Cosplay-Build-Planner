import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`Seed skipped: ${existing} project(s) already exist.`);
    return;
  }

  const deadline = new Date();
  deadline.setUTCDate(deadline.getUTCDate() + 60);
  const deadlineDay = new Date(
    Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate()),
  );

  const project = await prisma.project.create({
    data: {
      characterName: "Malenia, Blade of Miquella",
      series: "Elden Ring",
      conventionName: "Example Con",
      deadline: deadlineDay,
      status: "building",
      budgetCents: 45000,
      notes: "Example project — feel free to edit or delete it.",
      parts: {
        create: [
          {
            name: "Long red wig",
            category: "wig",
            status: "arrived",
            estimatedCostCents: 4500,
            actualCostCents: 5200,
            supplier: "Arda Wigs",
          },
          {
            name: "Winged helmet",
            category: "armor",
            status: "building",
            estimatedCostCents: 3000,
            actualCostCents: 2600,
            supplier: "EVA foam (local craft store)",
            notes: "Foam base, then Worbla wings.",
          },
          {
            name: "Prosthetic arm",
            category: "prop",
            status: "needed",
            estimatedCostCents: 6000,
            supplier: "Etsy",
          },
          {
            name: "Red cape fabric",
            category: "fabric",
            status: "needed",
            estimatedCostCents: 1200,
            quantity: 3,
            supplier: "Fabric store",
            notes: "3 metres",
          },
          {
            name: "Knee-high boots",
            category: "footwear",
            status: "done",
            estimatedCostCents: 5000,
            actualCostCents: 4500,
            completedAt: new Date(),
            supplier: "Amazon",
          },
          {
            name: "Hand of Malenia sword",
            category: "prop",
            status: "needed",
            estimatedCostCents: 2500,
            supplier: "EVA foam (local craft store)",
          },
        ],
      },
    },
    include: { parts: true },
  });

  for (const part of project.parts.filter((p) => p.status === "needed")) {
    await prisma.shoppingListItem.create({
      data: {
        projectId: project.id,
        partId: part.id,
        name: part.name,
        category: part.category,
        supplier: part.supplier,
        url: part.url,
        quantity: part.quantity,
        estimatedCostCents: part.estimatedCostCents,
      },
    });
  }

  await prisma.shoppingListItem.create({
    data: { name: "Contact cement", category: "tools", supplier: "Hardware store" },
  });

  console.log(`Seeded example project "${project.characterName}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
