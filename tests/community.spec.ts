import { type Page, expect, test } from "@playwright/test";
import { PNG, asNewPerson, createProject, login, makeAdmin, newUser, register } from "./helpers";

test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.0.4.1" } });

/** Every key that may appear in a public project response, per object type. */
const ALLOWED: Record<string, string[]> = {
  root: ["id", "title", "series", "description", "tags", "creator", "publishedAt", "updatedAt", "version", "cover", "images", "snapshot"],
  creator: ["displayName"],
  image: ["id", "caption", "thumbUrl", "fullUrl"],
  snapshot: ["v", "status", "progress", "budget", "items"],
  progress: ["done", "count", "percent"],
  budget: ["currency", "budgetCents", "spentCents", "plannedCents"],
  item: ["name", "category", "status", "quantity", "estimatedEachCents", "currency", "supplier", "url"],
};

function expectOnlyAllowed(obj: Record<string, unknown>, kind: string) {
  for (const key of Object.keys(obj)) expect(ALLOWED[kind], `${kind}.${key}`).toContain(key);
}

function checkPublicShape(p: Record<string, any>) {
  expectOnlyAllowed(p, "root");
  expectOnlyAllowed(p.creator, "creator");
  for (const img of p.images) expectOnlyAllowed(img, "image");
  if (p.cover) expectOnlyAllowed(p.cover, "image");
  expectOnlyAllowed(p.snapshot, "snapshot");
  expectOnlyAllowed(p.snapshot.progress, "progress");
  if (p.snapshot.budget) expectOnlyAllowed(p.snapshot.budget, "budget");
  for (const item of p.snapshot.items) expectOnlyAllowed(item, "item");
}

/** A project with private details that must never become public. */
async function setUpPrivateProject(page: Page, name: string) {
  const projectId = await createProject(page, name);
  await page.goto(`/projects/${projectId}/edit`);
  await page.getByLabel("Notes").fill("SECRET-NOTE-do-not-publish");
  await page.getByLabel("Budget").fill("300");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.goto(`/projects/${projectId}/parts/new`);
  await page.getByLabel("Part name").fill("Foam helmet");
  await page.getByLabel("Est. cost (each)").fill("40");
  await page.getByLabel("Supplier").fill("SecretShop");
  await page.getByLabel("Link").fill("https://secret-shop.example/helmet");
  await page.getByLabel("Notes").fill("PART-NOTE-private");
  await page.getByLabel("Paid", { exact: true }).check();
  await page.getByLabel("Actual (each)").fill("37.77");
  await page.getByRole("button", { name: "Add part", exact: true }).click();
  await expect(page.getByText("Foam helmet")).toBeVisible();
  const up = await page.request.post(`/api/projects/${projectId}/references`, {
    multipart: { images: { name: "ref.png", mimeType: "image/png", buffer: PNG }, caption: "Front view" },
    maxRedirects: 0,
  });
  expect(up.status()).toBe(303);
  return projectId;
}

async function publish(page: Page, projectId: string, opts: { costs?: boolean; links?: boolean; image?: boolean } = {}) {
  await page.goto(`/projects/${projectId}/publish`);
  if (opts.costs) await page.getByLabel("Include item costs").check();
  if (opts.links) await page.getByLabel("Include shop names and links").check();
  if (opts.image) await page.locator("input[name=imageIds]").first().check();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("publish-preview")).toBeVisible();
  await page.getByRole("button", { name: /^(Publish|Update published version)$/ }).click();
  await expect(page.getByText("Published to the Community.").first()).toBeVisible();
  const href = await page.getByRole("link", { name: "View public page" }).getAttribute("href");
  return href!.split("/")[2]!;
}

test("private projects never appear publicly; publishing shows only allowed fields", async ({ page, browser }) => {
  const user = newUser("Pub");
  await register(page, user);
  const name = `Lady Maria ${Date.now()}`;
  const projectId = await setUpPrivateProject(page, name);

  // Not published yet: absent from list and search, even for the owner.
  const before = await (await page.request.get(`/api/community?q=${encodeURIComponent(name)}`)).json();
  expect(before.total).toBe(0);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByTestId("community-card")).toContainText("Private");

  // Publish with defaults (no costs, no links) and the image.
  await page.goto(`/projects/${projectId}/publish`);
  await expect(page.getByLabel("Public description")).toHaveValue(""); // notes are never prefilled
  await page.getByLabel("Public description").fill("Foam build, first attempt.");
  await page.getByLabel("Tags").fill("Bloodborne, Foam");
  await page.locator("input[name=imageIds]").first().check();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("publish-preview")).toContainText("Foam build, first attempt.");
  await expect(page.getByTestId("publish-preview")).not.toContainText("SecretShop");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published to the Community.").first()).toBeVisible();
  const pubId = (await page.getByRole("link", { name: "View public page" }).getAttribute("href"))!.split("/")[2]!;

  // A logged-out visitor sees it, with only allow-listed fields.
  const visitor = await asNewPerson(browser, "10.0.4.50");
  const res = await visitor.page.request.get(`/api/community/${pubId}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  checkPublicShape(body);
  const raw = JSON.stringify(body);
  for (const secret of ["SECRET-NOTE", "PART-NOTE", "SecretShop", "secret-shop.example", "3777", user.email, projectId, "ownerId", "paid"]) {
    expect(raw, secret).not.toContain(secret);
  }
  expect(body.creator.displayName).toBe(user.name);
  expect(body.tags).toEqual(["bloodborne", "foam"]);
  expect(body.snapshot.budget).toBeNull();
  expect(body.snapshot.items[0]).toEqual({ name: "Foam helmet", category: "other", status: "needed", quantity: 1 });
  expect(body.images).toHaveLength(1);
  expect((await visitor.page.request.get(body.images[0].thumbUrl)).status()).toBe(200);

  // Public pages work logged out; search finds it by tag and creator name.
  await visitor.page.goto(`/community/${pubId}`);
  await expect(visitor.page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(visitor.page.getByText("SECRET-NOTE")).toHaveCount(0);
  for (const q of ["foam", user.name]) {
    const found = await (await visitor.page.request.get(`/api/community?q=${encodeURIComponent(q)}`)).json();
    expect(found.items.map((i: { id: string }) => i.id), q).toContain(pubId);
    for (const card of found.items) expect(JSON.stringify(card)).not.toContain("@example.test");
  }
  await visitor.context.close();
});

test("private edits stay private until the published version is updated; options and unpublish", async ({ page, browser }) => {
  await register(page, newUser("Edit"));
  const projectId = await setUpPrivateProject(page, `Gehrman ${Date.now()}`);
  const pubId = await publish(page, projectId, { image: true });
  const visitor = await asNewPerson(browser, "10.0.4.60");
  const v1 = await (await visitor.page.request.get(`/api/community/${pubId}`)).json();
  const imageUrl = v1.images[0].fullUrl;

  // Rename the part privately: the public snapshot doesn't change.
  await page.goto(`/projects/${projectId}`);
  await page.locator("a[href*='/parts/']", { hasText: "Foam helmet" }).click();
  await page.getByLabel("Part name").fill("Renamed helmet");
  await page.getByRole("button", { name: "Save part" }).click();
  await expect(page.getByText("Renamed helmet")).toBeVisible();
  const stillOld = await (await visitor.page.request.get(`/api/community/${pubId}`)).json();
  expect(stillOld.snapshot.items[0].name).toBe("Foam helmet");
  expect(stillOld.version).toBe(1);

  // Update the published version, now opting in to costs and shop links.
  await publish(page, projectId, { costs: true, links: true, image: false });
  const v2 = await (await visitor.page.request.get(`/api/community/${pubId}`)).json();
  checkPublicShape(v2);
  expect(v2.version).toBe(2);
  expect(v2.snapshot.items[0]).toMatchObject({
    name: "Renamed helmet",
    estimatedEachCents: 4000,
    currency: "EUR",
    supplier: "SecretShop",
    url: "https://secret-shop.example/helmet",
  });
  expect(JSON.stringify(v2)).not.toContain("3777"); // actual payment never public
  expect(v2.images).toHaveLength(1); // previous selection kept by default

  // Unpublish: list, detail, page and image URLs all stop working.
  await page.goto(`/projects/${projectId}/publish`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByText("Unpublished.")).toBeVisible();
  await expect(page.getByTestId("community-card")).toContainText("Private");
  expect((await visitor.page.request.get(`/api/community/${pubId}`)).status()).toBe(404);
  expect((await visitor.page.request.get(imageUrl)).status()).toBe(404);
  expect((await visitor.page.request.get(v2.images[0].thumbUrl)).status()).toBe(404);
  const list = await (await visitor.page.request.get("/api/community")).json();
  expect(list.items.map((i: { id: string }) => i.id)).not.toContain(pubId);
  await visitor.page.goto(`/community/${pubId}`);
  await expect(visitor.page.getByText("This project isn't published")).toBeVisible();
  await visitor.context.close();
});

test("other users can't publish or unpublish someone else's project", async ({ page, browser }) => {
  await register(page, newUser("Own"));
  const projectId = await createProject(page, `Owned ${Date.now()}`);
  const pubId = await publish(page, projectId);

  const b = await asNewPerson(browser, "10.0.4.70");
  await register(b.page, newUser("Other"));
  await b.page.goto(`/projects/${projectId}/publish`);
  await expect(b.page.getByRole("heading", { name: "Not found" })).toBeVisible();
  // B can view the public page but has no owner controls.
  await b.page.goto(`/community/${pubId}`);
  await expect(b.page.getByRole("button", { name: "Unpublish" })).toHaveCount(0);
  expect((await b.page.request.get(`/api/community/${pubId}`)).status()).toBe(200);
  await b.context.close();
});

test("Copy to My Projects makes an independent private template from published data only", async ({ page, browser }) => {
  const alice = newUser("Creator");
  await register(page, alice);
  const title = `Eileen ${Date.now()}`;
  const original = await setUpPrivateProject(page, title);
  const pubId = await publish(page, original, { costs: true, image: true });
  const originalBefore = await (await page.request.get(`/api/export/projects/${original}/json`)).json();

  const b = await asNewPerson(browser, "10.0.4.80");
  await register(b.page, newUser("Copier"));
  await b.page.goto(`/community/${pubId}`);
  await b.page.getByRole("button", { name: "Copy to My Projects" }).click();
  await expect(b.page.getByText("Copied to your projects.")).toBeVisible();
  await expect(b.page.getByTestId("attribution")).toHaveText(`Based on “${title}” by ${alice.name}`);
  await expect(b.page.getByTestId("community-card")).toContainText("Private");
  const copyId = new URL(b.page.url()).pathname.split("/")[2]!;
  expect(copyId).not.toBe(original);

  // The copy: published info only, reset as a planning template, new ids.
  const copy = await (await b.page.request.get(`/api/export/projects/${copyId}/json`)).json();
  expect(copy.project.notes).toBeNull(); // no public description was written; private notes never travel
  expect(JSON.stringify(copy)).not.toMatch(/SECRET-NOTE|PART-NOTE|SecretShop|3777/);
  expect(copy.parts).toHaveLength(1);
  expect(copy.parts[0]).toMatchObject({
    name: "Foam helmet",
    status: "needed",
    estimatedCostCents: 4000,
    actualCostCents: null,
    payment: null,
    supplier: null,
    url: null,
  });
  expect(copy.parts[0].id).not.toBe(originalBefore.parts[0].id);
  // The published image, plus the published cover as the copy's main picture.
  expect(copy.references.filter((r: { kind: string }) => r.kind === "reference")).toHaveLength(1);
  expect(copy.references.filter((r: { kind: string }) => r.kind === "cover")).toHaveLength(1);
  // It's on the copier's shopping list as something to buy.
  expect(await (await b.page.request.get("/api/export/shopping")).text()).toContain("Foam helmet");
  // Not published: absent from the Community.
  const list = await (await b.page.request.get(`/api/community?q=${encodeURIComponent(title)}`)).json();
  expect(list.items.map((i: { id: string }) => i.id)).toEqual([pubId]);

  // Editing the copy changes nothing on the original or its publication.
  await b.page.goto(`/projects/${copyId}/edit`);
  await b.page.getByLabel("Character name").fill("My own Eileen");
  await b.page.getByRole("button", { name: "Save changes" }).click();
  await expect(b.page.getByRole("heading", { name: "My own Eileen", level: 1 })).toBeVisible();
  const originalAfter = await (await page.request.get(`/api/export/projects/${original}/json`)).json();
  expect(originalAfter.project).toEqual(originalBefore.project);
  expect(originalAfter.parts).toEqual(originalBefore.parts);
  const pub = await (await b.page.request.get(`/api/community/${pubId}`)).json();
  expect(pub.title).toBe(title);
  // And the copier still can't open the original.
  await b.page.goto(`/projects/${original}`);
  await expect(b.page.getByRole("heading", { name: "Not found" })).toBeVisible();
  await b.context.close();
});

test("admin can remove a Community project with a reason; others can't; owner's project stays", async ({ page, browser }) => {
  // Owner publishes.
  await register(page, newUser("Owner"));
  const title = `Rule breaker ${Date.now()}`;
  const projectId = await setUpPrivateProject(page, title);
  const pubId = await publish(page, projectId, { image: true });
  const visitor = await asNewPerson(browser, "10.0.4.90");
  const before = await (await visitor.page.request.get(`/api/community/${pubId}`)).json();

  // A regular user has no moderation page and no admin tools.
  const regular = await asNewPerson(browser, "10.0.4.91");
  await register(regular.page, newUser("Regular"));
  await regular.page.goto("/admin");
  await expect(regular.page.getByRole("heading", { name: "Not found" })).toBeVisible();
  await regular.page.goto(`/community/${pubId}`);
  await expect(regular.page.getByRole("button", { name: "Remove from Community" })).toHaveCount(0);

  // An admin (granted with the server command) removes it with a reason.
  const adminUser = newUser("Admin");
  const admin = await asNewPerson(browser, "10.0.4.92");
  await register(admin.page, adminUser);
  makeAdmin(adminUser.email);
  await admin.page.goto("/admin");
  await expect(admin.page).toHaveURL(/\/login/); // role change signs the user out
  await login(admin.page, adminUser, "/admin");
  await expect(admin.page.getByRole("heading", { name: "Moderation", level: 1 })).toBeVisible();
  const item = admin.page.getByTestId("moderation-item").filter({ hasText: title });
  await item.locator("summary").click();
  admin.page.on("dialog", (d) => d.accept());
  await item.getByRole("button", { name: "Remove from Community" }).click();
  await expect(item.getByText("Give a reason")).toBeVisible();
  await item.getByLabel("Reason (shown to the owner)").fill(`Uses copyrighted official art (${title}).`);
  await item.getByRole("button", { name: "Remove from Community" }).click();
  await expect(admin.page).toHaveURL(/\/admin\?removed=1$/);
  await expect(admin.page.getByRole("status")).toContainText("Removed from the Community.");
  await expect(item).toHaveCount(0);
  await expect(admin.page.getByText(`Uses copyrighted official art (${title}).`)).toBeVisible(); // in the log

  // Gone publicly: detail, list and image URLs.
  expect((await visitor.page.request.get(`/api/community/${pubId}`)).status()).toBe(404);
  expect((await visitor.page.request.get(before.images[0].thumbUrl)).status()).toBe(404);
  const list = await (await visitor.page.request.get(`/api/community?q=${encodeURIComponent(title)}`)).json();
  expect(list.total).toBe(0);

  // The owner sees why; their private project is untouched; they can publish again.
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByTestId("moderation-notice")).toContainText(`Uses copyrighted official art (${title}).`);
  await expect(page.getByTestId("community-card")).toContainText("Private");
  await expect(page.getByText("Foam helmet")).toBeVisible();
  const exported = await (await page.request.get(`/api/export/projects/${projectId}/json`)).json();
  expect(exported.project.notes).toBe("SECRET-NOTE-do-not-publish");
  await publish(page, projectId);
  await expect(page.getByTestId("moderation-notice")).toHaveCount(0);

  await visitor.context.close();
  await regular.context.close();
  await admin.context.close();
});
