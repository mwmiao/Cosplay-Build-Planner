import { expect, test } from "@playwright/test";
import { PNG, asNewPerson, createProject, lastEmailTo, login, newUser, register } from "./helpers";

test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.0.3.1" } });

test("register, log out, log in (generic errors, safe redirect), wrong invite", async ({ page }) => {
  const user = newUser("Auth");

  // Wrong invite code is refused.
  await page.goto("/register");
  await page.getByLabel("Display name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.locator("input[name=password]").fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await page.getByLabel("Invite code").fill("not-the-code");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("That invite code isn't right.")).toBeVisible();

  await register(page, user);
  await page.goto("/account");
  await expect(page.getByText(user.email)).toBeVisible();
  await page.getByRole("main").getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects$/);

  // Same message for a wrong password and an unknown email.
  await login(page, { email: user.email, password: "wrong-password-123" });
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await login(page, { email: "nobody-here@example.test", password: "wrong-password-123" });
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();

  // The intended destination is kept; external destinations are ignored.
  await login(page, user, "/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("main").getByRole("button", { name: "Log out" }).click();
  await login(page, user, "https://evil.example/");
  await expect(page).toHaveURL(/\/projects$/);
});

test("login is rate limited per account", async ({ page }) => {
  const user = newUser("Limit");
  await register(page, user);
  await page.context().clearCookies();
  for (let i = 0; i < 8; i++) {
    await login(page, { email: user.email, password: `wrong-${i}-password` });
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  }
  // Even the right password is refused while the limit is active.
  await login(page, user);
  await expect(page.getByText("Too many attempts.")).toBeVisible();
});

test("password reset by single-use email link; change display name and password", async ({ page }) => {
  const user = newUser("Reset");
  await register(page, user);
  await page.context().clearCookies();

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that email belongs to an account")).toBeVisible();
  // Unknown emails get the same answer (and no email).
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("unknown-person@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that email belongs to an account")).toBeVisible();
  expect(lastEmailTo("unknown-person@example.test")).toBeNull();

  const mail = lastEmailTo(user.email);
  expect(mail).not.toBeNull();
  const link = mail!.text.match(/https?:\/\/\S+\/reset-password\?token=\S+/)![0];
  const newPassword = `${user.password}-new`;
  await page.goto(link);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Your password was changed")).toBeVisible();

  // Single use: the same link no longer works.
  await page.goto(link);
  await page.getByLabel("New password").fill(`${newPassword}-again`);
  await page.getByLabel("Confirm password").fill(`${newPassword}-again`);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("This reset link is invalid")).toBeVisible();

  // Old password fails, new one works.
  await login(page, user);
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await login(page, { email: user.email, password: newPassword });
  await expect(page).toHaveURL(/\/projects$/);

  // Account page: display name and password changes.
  await page.goto("/account");
  await page.getByLabel("Display name").fill("Renamed Person");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Display name saved.")).toBeVisible();
  await page.getByLabel("Current password").fill("not-my-password");
  await page.getByLabel("New password").fill(`${newPassword}-2`);
  await page.getByLabel("Confirm password").fill(`${newPassword}-2`);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("The current password isn't right.")).toBeVisible();
});

test("unauthenticated requests are blocked from private pages and APIs", async ({ request }) => {
  for (const path of ["/projects", "/shopping", "/settings", "/account", "/projects/import"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(307);
    expect(res.headers().location, path).toContain("/login");
  }
  for (const path of ["/api/export/shopping", "/api/export/projects/cabc123def456ghi789jkl0mn/json", "/api/uploads/x/y.webp"]) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
});

test("user B cannot read, edit, delete, export or attach to user A's project", async ({ browser }) => {
  // User A: project with a part and an image.
  const a = await asNewPerson(browser, "10.0.3.10");
  await register(a.page, newUser("Alice"));
  const projectA = await createProject(a.page, `Alice secret ${Date.now()}`);
  await a.page.goto(`/projects/${projectA}/parts/new`);
  await a.page.getByLabel("Part name").fill("Secret wig");
  await a.page.getByLabel("Est. cost (each)").fill("40");
  await a.page.getByRole("button", { name: "Add part", exact: true }).click();
  await expect(a.page.getByText("Secret wig")).toBeVisible();
  const partHref = await a.page.getByRole("link", { name: /Secret wig/ }).getAttribute("href");
  const partA = partHref!.split("/")[4]!;
  const up = await a.page.request.post(`/api/projects/${projectA}/references`, {
    multipart: { images: { name: "ref.png", mimeType: "image/png", buffer: PNG } },
    maxRedirects: 0,
  });
  expect(up.status()).toBe(303);
  await a.page.goto(`/projects/${projectA}/references`);
  const thumb = await a.page.locator("img[src^='/api/uploads/']").first().getAttribute("src");
  expect((await a.page.request.get(thumb!)).status()).toBe(200);

  // User B, signed in, knowing all of A's ids.
  const b = await asNewPerson(browser, "10.0.3.11");
  await register(b.page, newUser("Bob"));
  await expect(b.page.getByText("No projects yet")).toBeVisible();
  for (const path of [
    `/projects/${projectA}`,
    `/projects/${projectA}/edit`,
    `/projects/${projectA}/references`,
    `/projects/${projectA}/parts/new`,
    `/projects/${projectA}/parts/${partA}/edit`,
  ]) {
    await b.page.goto(path);
    await expect(b.page.getByRole("heading", { name: "Not found" }), path).toBeVisible();
  }
  for (const path of [`/api/export/projects/${projectA}/json`, `/api/export/projects/${projectA}/budget`, thumb!]) {
    expect((await b.page.request.get(path)).status(), path).toBe(404);
  }
  const attach = await b.page.request.post(`/api/projects/${projectA}/references`, {
    multipart: { images: { name: "x.png", mimeType: "image/png", buffer: PNG } },
    maxRedirects: 0,
  });
  expect(attach.status()).toBe(404);
  const csv = await (await b.page.request.get("/api/export/shopping?show=all")).text();
  expect(csv).not.toContain("Secret wig");

  // Tampered server action: B submits "delete project" on their own project,
  // with the bound project id swapped for A's. The server must refuse.
  const projectB = await createProject(b.page, `Bob own ${Date.now()}`);
  await b.page.route("**/*", async (route) => {
    const req = route.request();
    const body = req.postData();
    if (req.method() === "POST" && body?.includes(projectB)) {
      await route.continue({ postData: body.split(projectB).join(projectA) });
    } else {
      await route.continue();
    }
  });
  await b.page.goto(`/projects/${projectB}/edit`);
  b.page.once("dialog", (d) => d.accept());
  await b.page.getByRole("button", { name: "Delete project" }).click();
  await expect(b.page.getByRole("heading", { name: "Not found" })).toBeVisible();
  await b.page.unroute("**/*");

  // A's project, part and image are untouched.
  await a.page.goto(`/projects/${projectA}`);
  await expect(a.page.getByText("Secret wig")).toBeVisible();
  expect((await a.page.request.get(thumb!)).status()).toBe(200);

  await a.context.close();
  await b.context.close();
});

test("imports are owned by the importer, even when the file names another user's project", async ({ browser }) => {
  const a = await asNewPerson(browser, "10.0.3.20");
  await register(a.page, newUser("Owner"));
  const projectA = await createProject(a.page, `Owner project ${Date.now()}`);
  const exported = await (await a.page.request.get(`/api/export/projects/${projectA}/json`)).json();
  expect(JSON.stringify(exported)).not.toMatch(/example\.test|ownerId|password|session/i);

  const b = await asNewPerson(browser, "10.0.3.21");
  await register(b.page, newUser("Importer"));
  await b.page.goto("/projects/import");
  await b.page.getByLabel("Project file (.json)").setInputFiles({
    name: "a.cosplay.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  // A's project is not suggested and can't be picked as a merge target.
  await expect(b.page.getByText(/came from/)).toHaveCount(0);
  await b.page.getByLabel("Merge into an existing project").check();
  await expect(b.page.getByLabel("Project", { exact: true }).locator(`option[value="${projectA}"]`)).toHaveCount(0);
  await b.page.getByLabel("Create a new project").check();
  await b.page.getByRole("button", { name: "Create project" }).click();
  await b.page.getByRole("link", { name: "Open project" }).click();
  await expect(b.page).toHaveURL(/\/projects\/c[a-z0-9]{20,}$/);
  const projectB = new URL(b.page.url()).pathname.split("/")[2];
  expect(projectB).not.toBe(projectA);

  // A still has exactly one project; B's copy isn't visible to A.
  await a.page.goto("/projects");
  await expect(a.page.locator("a[href^='/projects/c']")).toHaveCount(1);
  await a.page.goto(`/projects/${projectB}`);
  await expect(a.page.getByRole("heading", { name: "Not found" })).toBeVisible();

  await a.context.close();
  await b.context.close();
});
