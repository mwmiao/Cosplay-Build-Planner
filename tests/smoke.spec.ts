import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../playwright.config";

test("health endpoint responds without login", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("create project, add part, see it on the shopping list", async ({ page }) => {
  const character = `Test Character ${Date.now()}`;
  const partName = `Foam pauldron ${Date.now()}`;

  // Unauthenticated visits go to the login page.
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();

  // Create a project (validation first).
  await page.goto("/projects/new");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("Character name is required")).toBeVisible();
  await page.getByLabel("Character name").fill(character);
  await page.getByLabel("Series / game").fill("Playwright Saga");
  await page.getByLabel("Budget").fill("200");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: character, level: 1 })).toBeVisible();

  // Add a part that is still needed.
  await page.getByRole("link", { name: "Add part" }).first().click();
  await page.getByLabel("Part name").fill(partName);
  await page.getByLabel("Category").selectOption("armor");
  await page.getByLabel("Est. cost (each)").fill("12.50");
  await page.getByLabel("Qty").fill("2");
  await page.getByLabel("Supplier").fill("Test Foam Co");
  await page.getByRole("button", { name: "Add part", exact: true }).click();
  await expect(page.getByRole("heading", { name: character, level: 1 })).toBeVisible();
  await expect(page.getByText(partName)).toBeVisible();

  // It shows up on the shopping list, grouped under its supplier.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shopping" }).click();
  await expect(page.getByRole("heading", { name: "Shopping list" })).toBeVisible();
  const group = page.getByRole("region", { name: "Test Foam Co" });
  await expect(group.getByText(partName)).toBeVisible();
  // Decimal separator follows the server's locale (25.00 or 25,00).
  await expect(group.getByText(/est 25[.,]00/)).toBeVisible();

  // Ticking it off moves the part to "ordered".
  await group.getByRole("checkbox", { name: `${partName}: purchased` }).click();
  await expect(page.getByText(partName)).toHaveCount(0);

  // CSV export works.
  const csv = await page.request.get("/api/export/shopping?show=all");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(partName);
});
