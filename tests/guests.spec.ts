import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PNG, asNewPerson, createProject, newUser } from "./helpers";

const UPLOADS = "./data/playwright-uploads";

async function startGuest(page: import("@playwright/test").Page) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  await page.goto("/login");
  await page.getByRole("button", { name: "Try without an account" }).click();
  await expect(page).toHaveURL(/\/projects\?welcome=guest/, { timeout: 30_000 });
  await expect(page.getByTestId("guest-banner")).toContainText(/deleted in (30|29) days/);
}

test("guest: private projects with encrypted images, limits, no publishing, then register keeps everything", async ({ page, browser }) => {
  await startGuest(page);
  const projectId = await createProject(page, "Guest cosplay");

  // Upload: stored encrypted on disk, but the guest sees the real image.
  const up = await page.request.post(`/api/projects/${projectId}/references`, {
    multipart: { caption: "Guest ref", images: { name: "g.png", mimeType: "image/png", buffer: PNG } },
    maxRedirects: 0,
  });
  expect(up.status()).toBe(303);
  const files = readdirSync(path.join(UPLOADS, projectId));
  expect(files.length).toBe(2);
  expect(files.every((f) => f.endsWith(".enc"))).toBe(true);
  for (const f of files) {
    const bytes = readFileSync(path.join(UPLOADS, projectId, f));
    expect(bytes.includes(Buffer.from("PNG"))).toBe(false);
  }
  await page.goto(`/projects/${projectId}/references`);
  const src = await page.getByTestId("image-card").locator("img").getAttribute("src");
  const full = await page.request.get(src!.replace(".thumb.enc", ".enc"));
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toBe("image/png");
  // Re-encoded on upload (metadata stripped), so check it's a real PNG again.
  expect(Buffer.from(await full.body()).subarray(1, 4).toString()).toBe("PNG");

  // The same session without the guest's key can't open the image.
  const cookies = await page.context().cookies();
  const keyless = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  await keyless.addCookies(cookies.filter((c) => !c.name.includes("guest_key")));
  expect((await keyless.request.get(src!)).status()).toBe(404);
  await keyless.close();

  // Publishing needs an account.
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByTestId("community-card")).toContainText("Publishing to the Community needs an account");
  await page.goto(`/projects/${projectId}/publish`);
  await expect(page).toHaveURL(/\/register\?from=guest/);

  // At most 5 projects.
  for (let i = 2; i <= 5; i++) await createProject(page, `Guest ${i}`);
  await page.goto("/projects/new");
  await page.getByLabel("Character name").fill("One too many");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("Guest accounts can have up to 5 projects")).toBeVisible();

  // Register: everything moves to the new account, images decrypted.
  const user = newUser("Converted");
  await page.goto("/register");
  await expect(page.getByText("all your guest projects and images move into it")).toBeVisible();
  await page.getByLabel("Display name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.locator("input[name=password]").fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/projects$/, { timeout: 30_000 });
  await expect(page.getByTestId("guest-banner")).toHaveCount(0);
  await expect(page.getByTestId("projects-list").locator("h2")).toHaveCount(5);
  const plain = readdirSync(path.join(UPLOADS, projectId));
  expect(plain.some((f) => f.endsWith(".enc"))).toBe(false);
  await page.goto(`/projects/${projectId}/references`);
  const newSrc = await page.getByTestId("image-card").locator("img").getAttribute("src");
  expect((await page.request.get(newSrc!)).status()).toBe(200);
  await page.goto(`/projects/${projectId}/publish`);
  await expect(page.getByRole("heading", { name: "Publish to Community" })).toBeVisible();
});

test("guest: leaving guest mode deletes everything right away", async ({ page, browser }) => {
  await startGuest(page);
  const projectId = await createProject(page, "Short visit");
  await page.goto("/account");
  await expect(page.getByText("1 of 5 projects")).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("main").getByRole("button", { name: "Leave guest mode" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  // The project is gone (another visitor, and the old browser, get nothing).
  const other = await asNewPerson(browser, "10.0.7.1");
  await other.page.goto(`/projects/${projectId}`);
  await expect(other.page).toHaveURL(/\/projects\?next=/);
  await expect(other.page.getByTestId("visitor-start")).toBeVisible();
  await other.context.close();
  await page.goto(`/projects/${projectId}`);
  await expect(page).toHaveURL(/\/projects\?next=/);
});

test("visitors land on Projects, can look around, and New project starts a guest", async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.78.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  await page.goto("/");
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
  const start = page.getByTestId("visitor-start");
  await expect(start.getByRole("button", { name: "Try without an account" })).toBeVisible();
  await expect(start).toContainText("Plan up to 5 projects as a guest");
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();

  // The public pages are one tap away, and Projects is in their header.
  await page.getByRole("banner").getByRole("link", { name: "Community" }).click();
  await expect(page).toHaveURL(/\/community$/);
  await page.getByRole("banner").getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/projects$/);

  // Creating a project: the start card first, then straight into the form as a guest.
  await page.goto("/projects/new");
  await expect(page).toHaveURL(/\/projects\?next=%2Fprojects%2Fnew$/);
  await page.getByTestId("visitor-start").getByRole("button", { name: "Try without an account" }).click();
  await expect(page).toHaveURL(/\/projects\/new$/, { timeout: 30_000 });
  await expect(page.getByLabel("Character name")).toBeVisible();
  await expect(page.getByTestId("guest-banner")).toBeVisible();

  // No horizontal scrolling on a small phone.
  await page.context().clearCookies();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/projects");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
