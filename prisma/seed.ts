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

  const day = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - offset);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  };
  const sameCurrencyPayment = (cents: number, offset: number) => ({
    paidAt: day(offset),
    paidBaseCents: cents,
    fxRate: 1,
    fxRateDate: day(offset).toISOString().slice(0, 10),
    fxSource: "Same currency",
    fxManual: false,
  });

  const project = await prisma.project.create({
    data: {
      characterName: "Malenia, Blade of Miquella",
      series: "Elden Ring",
      conventionName: "Example Con",
      deadline: deadlineDay,
      status: "building",
      currency: "EUR",
      budgetCents: 45000,
      notes: "Example project — feel free to edit or delete it.",
      parts: {
        create: [
          {
            name: "Long red wig",
            category: "wig",
            status: "arrived",
            currency: "EUR",
            estimatedCostCents: 4500,
            actualCostCents: 5200,
            supplier: "Arda Wigs",
            ...sameCurrencyPayment(5200, 20),
          },
          {
            name: "Winged helmet",
            category: "armor",
            status: "building",
            currency: "EUR",
            estimatedCostCents: 3000,
            actualCostCents: 2600,
            supplier: "EVA foam (local craft store)",
            ...sameCurrencyPayment(2600, 12),
            notes: "Foam base, then Worbla wings.",
          },
          {
            name: "Prosthetic arm",
            category: "prop",
            status: "ordered",
            currency: "USD",
            estimatedCostCents: 6000,
            actualCostCents: 6400,
            supplier: "Etsy",
            notes: "Paid with PayPal; euro amount taken from the PayPal receipt.",
            paidAt: day(5),
            paidBaseCents: 5890,
            fxRate: 5890 / 6400,
            fxRateDate: day(5).toISOString().slice(0, 10),
            fxSource: "Manual (amount charged by bank/PayPal)",
            fxManual: true,
          },
          {
            name: "Red cape fabric",
            category: "fabric",
            status: "needed",
            currency: "GBP",
            estimatedCostCents: 1200,
            quantity: 3,
            supplier: "Fabric store",
            notes: "3 metres",
          },
          {
            name: "Knee-high boots",
            category: "footwear",
            status: "done",
            currency: "EUR",
            estimatedCostCents: 5000,
            actualCostCents: 4500,
            completedAt: new Date(),
            supplier: "Amazon",
            ...sameCurrencyPayment(4500, 30),
          },
          {
            name: "Hand of Malenia sword",
            category: "prop",
            status: "needed",
            currency: "JPY",
            estimatedCostCents: 450000,
            supplier: "Booth (Japan)",
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
        currency: part.currency,
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
