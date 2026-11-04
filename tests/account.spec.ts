import { existsSync } from "node:fs";
import path from "node:path";
import { type Browser, type Page, expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PNG, asNewPerson, createProject, login, makeAdmin, newUser, register } from "./helpers";

// Download my data / delete my account.

const UPLOADS = path.resolve("./data/playwright-uploads");

async function ready(page: Page, p: string) {
  await page.goto(p);
  await page.waitForLoadState("networkidle");
}

/** A person with a project that has a part, an image and a published page. */
async function personWithProject(browser: Browser, ip: string, label: string) {
  const user = newUser(label);
  const who = await asNewPerson(browser, ip);
  await register(who.page, user);
  const projectId = await createProject(who.page, `${label} Knight`);
  await who.page.goto(`/projects/${projectId}/parts/new`);
  await who.page.getByLabel("Part name").fill("Helmet");
  await who.page.getByLabel("Est. cost (each)").fill("40");
  await who.page.getByRole("button", { name: "Add part", exact: true }).click();
  await expect(who.page.getByText("Helmet").first()).toBeVisible();
  const up = await who.page.request.post(`/api/projects/${projectId}/references`, {
    multipart: { images: { name: "ref.png", mimeType: "image/png", buffer: PNG }, caption: "Front" },
    maxRedirects: 0,
  });
  expect(up.status()).toBe(303);
  await ready(who.page, `/projects/${projectId}/publish`);
  await who.page.getByRole("button", { name: "Preview and publish" }).click();
  await who.page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(who.page.getByText("Published to the Community.").first()).toBeVisible();
  const href = await who.page.getByRole("link", { name: "View public page" }).getAttribute("href");
  return { user, ...who, projectId, publicationId: href!.split("/")[2]! };
}

test("export: signed-in accounts get all their data; visitors don't", async ({ browser }) => {
  const a = await personWithProject(browser, "10.0.20.1", "Export");
  const res = await a.page.request.get("/api/export/account");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("cosplay-build-planner-account-");
  const data = await res.json();
  expect(data.format).toBe("cosplay-build-planner/account");
  expect(data.profile).toMatchObject({ displayName: a.user.name, email: a.user.email });
  expect(data.projects).toHaveLength(1);
  expect(data.projects[0].project.characterName).toBe("Export Knight");
  expect(data.projects[0].parts[0]).toMatchObject({ name: "Helmet", estimatedCostCents: 4000 });
  expect(JSON.stringify(data)).not.toContain("password");

  const visitor = await asNewPerson(browser, "10.0.20.2");
  expect((await visitor.page.request.get("/api/export/account")).status()).toBe(401);
  await Promise.all([a.context.close(), visitor.context.close()]);
});

test("delete account: needs the password, removes everything, leaves other people's data alone", async ({ browser }) => {
  const doomed = await personWithProject(browser, "10.0.20.3", "Doomed");
  const bystander = await personWithProject(browser, "10.0.20.4", "Bystander");
  const db = new PrismaClient({ datasourceUrl: "file:./playwright.db" });
  try {
    const image = await db.referenceImage.findFirstOrThrow({ where: { projectId: doomed.projectId } });
    expect(existsSync(path.join(UPLOADS, doomed.projectId))).toBe(true);

    // Wrong password: nothing happens.
    await ready(doomed.page, "/account");
    const section = doomed.page.getByTestId("delete-account");
    await section.getByLabel("Your password, to confirm").fill("not-the-password-123");
    doomed.page.once("dialog", (d) => d.accept());
    await section.getByRole("button", { name: "Delete my account" }).click();
    await expect(section.getByText("The current password isn't right.")).toBeVisible();
    expect(await db.user.count({ where: { email: doomed.user.email } })).toBe(1);

    // Right password: gone.
    await section.getByLabel("Your password, to confirm").fill(doomed.user.password);
    doomed.page.once("dialog", (d) => d.accept());
    await section.getByRole("button", { name: "Delete my account" }).click();
    await expect(doomed.page).toHaveURL(/\/projects\?deleted=1$/);
    await expect(doomed.page.getByText("Your account and its data were deleted.")).toBeVisible();

    expect(await db.user.count({ where: { email: doomed.user.email } })).toBe(0);
    expect(await db.project.count({ where: { id: doomed.projectId } })).toBe(0);
    expect(await db.buildPart.count({ where: { projectId: doomed.projectId } })).toBe(0);
    expect(await db.referenceImage.count({ where: { id: image.id } })).toBe(0);
    expect(await db.publication.count({ where: { id: doomed.publicationId } })).toBe(0);
    expect(existsSync(path.join(UPLOADS, doomed.projectId))).toBe(false);

    // Signed out, can't log back in, and the public page is gone.
    expect((await doomed.page.request.get("/api/export/account")).status()).toBe(401);
    await login(doomed.page, doomed.user);
    await expect(doomed.page.getByText("Email or password is incorrect.")).toBeVisible();
    await doomed.page.goto(`/community/${doomed.publicationId}`);
    await expect(doomed.page.getByRole("heading", { name: "Not available" })).toBeVisible();

    // Someone else's account is untouched.
    expect(await db.project.count({ where: { id: bystander.projectId } })).toBe(1);
    expect(await db.publication.count({ where: { id: bystander.publicationId } })).toBe(1);
    expect(existsSync(path.join(UPLOADS, bystander.projectId))).toBe(true);
    await ready(bystander.page, `/community/${bystander.publicationId}`);
    await expect(bystander.page.getByRole("heading", { name: "Bystander Knight", level: 1 })).toBeVisible();
  } finally {
    await db.$disconnect();
    await Promise.all([doomed.context.close(), bystander.context.close()]);
  }
});

test("delete account: admins can't delete themselves here", async ({ browser }) => {
  const user = newUser("DelAdmin");
  const who = await asNewPerson(browser, "10.0.20.5");
  await register(who.page, user);
  makeAdmin(user.email);
  await login(who.page, user, "/account");
  const section = who.page.getByTestId("delete-account");
  await expect(section).toContainText("Admin accounts can't be deleted here");
  await expect(section.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
  await who.context.close();
});

test("delete account: guests have no delete form", async ({ browser }) => {
  const guest = await asNewPerson(browser, "10.0.20.6");
  await guest.page.goto("/login");
  await guest.page.getByRole("button", { name: "Try without an account" }).click();
  await expect(guest.page).toHaveURL(/\/projects\?welcome=guest/, { timeout: 30_000 });
  await ready(guest.page, "/account");
  await expect(guest.page.getByTestId("delete-account")).toHaveCount(0);
  expect((await guest.page.request.get("/api/export/account")).status()).toBe(403);
  await guest.context.close();
});
