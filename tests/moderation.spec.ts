import { type Browser, type Page, expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { type TestUser, asNewPerson, createProject, login, makeAdmin, newUser, register } from "./helpers";

// 1.8.0: reports, moderators, the Users page, event pages and the UX fixes.

async function ready(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function person(browser: Browser, ip: string, label: string) {
  const user = newUser(label);
  const who = await asNewPerson(browser, ip);
  await register(who.page, user);
  return { user, page: who.page };
}

async function publish(page: Page, name: string) {
  const projectId = await createProject(page, name);
  await ready(page, `/projects/${projectId}/publish`);
  await page.getByRole("button", { name: "Preview and publish" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published to the Community.").first()).toBeVisible();
  const href = await page.getByRole("link", { name: "View public page" }).getAttribute("href");
  return { projectId, publicationId: href!.split("/")[2]! };
}

async function asAdmin(browser: Browser, ip: string) {
  const { user, page } = await person(browser, ip, "ModAdmin");
  makeAdmin(user.email);
  await login(page, user, "/admin");
  await expect(page.getByRole("heading", { name: "Moderation", level: 1 })).toBeVisible();
  return { user, page };
}

const report = async (page: Page, publicationId: string, reason: string, note = "") => {
  await ready(page, `/community/${publicationId}`);
  const box = page.getByTestId("report");
  await box.getByText("Report this project").click();
  await box.getByLabel("Reason").selectOption({ label: reason });
  if (note) await box.getByLabel("Details (optional)").fill(note);
  await box.getByRole("button", { name: "Send report" }).click();
};

test("reports: accounts only, one at a time, anonymous to the owner; dismiss or remove", async ({ browser }) => {
  const owner = await person(browser, "10.0.13.1", "ReportOwner");
  const title = `Reported build ${Date.now()}`;
  const { publicationId, projectId } = await publish(owner.page, title);

  // The owner manages their project: no copying or reporting it.
  await ready(owner.page, `/community/${publicationId}`);
  await expect(owner.page.getByTestId("own-publication")).toContainText("This is your project.");
  await expect(owner.page.getByRole("link", { name: "Open my project" })).toHaveAttribute("href", `/projects/${projectId}`);
  await expect(owner.page.getByRole("button", { name: "Copy to My Projects" })).toHaveCount(0);
  await expect(owner.page.getByTestId("report")).toHaveCount(0);

  // Visitors and guests can't report.
  const visitor = await asNewPerson(browser, "10.0.13.2");
  await ready(visitor.page, `/community/${publicationId}`);
  await expect(visitor.page.getByTestId("report")).toHaveCount(0);

  const reporter = await person(browser, "10.0.13.3", "Reporter");
  await report(reporter.page, publicationId, "Spam or advertising", "Only an advert");
  await expect(reporter.page.getByText("Thanks. A moderator will look at it.")).toBeVisible();
  await report(reporter.page, publicationId, "Something else");
  await expect(reporter.page.getByText("You've already reported this project.")).toBeVisible();

  const admin = await asAdmin(browser, "10.0.13.4");
  await ready(admin.page, "/admin");
  const item = admin.page.getByTestId("report-item").filter({ hasText: title });
  await expect(item).toContainText("1 report");
  await expect(item).toContainText("Spam or advertising");
  await expect(item).toContainText("Only an advert");
  await expect(item).not.toContainText(reporter.user.name); // moderators don't see who reported

  // Dismiss: closed, still published.
  await item.getByRole("button", { name: "Dismiss reports" }).click();
  await expect(admin.page.getByText("Reports dismissed.")).toBeVisible();
  await expect(admin.page.getByTestId("report-item").filter({ hasText: title })).toHaveCount(0);
  await expect((await admin.page.request.get(`/community/${publicationId}`)).status()).toBe(200);

  // Reported again (the old one is closed), then removed: the report goes with it.
  await report(reporter.page, publicationId, "Inappropriate or offensive");
  await expect(reporter.page.getByText("Thanks. A moderator will look at it.")).toBeVisible();
  await ready(admin.page, "/admin");
  const again = admin.page.getByTestId("report-item").filter({ hasText: title });
  await again.locator("summary").click();
  await again.getByLabel("Reason (shown to the owner)").fill("Breaks the rules");
  admin.page.once("dialog", (d) => d.accept());
  await again.getByRole("button", { name: "Remove from Community" }).click();
  await expect(admin.page.getByText("Removed from the Community.")).toBeVisible();
  await expect(admin.page.getByTestId("report-item").filter({ hasText: title })).toHaveCount(0);
  await ready(owner.page, `/projects/${projectId}`);
  await expect(owner.page.getByTestId("moderation-notice")).toContainText("A moderator removed this project");
  await expect(owner.page.getByTestId("moderation-notice")).toContainText("Breaks the rules");
});

test("roles: admins grant moderator in the app; moderators only get Community moderation", async ({ browser }) => {
  const admin = await asAdmin(browser, "10.0.13.5");
  const mod = await person(browser, "10.0.13.6", "NewMod");

  // Plain users have no way in.
  for (const path of ["/admin", "/admin/users", "/admin/events"]) {
    expect((await mod.page.request.get(path)).status(), path).toBe(404);
  }

  // Found by name; emails are never listed, but an exact email finds the account.
  await ready(admin.page, `/admin/users?q=${encodeURIComponent(mod.user.email)}`);
  const row = admin.page.getByTestId("user-row").filter({ hasText: mod.user.name });
  await expect(row).toContainText("User");
  await expect(row).not.toContainText(mod.user.email);
  await ready(admin.page, "/admin/users");
  await expect(admin.page.getByTestId("user-row").filter({ hasText: admin.user.name }).getByRole("button")).toHaveCount(0); // not yourself / admins
  await ready(admin.page, `/admin/users?q=${encodeURIComponent(mod.user.name)}`);
  admin.page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Make moderator" }).click();
  await expect(admin.page.getByText(`${mod.user.name}'s role is updated.`)).toBeVisible();
  await expect(row).toContainText("Moderator");

  // Signed out by the change; after logging in they get reports, not the rest.
  await mod.page.goto("/admin");
  await expect(mod.page).toHaveURL(/\/projects/);
  await login(mod.page, mod.user, "/admin");
  await expect(mod.page.getByRole("heading", { name: "Moderation", level: 1 })).toBeVisible();
  await expect(mod.page.getByTestId("reports")).toBeVisible();
  await expect(mod.page.getByTestId("notifications")).toHaveCount(0);
  await expect(mod.page.getByRole("link", { name: "Users and roles" })).toHaveCount(0);
  for (const path of ["/admin/users", "/admin/events", "/admin/organisers"]) {
    expect((await mod.page.request.get(path)).status(), path).toBe(404);
  }

  // Taking it away works the same way.
  await ready(admin.page, `/admin/users?q=${encodeURIComponent(mod.user.name)}`);
  admin.page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Remove moderator" }).click();
  await expect(row).not.toContainText("Moderator");
  await login(mod.page, mod.user);
  await expect(mod.page).toHaveURL(/\/projects$/);
  await expect(mod.page.getByRole("link", { name: "New project" })).toBeVisible();
  expect((await mod.page.request.get("/admin", { maxRedirects: 0 })).status()).toBe(404);
});

test("event pages: approved events have a page; pending and rejected ones don't", async ({ page }) => {
  await ready(page, "/events");
  const first = page.getByTestId("event").first().getByRole("heading").getByRole("link");
  const name = (await first.textContent())!.trim();
  await first.click();
  await expect(page).toHaveURL(/\/events\/c/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByTestId("event-detail")).toBeVisible();
  await expect(page.getByRole("link", { name: "Events" }).first()).toBeVisible();

  const db = new PrismaClient({ datasourceUrl: "file:./playwright.db" });
  try {
    const base = { name: `Hidden event ${Date.now()}`, startDate: new Date("2099-03-01"), city: "Porto" };
    const pending = await db.event.create({ data: { ...base, status: "pending_review" } });
    const rejected = await db.event.create({ data: { ...base, status: "rejected" } });
    expect((await page.request.get(`/events/${pending.id}`)).status()).toBe(404);
    expect((await page.request.get(`/events/${rejected.id}`)).status()).toBe(404);
    await db.event.deleteMany({ where: { id: { in: [pending.id, rejected.id] } } });
  } finally {
    await db.$disconnect();
  }
  expect((await page.request.get("/events/not-an-id")).status()).toBe(404);
});

test("forms and project page: errors clear on edit; budget prompt; references before progress", async ({ page }) => {
  await register(page, newUser("Tidy") as TestUser);
  await ready(page, "/projects/new");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("Character name is required")).toBeVisible();
  await page.getByLabel("Character name").pressSequentially("J");
  await expect(page.getByText("Character name is required")).toHaveCount(0);

  const projectId = await createProject(page, "Tidy project");
  await ready(page, `/projects/${projectId}`);
  await expect(page.getByTestId("set-budget")).toContainText("Set a budget");
  await expect(page.getByTestId("set-budget")).toHaveAttribute("href", `/projects/${projectId}/edit`);
  await expect(page.getByText("Under budget")).toHaveCount(0);
  const y = async (id: string) => (await page.locator(id).boundingBox())!.y;
  expect(await y("#refs-title")).toBeLessThan(await y("#progress-title"));
  expect(await y("#parts-title")).toBeLessThan(await y("#refs-title"));

  // Import is labelled on phones, and the public heading in a preview isn't a second h1.
  await ready(page, "/projects");
  await expect(page.getByRole("link", { name: "Import" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New project" })).toBeVisible();
  await ready(page, `/projects/${projectId}/publish`);
  await page.getByRole("button", { name: "Preview and publish" }).click();
  await expect(page.getByTestId("publish-preview")).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
});
