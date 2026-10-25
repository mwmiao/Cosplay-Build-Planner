import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../playwright.config";

test("health endpoint responds without login", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("create project, add part, shopping list, pay in another currency", async ({ page }) => {
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
  await page.getByLabel("Base currency").selectOption("EUR");
  await page.getByLabel("Budget").fill("200");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: character, level: 1 })).toBeVisible();

  // Add a part that is still needed.
  await page.getByRole("link", { name: "Add part" }).first().click();
  await page.getByLabel("Part name").fill(partName);
  await page.getByLabel("Category").selectOption("armor");
  await page.getByLabel("Currency", { exact: true }).selectOption("USD");
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
  // Formatting follows the server's locale: "est $25.00", "est 25,00 US$"…
  await expect(group.getByText(/est \D*25[.,]00/)).toBeVisible();

  // Ticking it off moves the part to "ordered".
  await group.getByRole("checkbox", { name: `${partName}: purchased` }).click();
  await expect(page.getByText(partName)).toHaveCount(0);

  // CSV export works.
  const csv = await page.request.get("/api/export/shopping?show=all");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(partName);

  // Pay for it in USD, entering what the bank charged in EUR (no rate lookup needed).
  await page.goto("/projects");
  await page.getByRole("link", { name: new RegExp(character) }).click();
  await page.getByRole("link", { name: new RegExp(partName) }).click();
  await expect(page.getByRole("heading", { name: "Edit part" })).toBeVisible();
  await page.getByLabel("Paid", { exact: true }).check();
  await page.getByLabel("Actual (each)").fill("12.50");
  await page.getByLabel(/Amount charged in EUR/).fill("23.10");
  await page.getByRole("button", { name: "Save part" }).click();
  await expect(page.getByRole("heading", { name: character, level: 1 })).toBeVisible();

  // Paid total is the stored EUR amount; nothing is left as planned.
  const summary = page.getByRole("region", { name: "Budget in EUR" });
  await expect(summary.getByText(/23[.,]10/).first()).toBeVisible();
  await expect(page.getByText(/paid .*23[.,]10/)).toBeVisible();

  // The budget CSV keeps the original amount, currency, rate and that it was manual.
  const projectUrl = new URL(page.url());
  const budget = await page.request.get(`/api/export${projectUrl.pathname}/budget`);
  const text = await budget.text();
  expect(text).toContain("USD");
  expect(text).toContain("23.10");
  expect(text).toContain("manual");
  expect(text).toContain("0.924"); // implied rate 23.10 / 25.00
});

test("switch the interface to European Portuguese and back", async ({ page }) => {
  await page.goto("/settings");
  if (page.url().includes("/login")) {
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.goto("/settings");
  }
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

  // Each language is labelled in its own language.
  await page.getByText("Português (Portugal)").click();
  await expect(page.getByRole("heading", { name: "Definições", level: 1 })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link", { name: "Projetos" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Compras" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");

  // The choice is remembered on this device.
  await page.goto("/shopping");
  await expect(page.getByRole("heading", { name: "Lista de compras" })).toBeVisible();

  // Validation messages follow the language too.
  await page.goto("/projects/new");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page.getByText("Nome da personagem: campo obrigatório")).toBeVisible();

  await page.goto("/settings");
  await page.getByText("English", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
});
