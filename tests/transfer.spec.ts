import { type Page, expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../playwright.config";

const stamp = Date.now();
const NAME = `Imported Lady Maria ${stamp}`;

/** A valid export file. The paid wig's stored EUR amount (55.55) deliberately
 * does NOT equal 64.00 × rate, so any recalculation would be caught. */
function sampleFile(overrides: { name?: string; extraPart?: boolean; budgetCents?: number } = {}) {
  const parts: unknown[] = [
    {
      id: "exp-wig-1",
      name: "Silver wig",
      category: "wig",
      status: "arrived",
      currency: "USD",
      quantity: 1,
      estimatedCostCents: 5000,
      actualCostCents: 6400,
      supplier: "Etsy",
      url: "https://example.com/wig",
      notes: "Paid with PayPal",
      completedAt: null,
      createdAt: "2026-10-01T10:00:00.000Z",
      payment: {
        paidAt: "2026-10-18",
        baseCurrency: "EUR",
        baseAmountCents: 5555,
        fxRate: 0.88865,
        fxRateDate: "2026-10-16",
        fxSource: "European Central Bank (via Frankfurter)",
        fxManual: false,
      },
    },
    {
      id: "exp-fabric-1",
      name: "Hat fabric",
      category: "mystery-category",
      status: "needed",
      currency: "GBP",
      quantity: 3,
      estimatedCostCents: 1200,
      actualCostCents: null,
      supplier: null,
      url: null,
      notes: null,
      completedAt: null,
      createdAt: "2026-10-02T10:00:00.000Z",
      payment: null,
    },
  ];
  if (overrides.extraPart) {
    parts.push({ ...(parts[1] as object), id: "exp-boots-1", name: "Boots", category: "footwear" });
  }
  return {
    format: "cosplay-build-planner/project",
    schemaVersion: 1,
    exportedAt: "2026-10-20T10:00:00.000Z",
    app: { name: "Cosplay Build Planner", version: "1.2.1" },
    project: {
      id: "importtestproject0001",
      characterName: overrides.name ?? NAME,
      series: "Bloodborne",
      conventionName: null,
      deadline: "2026-12-24",
      status: "building",
      currency: "EUR",
      budgetCents: overrides.budgetCents ?? 30000,
      notes: null,
      archived: false,
    },
    parts,
    shoppingItems: [
      {
        id: "item-glue-1",
        name: "Contact cement",
        category: "tools",
        supplier: null,
        url: null,
        quantity: 1,
        currency: "EUR",
        estimatedCostCents: 500,
        notes: null,
        purchased: false,
        purchasedAt: null,
        createdAt: "2026-10-03T10:00:00.000Z",
      },
    ],
    references: [{ caption: "Front", sourceUrl: null, originalName: "front.jpg", createdAt: "2026-10-03T10:00:00.000Z" }],
  };
}

async function login(page: Page) {
  await page.goto("/projects/import");
  if (page.url().includes("/login")) {
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.goto("/projects/import");
  }
  await expect(page.getByRole("heading", { name: "Import project", level: 1 })).toBeVisible();
}

async function upload(page: Page, content: unknown) {
  await page.getByLabel("Project file (.json)").setInputFiles({
    name: "project.cosplay.json",
    mimeType: "application/json",
    buffer: Buffer.from(typeof content === "string" ? content : JSON.stringify(content)),
  });
}

test("import: create, round-trip export, merge without duplicates, replace", async ({ page }) => {
  await login(page);

  // Preview: name, counts, currencies, totals and warnings.
  await upload(page, sampleFile());
  const preview = page.getByTestId("import-preview");
  await expect(preview).toContainText(NAME);
  await expect(preview).toContainText("EUR, GBP, USD");
  await expect(preview).toContainText(/55[.,]55/);
  await expect(page.getByText(/Unknown categories will be imported as “Other”: mystery-category/)).toBeVisible();
  await expect(page.getByText(/1 reference image is listed/)).toBeVisible();

  // Create a new project.
  await page.getByRole("button", { name: "Create project" }).click();
  const report = page.getByTestId("import-report");
  await expect(report).toContainText(`Created “${NAME}”.`);
  await expect(report).toContainText("Expenses imported: 2");
  await expect(report).toContainText("Paid expenses with their conversions kept exactly: 1");
  await page.getByRole("link", { name: "Open project" }).click();
  await expect(page.getByRole("heading", { name: NAME, level: 1 })).toBeVisible();
  const projectPath = new URL(page.url()).pathname;

  // Export it again: the stored conversion comes back exactly as imported.
  const exported = await (await page.request.get(`/api/export${projectPath}/json`)).json();
  expect(exported.schemaVersion).toBe(1);
  const wig = exported.parts.find((p: { id: string }) => p.id === "exp-wig-1");
  expect(wig.payment).toEqual({
    paidAt: "2026-10-18",
    baseCurrency: "EUR",
    baseAmountCents: 5555,
    fxRate: 0.88865,
    fxRateDate: "2026-10-16",
    fxSource: "European Central Bank (via Frankfurter)",
    fxManual: false,
  });
  expect(wig.currency).toBe("USD");
  expect(wig.actualCostCents).toBe(6400);
  expect(exported.parts.find((p: { id: string }) => p.id === "exp-fabric-1").category).toBe("other");
  expect(exported.shoppingItems.map((s: { id: string }) => s.id)).toEqual(["item-glue-1"]);

  // Merge the same file into it: everything already exists, nothing is duplicated.
  await page.goto("/projects/import");
  await upload(page, sampleFile());
  await page.getByLabel("Merge into an existing project").check();
  await page.getByLabel("Project", { exact: true }).selectOption({ label: NAME });
  await expect(page.getByTestId("merge-summary")).toContainText("0 expenses will be added; 2 already exist");
  await page.getByRole("button", { name: "Merge" }).click();
  await expect(report).toContainText("Expenses imported: 0");
  await expect(report).toContainText("Expenses skipped (already present): 2");
  await expect(report).toContainText("Shopping items skipped (already present): 1");
  const afterMerge = await (await page.request.get(`/api/export${projectPath}/json`)).json();
  expect(afterMerge.parts).toHaveLength(2);

  // Replace needs the exact project name typed before it is allowed.
  await page.goto("/projects/import");
  await upload(page, sampleFile({ extraPart: true, budgetCents: 45000 }));
  await page.getByLabel("Replace an existing project").check();
  await page.getByLabel("Project", { exact: true }).selectOption({ label: NAME });
  const replace = page.getByRole("button", { name: "Replace project" });
  await expect(replace).toBeDisabled();
  await page.getByLabel(/Type the project name to confirm/).fill("wrong name");
  await expect(page.getByText("The name doesn't match the project.")).toBeVisible();
  await expect(replace).toBeDisabled();
  await page.getByLabel(/Type the project name to confirm/).fill(NAME);
  await replace.click();
  await expect(report).toContainText(`Replaced “${NAME}”.`);
  await expect(report).toContainText("Expenses removed before importing: 2");
  await expect(report).toContainText("Expenses imported: 3");
  await expect(report).toContainText(/Safety backup made first: cosplay-.*-pre-import\.db/);
  const afterReplace = await (await page.request.get(`/api/export${projectPath}/json`)).json();
  expect(afterReplace.parts).toHaveLength(3);
  expect(afterReplace.project.budgetCents).toBe(45000);
  expect(afterReplace.parts.find((p: { id: string }) => p.id === "exp-wig-1").payment.baseAmountCents).toBe(5555);
});

test("import: rejects invalid files with clear errors and changes nothing", async ({ page }) => {
  await login(page);

  const alert = page.getByTestId("import-errors");
  await upload(page, "{ not json");
  await expect(alert).toContainText("This isn't valid JSON.");

  await upload(page, { ...sampleFile(), schemaVersion: 2 });
  await expect(alert).toContainText("format version 2, made by a newer version");

  const bad = sampleFile();
  const parts = bad.parts as Record<string, unknown>[];
  parts[1]!.id = "exp-wig-1"; // duplicate ID
  parts[0]!.currency = "XYZ"; // unknown currency
  (parts[0]!.payment as Record<string, unknown>).paidAt = "2026-02-30"; // impossible date
  parts[1]!.estimatedCostCents = -100; // negative amount
  delete parts[1]!.name; // missing field
  await upload(page, bad);
  await expect(alert).toContainText("This file can't be imported");
  await expect(alert).toContainText("parts[1].id: duplicate ID");
  await expect(alert).toContainText("parts[0].currency: unknown currency code");
  await expect(alert).toContainText("parts[0].payment.paidAt: not a valid date");
  await expect(alert).toContainText("parts[1].estimatedCostCents: not a valid amount");
  await expect(alert).toContainText("parts[1].name: missing");
  await expect(page.getByTestId("import-preview")).toHaveCount(0);
});
