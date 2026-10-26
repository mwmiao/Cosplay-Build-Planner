import { expect, test } from "@playwright/test";
import { extractEvent } from "../src/lib/events/caption";
import { diffFields } from "../src/lib/events/diff";
import { InstagramError, parseBusinessDiscovery, postsToEvents } from "../src/lib/events/instagram";
import { nameSimilarity, normaliseAddress, normaliseCity } from "../src/lib/events/names";
import { PNG, asNewPerson, createProject, newUser, register } from "./helpers";

test("progress timeline: chronological, editable, private until the owner shows it publicly", async ({ page, browser }) => {
  await register(page, newUser("Progress"));
  const projectId = await createProject(page, `Timeline ${Date.now()}`);
  const add = (fields: Record<string, string>) =>
    page.request.post(`/api/projects/${projectId}/references`, {
      multipart: { kind: "progress", ...fields, images: { name: "p.png", mimeType: "image/png", buffer: PNG } },
      maxRedirects: 0,
    });
  expect((await add({ takenAt: "2026-09-10", stage: "Painting", caption: "Second coat" })).status()).toBe(303);
  expect((await add({ takenAt: "2026-08-01", stage: "Base built", caption: "Foam base" })).status()).toBe(303);
  // A main picture stays separate from the timeline.
  await page.request.post(`/api/projects/${projectId}/references`, {
    multipart: { kind: "cover", images: { name: "c.png", mimeType: "image/png", buffer: PNG } },
    maxRedirects: 0,
  });

  // Same page as after createProject: reload so the uploads show (a #hash change alone doesn't reload).
  await page.goto(`/projects/${projectId}`);
  await page.reload();
  const items = page.getByTestId("timeline-item");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("Foam base"); // oldest first
  await expect(items.first()).toContainText("Base built");
  await expect(page.getByTestId("timeline")).toContainText("1 Aug 2026");

  // Edit the stage of the first photo.
  await items.first().getByText("Edit").click();
  await items.first().getByLabel("Stage").fill("Patterning");
  await items.first().getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("timeline-item").first()).toContainText("Patterning");

  // Publish: timeline off by default.
  await page.goto(`/projects/${projectId}/publish`);
  await expect(page.getByLabel("Show progress timeline")).not.toBeChecked();
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const pubId = (await page.getByRole("link", { name: "View public page" }).getAttribute("href"))!.split("/")[2]!;
  const visitor = await asNewPerson(browser, "10.0.8.1");
  const hidden = await (await visitor.page.request.get(`/api/community/${pubId}`)).json();
  expect(hidden.progress).toEqual([]);

  // Tick it: the timeline appears publicly, oldest first; switching it off again hides the images.
  await page.goto(`/projects/${projectId}/publish`);
  await page.getByLabel("Show progress timeline").check();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("publish-preview").getByTestId("timeline-item")).toHaveCount(2);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Published to the Community.").first()).toBeVisible();
  const shown = await (await visitor.page.request.get(`/api/community/${pubId}`)).json();
  expect(shown.progress.map((p: { stage: string }) => p.stage)).toEqual(["Patterning", "Painting"]);
  expect((await visitor.page.request.get(shown.progress[0].thumbUrl)).status()).toBe(200);
  await visitor.page.goto(`/community/${pubId}`);
  await expect(visitor.page.getByTestId("timeline-item")).toHaveCount(2);

  // The public main picture uses the same square as the project page.
  const box = await visitor.page.getByTestId("public-cover").boundingBox();
  expect(box && Math.abs(box.width - box.height)).toBeLessThan(2);

  await page.goto(`/projects/${projectId}/publish`);
  await page.getByLabel("Show progress timeline").uncheck();
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Published to the Community.").first()).toBeVisible();
  expect((await visitor.page.request.get(shown.progress[0].thumbUrl)).status()).toBe(404);
  await visitor.context.close();
});

test("suggest form fills in from a pasted Instagram caption", async ({ page }) => {
  await register(page, newUser("Paster"));
  await page.goto("/events/suggest");
  await page
    .getByLabel("Announcement text")
    .fill("QUIMERA ART MARKET\n🗓 29, 30 e 31 de outubro de 2099\n⏰ 11h às 20h\n📍 CCBombarda, R. de Miguel Bombarda 285, Porto\n🎟 Entrada livre");
  await page.getByRole("button", { name: "Fill in", exact: true }).click();
  await expect(page.getByText(/Filled in \d+ fields/)).toBeVisible();
  const field = (name: string) => page.locator(`[name=${name}]`);
  await expect(field("name")).toHaveValue("QUIMERA ART MARKET");
  await expect(field("startDate")).toHaveValue("2099-10-29");
  await expect(field("endDate")).toHaveValue("2099-10-31");
  await expect(field("time")).toHaveValue("11h–20h");
  await expect(field("venue")).toHaveValue("CCBombarda");
  await expect(field("address")).toHaveValue("Rua de Miguel Bombarda 285");
  await expect(field("city")).toHaveValue("Porto");
  await expect(field("tickets")).toHaveValue("Entrada livre");
});

test("event data helpers: captions, addresses, duplicates, change diffs, Instagram responses", () => {
  const ref = new Date("2026-10-07T12:00:00Z");
  expect(extractEvent("Feira\n2 a 4 Dez", ref)).toMatchObject({ start: "2026-12-02", end: "2026-12-04" });
  expect(extractEvent("Expo\nDia 21 e 22/11, 10h-18h", ref)).toMatchObject({ start: "2026-11-21", end: "2026-11-22", time: "10h–18h" });
  expect(extractEvent("Con\n15 e 16 de maio de 2027 · 4050-357 Porto", ref)).toMatchObject({ start: "2027-05-15", city: "Porto" });
  expect(extractEvent("Sem data nenhuma", ref).start).toBeUndefined();

  expect(normaliseAddress("R. de Miguel Bombarda , 285 4050 357")).toBe("Rua de Miguel Bombarda, 285 4050-357");
  expect(normaliseAddress("Av. da Liberdade 10")).toBe("Avenida da Liberdade 10");
  expect(normaliseCity("lisbon")).toBe("Lisboa");
  expect(normaliseCity("santarem")).toBe("Santarém");
  expect(nameSimilarity("XL Games 2026 · Aveiro", "XL Games Aveiro")).toBe(1);
  expect(nameSimilarity("Quimera Art Market", "Quimera Artmarket")).toBeGreaterThan(0.75);
  expect(nameSimilarity("Aniaki", "Comic Con Portugal")).toBeLessThan(0.3);

  const before = { startDate: new Date("2026-10-29T00:00:00Z"), venue: "CCBombarda", city: "Porto" };
  expect(diffFields(before, { startDate: new Date("2026-10-30T00:00:00Z"), venue: "CCBombarda", city: "Porto" })).toEqual({
    startDate: ["2026-10-29", "2026-10-30"],
  });

  const account = parseBusinessDiscovery({
    business_discovery: {
      username: "quimera.artmarket",
      media: {
        data: [
          {
            id: "1",
            timestamp: "2026-10-07T10:00:00+0000",
            permalink: "https://www.instagram.com/p/abc/",
            media_type: "IMAGE",
            media_url: "https://cdn.example/x.jpg",
            caption: "✨ QUIMERA ART MARKET ✨\n🗓 29, 30 e 31 de outubro\n📍 Rua de Miguel Bombarda 285, Porto",
          },
          { id: "2", timestamp: "2026-10-01T10:00:00+0000", caption: "Obrigado a todos! 💜" },
          { id: "3", timestamp: "2026-01-01T10:00:00+0000", caption: "Edição de 3 de janeiro" },
        ],
      },
    },
  });
  const events = postsToEvents(account, { name: "Quimera Art Market", city: "Porto", usualVenue: "CCBombarda", usualAddress: null }, ref);
  expect(events).toHaveLength(1); // posts without a date, or already over, are ignored
  expect(events[0]).toMatchObject({
    key: "instagram:1",
    start: "2026-10-29",
    end: "2026-10-31",
    address: "Rua de Miguel Bombarda 285",
    city: "Porto",
    url: "https://www.instagram.com/p/abc/",
    posterUrl: "https://cdn.example/x.jpg",
  });
  let caught: unknown;
  try {
    parseBusinessDiscovery({ error: { code: 190, message: "secret token text" } }, 400);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(InstagramError);
  expect((caught as InstagramError).kind).toBe("token");
  expect((caught as Error).message).not.toContain("secret");
});
