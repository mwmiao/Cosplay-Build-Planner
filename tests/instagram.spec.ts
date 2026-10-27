import { readFileSync } from "node:fs";
import { type Page, expect, test } from "@playwright/test";
import { detectEvent } from "../src/lib/instagram/detect";
import { parseFeed, shortcodeFromUrl } from "../src/lib/instagram/feed";
import { fetchFeedText, rssBridgeProvider } from "../src/lib/instagram/providers";
import { FeedError } from "../src/lib/instagram/types";
import { asNewPerson, login, makeAdmin, newUser, register } from "./helpers";

const MOCK = "http://127.0.0.1:3199";
const fixture = (name: string) => readFileSync(`tests/fixtures/instagram/${name}`, "utf8");

test("feed parsing, provider URLs and failed fetches (unit)", async () => {
  // Atom (RSS-Bridge's default) and RSS 2.0.
  const atom = parseFeed(fixture("quimera_test.xml"));
  expect(atom).toHaveLength(2);
  expect(atom[0]).toMatchObject({
    externalId: "QmTest001",
    permalink: "https://www.instagram.com/p/QmTest001/",
    imageUrl: "https://example.invalid/qm001.jpg",
  });
  expect(atom[0]!.caption).toContain("📍 CCBombarda, Rua de Miguel Bombarda 285, Porto");
  expect(atom[0]!.publishedAt?.toISOString()).toBe("2099-10-07T10:00:00.000Z");
  expect(atom[0]!.raw).toContain("<entry>");
  const rss = parseFeed(fixture("meetup_rss.xml"));
  expect(rss[0]).toMatchObject({ externalId: "MeetRss01", imageUrl: "https://example.invalid/meet.jpg", title: "Cosplay meetup no Jardim" });
  expect(() => parseFeed("<html><body>error</body></html>")).toThrow();
  expect(shortcodeFromUrl("https://www.instagram.com/someone/reel/AbC_9/")).toBe("AbC_9");

  // Provider URL generation.
  process.env.RSS_BRIDGE_BASE_URL = "http://rss-bridge:80/";
  const url = new URL(rssBridgeProvider.buildFeedUrl("quimera.artmarket")!);
  expect(url.origin).toBe("http://rss-bridge");
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ action: "display", bridge: "Instagram", context: "Username", u: "quimera.artmarket", format: "Atom" });
  delete process.env.RSS_BRIDGE_BASE_URL;
  expect(rssBridgeProvider.buildFeedUrl("x")).toBeNull();
  await expect(rssBridgeProvider.fetchRecentPosts({ username: "x", feedUrl: null })).rejects.toMatchObject({ kind: "notConfigured" });

  // Failed fetches are reported, not swallowed.
  await expect(fetchFeedText("http://127.0.0.1:9/feed", { useCache: false })).rejects.toBeInstanceOf(FeedError);
  await expect(fetchFeedText("http://127.0.0.1:9/feed", { useCache: false })).rejects.toMatchObject({ kind: "unreachable" });
  await expect(fetchFeedText(`${MOCK}/?u=broken_feed`, { useCache: false })).rejects.toMatchObject({ kind: "http", status: 500 });
  await expect(
    rssBridgeProvider.fetchRecentPosts({ username: "not_a_feed", feedUrl: `${MOCK}/?u=not_a_feed` }, { fresh: true }),
  ).rejects.toMatchObject({ kind: "invalid" });

  // Event detection.
  const ref = new Date("2099-10-07T10:00:00Z");
  const high = detectEvent(atom[0]!.caption!, ref);
  expect(high.level).toBe("high");
  expect(high.fields).toMatchObject({ start: "2099-10-29", end: "2099-10-31", venue: "CCBombarda", city: "Porto", time: "11h–20h" });
  expect(detectEvent(atom[1]!.caption!, ref).level).toBe("none");
  const possible = detectEvent(rss[0]!.caption!, ref); // cosplay meetup, place, no date
  expect(possible.level).toBe("low");
  expect(possible.fields.start).toBeUndefined();
});

async function asAdmin(browser: import("@playwright/test").Browser, ip: string) {
  const user = newUser("IgAdmin");
  const admin = await asNewPerson(browser, ip);
  await register(admin.page, user);
  makeAdmin(user.email);
  await login(admin.page, user, "/admin/organisers");
  await expect(admin.page.getByRole("heading", { name: "Organisers", level: 1 })).toBeVisible();
  return admin;
}

/** Admin pages are heavy on the dev server: wait until they're interactive before using forms. */
async function ready(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function addSource(page: Page, username: string) {
  await ready(page, "/admin/organisers");
  await page.getByText("Add Instagram source").first().click();
  await page.getByLabel("Instagram username").fill(`@${username}`);
  await page.getByRole("button", { name: "Add Instagram source" }).click();
  const source = page.getByTestId("instagram-source").filter({ hasText: `@${username}` });
  await expect(source).toBeVisible();
  return source;
}

const postsFor = async (page: Page, permalink: string) => {
  await ready(page, "/admin/events");
  return page.getByTestId("pending-post").filter({ has: page.locator(`a[href="${permalink}"]`) });
};

test("monitor: test feed stores nothing; check creates a pending event + notification; approve publishes it", async ({ browser, page }) => {
  const admin = await asAdmin(browser, "10.0.9.1");
  const a = admin.page;
  await expect(a.getByTestId("bridge-status")).toContainText("RSS-Bridge is reachable");
  const source = await addSource(a, "quimera_test");
  await expect(source.getByTestId("source-status")).toHaveText("Never checked");

  // Test feed: validates only.
  await source.getByRole("button", { name: "Test feed" }).click();
  await expect(source.getByTestId("test-feed-result")).toContainText("Feed works: 2 posts");
  await a.reload();
  await expect(source).toContainText("Posts stored0");
  await ready(a, "/admin");
  await expect(a.getByTestId("notification").filter({ hasText: "@quimera_test" })).toHaveCount(0);

  // Check now: posts stored, event detected, pending (not public), admin notified.
  await ready(a, "/admin/organisers");
  await source.getByRole("button", { name: "Check now" }).click();
  await expect(source.getByTestId("source-status")).toHaveText("Healthy");
  await expect(source).toContainText("Posts stored2");
  await expect(source).toContainText("QmTest001");
  const pending = await postsFor(a, "https://www.instagram.com/p/QmTest001/");
  await expect(pending).toContainText("Event — needs review");
  await expect(pending).toContainText("CCBombarda");
  await expect(pending).toContainText(/Confidence \d+%/);
  await expect(a.getByTestId("pending-post").filter({ hasText: "Obrigado" })).toHaveCount(0); // not an event
  await ready(a, "/admin");
  const note = a.getByTestId("notification").filter({ hasText: "QUIMERA TEST MARKET" });
  await expect(note).toContainText("@quimera_test");
  await expect(note).toContainText("2099-10-29 – 2099-10-31");
  await expect(note).toContainText("CCBombarda");
  // Phones: count on the Settings tab and on the Settings → Moderation link.
  await expect(a.getByTestId("admin-badge-mobile")).toBeVisible();
  await ready(a, "/settings");
  await expect(a.getByTestId("settings-admin-link")).toContainText(/\d/);

  // Pending events are never public.
  await page.goto("/events");
  await expect(page.getByTestId("event").filter({ hasText: "QUIMERA TEST MARKET" })).toHaveCount(0);

  // A second check finds nothing new (duplicates by post id).
  await ready(a, "/admin/organisers");
  await source.getByRole("button", { name: "Check now" }).click();
  await expect(source).toContainText("Posts stored2");
  await ready(a, "/admin");
  await expect(a.getByTestId("notification").filter({ hasText: "QUIMERA TEST MARKET" })).toHaveCount(1);

  // Approve → public.
  await (await postsFor(a, "https://www.instagram.com/p/QmTest001/")).getByRole("button", { name: "Approve" }).click();
  await page.goto("/events");
  await expect(page.getByTestId("event").filter({ hasText: "QUIMERA TEST MARKET" })).toBeVisible();

  // A new post about the same event (new time) → an update to review, not a duplicate event.
  const updated = fixture("quimera_test.xml").replace(
    "<entry>",
    `<entry>
    <title>Horário atualizado</title>
    <id>https://www.instagram.com/p/QmTest002/</id>
    <link rel="alternate" href="https://www.instagram.com/p/QmTest002/"/>
    <published>2099-10-20T10:00:00+00:00</published>
    <content type="html">QUIMERA TEST MARKET — novo horário!&lt;br&gt;🗓 29, 30 e 31 de outubro de 2099&lt;br&gt;⏰ 10h às 22h&lt;br&gt;📍 CCBombarda, Rua de Miguel Bombarda 285, Porto #cosplay</content>
  </entry>
  <entry>`,
  );
  await admin.context.request.post(`${MOCK}/__feed/quimera_test`, { data: updated, headers: { "Content-Type": "text/plain" } });
  await ready(a, "/admin/organisers");
  await source.getByRole("button", { name: "Check now" }).click();
  await expect(source).toContainText("Posts stored3");
  await ready(a, "/admin/events");
  const update = a.getByTestId("event-update").filter({ hasText: "QUIMERA TEST MARKET" });
  await expect(update).toContainText("10h–22h");
  await update.getByRole("button", { name: "Apply change" }).click();
  await page.goto("/events");
  await expect(page.getByTestId("event").filter({ hasText: "QUIMERA TEST MARKET" })).toContainText("10h–22h");
  await admin.context.close();
});

test("monitor: possible events, not-an-event, rejected events never come back, broken feeds back off, manual posts", async ({ browser }) => {
  const admin = await asAdmin(browser, "10.0.9.2");
  const a = admin.page;

  // A post without a date is a "possible event" for review.
  const meetup = await addSource(a, "meetup_rss");
  await meetup.getByRole("button", { name: "Check now" }).click();
  await expect(meetup.getByTestId("source-status")).toHaveText("Healthy");
  let card = await postsFor(a, "https://www.instagram.com/p/MeetRss01/");
  await expect(card).toContainText("Possible event — needs review");
  await card.getByRole("button", { name: "Not an event" }).click();
  await expect(await postsFor(a, "https://www.instagram.com/p/MeetRss01/")).toHaveCount(0);

  // A failing feed: error shown, source not marked up to date, next try pushed back.
  const broken = await addSource(a, "broken_feed");
  await broken.getByRole("button", { name: "Check now" }).click();
  await expect(broken.getByTestId("source-status")).toHaveText("Error");
  await expect(broken.getByTestId("source-error")).toContainText("HTTP 500");
  await expect(broken.getByTestId("source-error")).toContainText("Next try");
  await expect(broken).toContainText("Last successful check—");
  await broken.getByRole("button", { name: "Test feed" }).click();
  await expect(broken.getByTestId("test-feed-result")).toContainText("Feed doesn't work: Feed returned HTTP 500");

  // Manual post (fallback): same detection and review.
  await a.getByText("Add manual post").first().click();
  await a.getByLabel("Post link").fill("https://www.instagram.com/p/Manual001/");
  await a.getByLabel("Caption").fill("Concurso de cosplay\n🗓 12 de dezembro de 2099\n📍 Fórum Braga, Braga\nInscrições abertas!");
  await a.getByRole("button", { name: "Add manual post" }).click();
  await expect(a.getByText("Added: a new event is waiting in Pending review.")).toBeVisible();
  card = await postsFor(a, "https://www.instagram.com/p/Manual001/");
  await expect(card).toContainText("Fórum Braga");
  // Reject it; the same event posted again later doesn't come back as pending.
  await card.getByRole("button", { name: "Reject" }).click();
  await ready(a, "/admin/organisers");
  await a.getByText("Add manual post").first().click();
  await a.getByLabel("Post link").fill("https://www.instagram.com/p/Manual002/");
  await a.getByLabel("Caption").fill("Concurso de cosplay — últimos dias!\n🗓 12 de dezembro de 2099\n📍 Fórum Braga, Braga");
  await a.getByRole("button", { name: "Add manual post" }).click();
  await expect(a.getByText("Added, but not queued")).toBeVisible();
  await expect(await postsFor(a, "https://www.instagram.com/p/Manual002/")).toHaveCount(0);
  // And the exact same post can't be added twice.
  await ready(a, "/admin/organisers");
  await a.getByText("Add manual post").first().click();
  await a.getByLabel("Post link").fill("https://www.instagram.com/p/Manual001/");
  await a.getByLabel("Caption").fill("Concurso de cosplay 12 de dezembro de 2099");
  await a.getByRole("button", { name: "Add manual post" }).click();
  await expect(a.getByText("That post is already stored.")).toBeVisible();
  await admin.context.close();
});

test("monitor pages and notifications are admin-only", async ({ page }) => {
  await register(page, newUser("NotAdmin"));
  for (const path of ["/admin/organisers", "/admin/events"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  }
  await expect(page.getByTestId("admin-badge")).toHaveCount(0);
  await expect(page.getByTestId("admin-badge-mobile")).toHaveCount(0);
});
