// Upgrade + persistence test against real containers (run by CI in phases):
//
//   CONTAINER_PHASE=legacy           image 1.2.1 (no accounts): create a project with a paid USD expense
//   CONTAINER_PHASE=register         new image on the same data volume: register the owner
//   (CI runs: docker exec … claim-projects --email ci-owner@example.test)
//   CONTAINER_PHASE=verify-upgrade   the claimed project's stored FX conversion is byte-for-byte unchanged
//   (CI replaces the container, same volume)
//   CONTAINER_PHASE=verify-replaced  same session cookie still valid; data and images still there
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const PHASE = process.env.CONTAINER_PHASE ?? "";
const STATE_DIR = process.env.STATE_DIR ?? "container-state";
const STATE = path.join(STATE_DIR, "state.json");
const SESSION = path.join(STATE_DIR, "session.json");
const OWNER = { name: "CI Owner", email: "ci-owner@example.test", password: "ci-owner-password-123" };
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type State = { projectId: string; payment: unknown; part: Record<string, unknown>; thumb?: string };
const load = (): State => JSON.parse(readFileSync(STATE, "utf8"));
const save = (s: State) => {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE, JSON.stringify(s, null, 2));
};

test.describe("legacy", () => {
  test.skip(PHASE !== "legacy", "phase");
  test("1.2.1: create a project with a paid foreign-currency expense", async ({ page }) => {
    await page.goto("/projects/new");
    await page.getByLabel("Character name").fill("Upgrade Test");
    await page.getByLabel("Base currency").selectOption("EUR");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { name: "Upgrade Test", level: 1 })).toBeVisible();
    const projectId = new URL(page.url()).pathname.split("/")[2]!;

    await page.goto(`/projects/${projectId}/parts/new`);
    await page.getByLabel("Part name").fill("USD wig");
    await page.getByLabel("Currency", { exact: true }).selectOption("USD");
    await page.getByLabel("Est. cost (each)").fill("12.50");
    await page.getByLabel("Paid", { exact: true }).check();
    await page.getByLabel("Actual (each)").fill("12.50");
    await page.getByLabel(/Amount charged in EUR/).fill("11.11");
    await page.getByRole("button", { name: "Add part", exact: true }).click();
    await expect(page.getByText("USD wig")).toBeVisible();

    const exported = await (await page.request.get(`/api/export/projects/${projectId}/json`)).json();
    const part = exported.parts.find((p: { name: string }) => p.name === "USD wig");
    expect(part.payment.baseAmountCents).toBe(1111);
    save({ projectId, payment: part.payment, part });
  });
});

test.describe("register", () => {
  test.skip(PHASE !== "register", "phase");
  test("new image: old projects are unclaimed; register the owner", async ({ page }) => {
    const { projectId } = load();
    expect((await page.request.get("/api/health")).status()).toBe(200);
    await page.goto(`/projects/${projectId}`);
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.goto("/register");
    await page.getByLabel("Display name").fill(OWNER.name);
    await page.getByLabel("Email").fill(OWNER.email);
    await page.locator("input[name=password]").fill(OWNER.password);
    await page.getByLabel("Confirm password").fill(OWNER.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    // Unclaimed projects are invisible, even to the future owner.
    await expect(page.getByText("No projects yet")).toBeVisible();
  });
});

test.describe("verify-upgrade", () => {
  test.skip(PHASE !== "verify-upgrade", "phase");
  test("after claiming: FX conversion unchanged; upload works", async ({ page }) => {
    const state = load();
    await page.goto("/login");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText("Upgrade Test")).toBeVisible();

    const exported = await (await page.request.get(`/api/export/projects/${state.projectId}/json`)).json();
    const part = exported.parts.find((p: { name: string }) => p.name === "USD wig");
    expect(part.payment).toEqual(state.payment); // never recalculated
    expect(part.actualCostCents).toBe(state.part.actualCostCents);
    expect(part.currency).toBe("USD");

    const up = await page.request.post(`/api/projects/${state.projectId}/references`, {
      multipart: { images: { name: "ref.png", mimeType: "image/png", buffer: PNG } },
      maxRedirects: 0,
    });
    expect(up.status()).toBe(303);
    await page.goto(`/projects/${state.projectId}/references`);
    const thumb = await page.locator("img[src^='/api/uploads/']").first().getAttribute("src");
    save({ ...state, thumb: thumb! });
    await page.context().storageState({ path: SESSION });
  });
});

test.describe("verify-replaced", () => {
  test.skip(PHASE !== "verify-replaced", "phase");
  test.use({ storageState: SESSION });
  test("replaced container: same session, data and images survive", async ({ page }) => {
    const state = load();
    // The old session cookie still works → the signing secret persisted on the volume.
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText("Upgrade Test")).toBeVisible();
    const exported = await (await page.request.get(`/api/export/projects/${state.projectId}/json`)).json();
    expect(exported.parts.find((p: { name: string }) => p.name === "USD wig").payment).toEqual(state.payment);
    expect((await page.request.get(state.thumb!)).status()).toBe(200);
  });
});
