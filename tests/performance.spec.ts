import { expect, test } from "@playwright/test";
import { PNG, createProject, newUser, register } from "./helpers";

test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.0.5.1" } });

test("community images: ETag lets browsers revalidate with a 304; list images load lazily", async ({ page }) => {
  await register(page, newUser("Perf"));
  const projectId = await createProject(page, "Perf Knight");
  const up = await page.request.post(`/api/projects/${projectId}/references`, {
    multipart: { images: { name: "ref.png", mimeType: "image/png", buffer: PNG }, caption: "Front view" },
    maxRedirects: 0,
  });
  expect(up.status()).toBe(303);

  await page.goto(`/projects/${projectId}/publish`);
  await page.getByLabel("Main picture and all reference images").check();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("publish-preview")).toBeVisible();
  await page.getByRole("button", { name: /^(Publish|Save changes)$/ }).click();
  await expect(page.getByText("Published to the Community.").first()).toBeVisible();
  const publicationId = (await page.getByRole("link", { name: "View public page" }).getAttribute("href"))!.split("/")[2]!;

  const data = await (await page.request.get(`/api/community/${publicationId}`)).json();
  const thumb: string = data.images[0].thumbUrl;

  const first = await page.request.get(thumb);
  expect(first.status()).toBe(200);
  const etag = first.headers()["etag"];
  expect(etag).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
  expect(first.headers()["cache-control"]).toContain("max-age=60");

  // A browser that already has the file revalidates and gets no body.
  const same = await page.request.get(thumb, { headers: { "if-none-match": etag! } });
  expect(same.status()).toBe(304);
  expect((await same.body()).length).toBe(0);
  expect(same.headers()["etag"]).toBe(etag);
  // A different tag (changed or unknown) gets the file again.
  const other = await page.request.get(thumb, { headers: { "if-none-match": '"nope"' } });
  expect(other.status()).toBe(200);
  expect((await other.body()).length).toBeGreaterThan(0);

  // Grid images below the fold are lazy and decoded off the main thread.
  await page.goto("/community");
  const imgs = page.locator('img[src^="/api/community/images/"]');
  await expect(imgs.first()).toBeAttached();
  for (const img of await imgs.all()) {
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(img).toHaveAttribute("decoding", "async");
  }
});
