import { type Browser, type Page, expect, test } from "@playwright/test";
import { PNG, asNewPerson, createProject, newUser, register } from "./helpers";

// 1.9.0: saved projects, reactions, "I'm going", creator pages, search, the
// first-project guide and the form/filter polish.

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

async function publish(page: Page, name: string, tags = "") {
  const projectId = await createProject(page, name);
  await ready(page, `/projects/${projectId}/publish`);
  if (tags) await page.getByLabel("Tags").fill(tags);
  await page.getByRole("button", { name: "Preview and publish" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published to the Community.").first()).toBeVisible();
  const href = await page.getByRole("link", { name: "View public page" }).getAttribute("href");
  return { projectId, publicationId: href!.split("/")[2]! };
}

test("saved projects and reactions: accounts only, private saves, public count", async ({ browser }) => {
  const owner = await person(browser, "10.0.14.1", "SaveOwner");
  const title = `Saved build ${Date.now()}`;
  const { publicationId } = await publish(owner.page, title);

  // The owner can save but not react to their own project.
  await ready(owner.page, `/community/${publicationId}`);
  await expect(owner.page.getByRole("button", { name: /Inspiring/ })).toHaveCount(0);

  const fan = await person(browser, "10.0.14.2", "Fan");
  await ready(fan.page, `/community/${publicationId}`);
  await fan.page.getByRole("button", { name: /Inspiring/ }).click();
  await expect(fan.page.getByTestId("reaction-count")).toContainText("1 person finds this inspiring");
  await expect(fan.page.getByRole("button", { name: /Inspiring/ })).toHaveAttribute("aria-pressed", "true");
  await fan.page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(fan.page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();

  await ready(fan.page, "/community?saved=1");
  await expect(fan.page.getByTestId("community-list")).toContainText(title);
  // Someone else's Saved tab doesn't show it.
  await ready(owner.page, "/community?saved=1");
  await expect(owner.page.getByText("Nothing saved yet")).toBeVisible();

  // Visitors see the count only, and no Saved tab (asking for it shows everything).
  const visitor = await asNewPerson(browser, "10.0.14.3");
  await ready(visitor.page, `/community/${publicationId}`);
  await expect(visitor.page.getByTestId("reaction-count")).toContainText("1 person");
  await expect(visitor.page.getByRole("button", { name: /Inspiring|Save/ })).toHaveCount(0);
  await ready(visitor.page, "/community");
  await expect(visitor.page.getByRole("link", { name: "Saved", exact: true })).toHaveCount(0);

  // Both undo.
  await ready(fan.page, `/community/${publicationId}`);
  await fan.page.getByRole("button", { name: /Inspiring/ }).click();
  await expect(fan.page.getByTestId("reaction-count")).toHaveCount(0);
  await fan.page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(fan.page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
});

test("creator pages and search: display name only, tags, status filter", async ({ browser }) => {
  const owner = await person(browser, "10.0.14.4", "Creator");
  const stamp = Date.now();
  const tag = `tag${stamp}`;
  const { publicationId } = await publish(owner.page, `First ${stamp}`, tag);
  await publish(owner.page, `Second ${stamp}`);

  const visitor = await asNewPerson(browser, "10.0.14.5");
  await ready(visitor.page, `/community/${publicationId}`);
  await visitor.page.getByRole("link", { name: `by ${owner.user.name}` }).click();
  await expect(visitor.page).toHaveURL(new RegExp(`/community/creator/${publicationId}$`));
  await expect(visitor.page.getByRole("heading", { name: owner.user.name, level: 1 })).toBeVisible();
  const list = visitor.page.getByTestId("creator-projects");
  await expect(list).toContainText(`First ${stamp}`);
  await expect(list).toContainText(`Second ${stamp}`);
  expect(await visitor.page.content()).not.toContain(owner.user.email);
  await visitor.page.goto("/community/creator/not-an-id");
  await expect(visitor.page.getByRole("heading", { name: "Not found" })).toBeVisible();

  // A tag opens a search for it.
  await ready(visitor.page, `/community/${publicationId}`);
  await visitor.page.getByRole("link", { name: tag }).click();
  await expect(visitor.page).toHaveURL(new RegExp(`/community\\?q=${tag}`));
  await expect(visitor.page.getByTestId("community-list")).toContainText(`First ${stamp}`);
  await expect(visitor.page.getByTestId("community-list")).not.toContainText(`Second ${stamp}`);

  // Status filter keeps the search.
  await visitor.page.getByRole("group", { name: "Filter projects" }).getByRole("link", { name: "Finished" }).click();
  await expect(visitor.page).toHaveURL(/status=finished/);
  await expect(visitor.page).toHaveURL(new RegExp(`q=${tag}`));
  await expect(visitor.page.getByTestId("community-list")).toHaveCount(0);
});

test("I'm going: private, links your own project, shows on the project and in Events", async ({ browser }) => {
  const fan = await person(browser, "10.0.14.6", "Goer");
  const projectId = await createProject(fan.page, "Con outfit");
  await ready(fan.page, "/events");
  const first = fan.page.getByTestId("event").first().getByRole("heading").getByRole("link");
  const name = (await first.textContent())!.trim();
  await first.click();
  await expect(fan.page).toHaveURL(/\/events\/c/);
  const eventUrl = new URL(fan.page.url()).pathname;
  await fan.page.waitForLoadState("networkidle");

  const box = fan.page.getByTestId("attendance");
  await box.getByRole("button", { name: "I'm going" }).click();
  await expect(box.getByRole("button", { name: "Going" })).toHaveAttribute("aria-pressed", "true");
  await box.getByLabel("Project for this event").selectOption({ label: "Con outfit" });
  await box.getByRole("button", { name: "Save" }).click();
  await expect(box.getByLabel("Project for this event")).toHaveValue(projectId);

  await ready(fan.page, `/projects/${projectId}`);
  await expect(fan.page.getByTestId("linked-event")).toContainText(name);
  await ready(fan.page, "/events");
  await expect(fan.page.getByTestId("event").filter({ hasText: name }).getByTestId("going-chip")).toBeVisible();

  // Nobody else sees it; visitors get no button.
  const other = await person(browser, "10.0.14.7", "NotGoing");
  await ready(other.page, eventUrl);
  await expect(other.page.getByTestId("attendance").getByRole("button", { name: "I'm going" })).toBeVisible();
  await ready(other.page, "/events");
  await expect(other.page.getByTestId("going-chip")).toHaveCount(0);
  const visitor = await asNewPerson(browser, "10.0.14.8");
  await ready(visitor.page, eventUrl);
  await expect(visitor.page.getByTestId("attendance")).toHaveCount(0);

  // Undo clears the link too.
  await ready(fan.page, eventUrl);
  await fan.page.getByTestId("attendance").getByRole("button", { name: "Going" }).click();
  await expect(fan.page.getByTestId("attendance").getByRole("button", { name: "I'm going" })).toBeVisible();
  await ready(fan.page, `/projects/${projectId}`);
  await expect(fan.page.getByTestId("linked-event")).toHaveCount(0);
});

test("first project guide and short new-project form", async ({ page }) => {
  await register(page, newUser("Guide"));
  await page.goto("/projects/new");
  await expect(page.getByLabel("Budget")).toBeHidden();

  // An error inside the collapsed details opens them.
  await page.getByLabel("Character name").fill("Guided");
  await page.getByText("More details (optional)").click();
  await page.getByLabel("Start date").fill("2027-03-10");
  await page.getByLabel("Deadline").fill("2027-03-01");
  await page.getByText("More details (optional)").click();
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByLabel("Deadline")).toBeVisible();
  await page.getByLabel("Deadline").fill("2027-06-01");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/c[a-z0-9]{20,}$/, { timeout: 60_000 });

  await page.waitForLoadState("networkidle");
  const guide = page.getByTestId("project-guide");
  await expect(guide.getByRole("link", { name: "Add your first part" })).toBeVisible();
  await expect(guide.getByText("Set a deadline")).toBeVisible(); // already done: not a link
  await expect(guide.getByRole("link", { name: "Set a deadline" })).toHaveCount(0);
  await guide.getByRole("button", { name: "Skip this" }).click();
  await expect(guide).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("project-guide")).toHaveCount(0);
});

test("upload form and event filters", async ({ page }) => {
  await register(page, newUser("Polish"));
  const projectId = await createProject(page, "Upload polish");
  await ready(page, `/projects/${projectId}/references`);
  await expect(page.getByTestId("files-chosen")).toHaveText("Nothing chosen");
  await page.getByLabel("Images").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByTestId("files-chosen")).toHaveText("1 image chosen");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page).toHaveURL(/uploaded=1/, { timeout: 30_000 });
  await expect(page.getByTestId("image-card")).toHaveCount(1);

  await ready(page, "/events");
  const count = await page.getByTestId("event").count();
  await page.getByRole("group", { name: "Filter by type" }).getByRole("link", { name: "Gaming" }).click();
  await expect(page).toHaveURL(/type=gaming/);
  await expect(page.getByTestId("awaiting")).toHaveCount(0);
  const gaming = await page.getByTestId("event").count();
  expect(gaming).toBeGreaterThan(0);
  expect(gaming).toBeLessThan(count);
  await ready(page, "/events");
  const month = page.getByRole("group", { name: "Filter by month" }).getByRole("link").nth(1);
  await month.click();
  await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
  expect(await page.getByTestId("event").count()).toBeLessThan(count);

  // Nothing to scroll sideways on a small phone with the new filters.
  await page.setViewportSize({ width: 320, height: 640 });
  await ready(page, "/events");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
