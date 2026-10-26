import { type Page, expect, test } from "@playwright/test";
import { PNG, asNewPerson, createProject, makeAdmin, newUser, register } from "./helpers";

/** Uploads images through the real upload route (same as the forms). */
async function upload(page: Page, projectId: string, fields: Record<string, string>, count = 1) {
  const res = await page.request.post(`/api/projects/${projectId}/references`, {
    multipart: {
      ...fields,
      ...Object.fromEntries(
        Array.from({ length: count }, (_, i) => [`images${i ? `_${i}` : ""}`, { name: `img${i}.png`, mimeType: "image/png", buffer: PNG }]),
      ),
    },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(303);
  return res.headers().location ?? "";
}

/** Part edit page URL of the first part named `name`. */
async function addPart(page: Page, projectId: string, name: string) {
  await page.goto(`/projects/${projectId}/parts/new`);
  await page.getByLabel("Part name").fill(name);
  await page.getByRole("button", { name: "Add part", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
}

test("start date: validation, shown on the project, sorting and grid/list views", async ({ page }) => {
  await register(page, newUser("Dates"));
  await page.goto("/projects/new");
  await page.getByLabel("Character name").fill("Zelda");
  await page.getByLabel("Start date").fill("2027-03-10");
  await page.getByLabel("Deadline").fill("2027-03-01");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("The deadline can't be before the start date.")).toBeVisible();
  await page.getByLabel("Deadline").fill("2027-06-01");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Zelda", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Summary")).toContainText("10 Mar 2027");
  await expect(page.getByLabel("Summary")).toContainText(/Starts in \d+ days/);

  await createProject(page, "Aloy");
  await page.goto("/projects");
  const names = () => page.getByTestId("projects-list").locator("h2").allTextContents();
  await page.getByTestId("sort-select").selectOption("name");
  await expect(page).toHaveURL(/sort=name/);
  expect(await names()).toEqual(["Aloy", "Zelda"]);

  await page.getByRole("button", { name: "Grid" }).click();
  await expect(page.getByTestId("projects-list")).toHaveAttribute("data-layout", "grid");
  // The choice is remembered without the URL.
  await page.goto("/projects");
  await expect(page.getByTestId("projects-list")).toHaveAttribute("data-layout", "grid");
  expect(await names()).toEqual(["Aloy", "Zelda"]);
});

test("main picture is uploaded on purpose; references never replace it", async ({ page }) => {
  await register(page, newUser("Cover"));
  const projectId = await createProject(page, "Cover test");

  // A reference image no longer becomes the project's picture.
  await upload(page, projectId, { caption: "Ref" });
  await page.goto("/projects");
  await expect(page.getByTestId("projects-list").locator("img")).toHaveCount(0);

  await page.goto(`/projects/${projectId}/edit`);
  await page.getByLabel("Image").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Upload main picture" }).click();
  await expect(page.getByText("Main picture saved.")).toBeVisible();
  await expect(page.getByTestId("cover-preview")).toBeVisible();

  await page.goto("/projects");
  await expect(page.getByTestId("projects-list").locator("img")).toHaveCount(1);
  await page.goto(`/projects/${projectId}`);
  await page.getByTestId("project-cover").click();
  await expect(page.getByTestId("lightbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("lightbox")).toHaveCount(0);

  // Replacing keeps exactly one; removing clears it.
  await upload(page, projectId, { kind: "cover" });
  const exported = await (await page.request.get(`/api/export/projects/${projectId}/json`)).json();
  expect(exported.references.filter((r: { kind: string }) => r.kind === "cover")).toHaveLength(1);
  await page.goto(`/projects/${projectId}/edit`);
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove main picture" }).click();
  await expect(page.getByTestId("cover-preview")).toHaveCount(0);
});

test("part photos, in-app viewer and manual order for parts and images", async ({ page, browser }) => {
  await register(page, newUser("Parts"));
  const projectId = await createProject(page, "Order test");
  for (const name of ["Wig", "Armour", "Sword"]) await addPart(page, projectId, name);

  // Reorder parts: move "Sword" to the top with the arrow buttons.
  await page.goto(`/projects/${projectId}`);
  await page.getByRole("link", { name: "Reorder" }).click();
  await page.getByRole("button", { name: "Move up: Sword" }).click();
  await page.getByRole("button", { name: "Move up: Sword" }).click();
  await expect(page.getByText("Order saved")).toBeVisible();
  await page.goto(`/projects/${projectId}`);
  const partNames = await page.locator("#parts li .font-medium").allTextContents();
  expect(partNames.map((n) => n.trim())).toEqual(["Sword", "Wig", "Armour"]);

  // Photos for one part.
  await page.locator("#parts").getByRole("link", { name: /Wig/ }).first().click();
  await page.waitForURL(/\/parts\/c[a-z0-9]+\/edit/);
  const editUrl = page.url().split("#")[0]!;
  const partId = editUrl.split("/parts/")[1]!.split("/")[0]!;
  const location = await upload(page, projectId, { kind: "part", partId, caption: "First" });
  expect(location).toContain(`/parts/${partId}/edit`);
  await upload(page, projectId, { kind: "part", partId, caption: "Second" });
  await page.goto(editUrl);
  const cards = page.getByTestId("image-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("First");

  // Viewer opens inside the app and browses between photos.
  await cards.first().getByRole("button", { name: /View image/ }).click();
  const viewer = page.getByTestId("lightbox");
  await expect(viewer).toContainText("First");
  await expect(viewer).toContainText("1 of 2");
  await page.keyboard.press("ArrowRight");
  await expect(viewer).toContainText("Second");
  await page.keyboard.press("Escape");

  // Reorder photos.
  await page.getByRole("link", { name: "Reorder" }).click();
  await page.getByRole("button", { name: "Move up: Second" }).click();
  await expect(page.getByText("Order saved")).toBeVisible();
  await page.goto(editUrl);
  await expect(page.getByTestId("image-card").first()).toContainText("Second");

  // The part's thumbnail shows in the parts list; part photos aren't references.
  await page.goto(`/projects/${projectId}`);
  await expect(page.locator("#parts img")).toHaveCount(1);
  await page.goto(`/projects/${projectId}/references`);
  await expect(page.getByTestId("image-card")).toHaveCount(0);

  // Another user can't attach photos to this part.
  const other = await asNewPerson(browser, "10.0.5.10");
  await register(other.page, newUser("Other"));
  const res = await other.page.request.post(`/api/projects/${projectId}/references`, {
    multipart: { kind: "part", partId, images: { name: "x.png", mimeType: "image/png", buffer: PNG } },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(404);
  await other.context.close();
});

test("references can be grouped, filtered and reordered", async ({ page }) => {
  await register(page, newUser("Refs"));
  const projectId = await createProject(page, "Groups test");
  await upload(page, projectId, { caption: "Helmet front", groupName: "Armour" });
  await upload(page, projectId, { caption: "Wig colour" });
  await upload(page, projectId, { caption: "Helmet side", groupName: "Armour" });

  await page.goto(`/projects/${projectId}/references`);
  await expect(page.getByRole("heading", { name: /Armour/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Ungrouped/ })).toBeVisible();
  await page.getByRole("link", { name: "Armour (2)" }).click();
  await expect(page.getByTestId("image-card")).toHaveCount(2);

  // Reorder inside the group.
  await page.getByRole("link", { name: "Reorder" }).click();
  await page.getByRole("button", { name: "Move up: Helmet side" }).click();
  await expect(page.getByText("Order saved")).toBeVisible();
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page.getByTestId("image-card").first()).toContainText("Helmet side");

  // Move an image to a group from its edit form.
  await page.goto(`/projects/${projectId}/references`);
  const wig = page.getByTestId("image-card").filter({ hasText: "Wig colour" });
  await wig.getByText("Edit").click();
  await wig.getByLabel("Group").fill("Wig");
  await wig.getByRole("button", { name: "Save" }).click();
  // The card moves into its new group's section.
  await expect(page.getByRole("heading", { name: /^Wig/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Wig (1)" })).toBeVisible();
});

test("Events: public list of Portuguese events; only admins add, edit and delete", async ({ page, browser }) => {
  // Visitors can read it without an account.
  const visitor = await asNewPerson(browser, "10.0.5.20");
  await visitor.page.goto("/events");
  await expect(visitor.page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await visitor.page.getByRole("link", { name: "Past" }).click();
  await expect(visitor.page.getByTestId("event").filter({ hasText: "Comic Con Portugal" })).toBeVisible();
  await expect(visitor.page.getByRole("link", { name: "Add event" })).toHaveCount(0);
  await visitor.context.close();

  // A regular user can't reach the admin form.
  await register(page, newUser("Fan"));
  await page.goto("/admin/events/new");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();

  const adminUser = newUser("EventAdmin");
  const admin = await asNewPerson(browser, "10.0.5.21");
  await register(admin.page, adminUser);
  makeAdmin(adminUser.email);
  await admin.page.goto("/login?next=%2Fevents");
  await admin.page.getByLabel("Email").fill(adminUser.email);
  await admin.page.getByLabel("Password").fill(adminUser.password);
  await admin.page.getByRole("button", { name: "Log in" }).click();
  await admin.page.getByRole("link", { name: "Add event" }).click();
  const name = `BragaKossai ${Date.now()}`;
  await admin.page.getByLabel("Name").fill(name);
  await admin.page.getByLabel("Start date").fill("2099-05-10");
  await admin.page.getByLabel("End date").fill("2099-05-09");
  await admin.page.getByLabel("City").fill("Braga");
  await admin.page.getByRole("button", { name: "Save event" }).click();
  await expect(admin.page.getByText("The end date can't be before the start date.")).toBeVisible();
  await admin.page.getByLabel("End date").fill("2099-05-11");
  await admin.page.getByRole("button", { name: "Save event" }).click();
  const card = admin.page.getByTestId("event").filter({ hasText: name });
  await expect(card).toContainText("Braga");

  // Everyone sees it; then the admin deletes it.
  await page.goto("/events?city=Braga");
  await expect(page.getByTestId("event").filter({ hasText: name })).toBeVisible();
  await card.getByRole("link", { name: "Edit" }).click();
  admin.page.on("dialog", (d) => d.accept());
  await admin.page.getByRole("button", { name: "Delete event" }).click();
  await expect(admin.page.getByTestId("event").filter({ hasText: name })).toHaveCount(0);
  await admin.context.close();
});
