import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { type Browser, type Page, expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { parseJsonLd, parseViralAgenda } from "../src/lib/events/parse";
import { parseFeed } from "../src/lib/instagram/feed";
import { safeHttpUrl } from "../src/lib/safeUrl";
import { PNG, asNewPerson, createProject, login, makeAdmin, newUser, register } from "./helpers";

// 1.7.2 fixes: http(s)-only external links, linked Instagram accounts on the
// Events page, indexed image paths, and oversized uploads refused early.

const BASE = "http://127.0.0.1:3100";

test("external links: only http(s) is kept (unit)", () => {
  expect(safeHttpUrl("https://example.org/e/1")).toBe("https://example.org/e/1");
  expect(safeHttpUrl("  http://example.org ")).toBe("http://example.org/");
  expect(safeHttpUrl("/pt/events/1", "https://www.viralagenda.com/pt/tags/cosplay")).toBe("https://www.viralagenda.com/pt/events/1");
  for (const bad of ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "file:///etc/passwd", "", "not a url", null, 42]) {
    expect(safeHttpUrl(bad)).toBeNull();
  }
  // A relative-looking "javascript:" is still javascript, even with a base.
  expect(safeHttpUrl("javascript:alert(1)", "https://xlgames.pt/")).toBeNull();

  // JSON-LD: an unsafe event url falls back to the page it was found on.
  const ld = (url: string) =>
    `<script type="application/ld+json">${JSON.stringify({ "@type": "Event", name: "Test Con", startDate: "2099-05-01", url, location: { name: "Hall", address: { addressLocality: "Lisboa", addressCountry: "PT" } } })}</script>`;
  expect(parseJsonLd(ld("javascript:alert(1)"), "https://xlgames.pt/")[0]!.url).toBe("https://xlgames.pt/");
  expect(parseJsonLd(ld("data:text/html,x"), "https://xlgames.pt/")[0]!.url).toBe("https://xlgames.pt/");
  expect(parseJsonLd(ld("/events/test-con"), "https://xlgames.pt/")[0]!.url).toBe("https://xlgames.pt/events/test-con");

  // Viral Agenda: an item whose link isn't http(s) is skipped.
  const va = (url: string) =>
    `<li id="c1" class="viral-event" data-id="1" data-url="${url}" data-date-start="2099-05-01"><a class="viral-linked" aria-label="Test Con"></a><span class="varios node-name">Porto</span></li>`;
  expect(parseViralAgenda(va("/pt/events/1/test-con"), "https://www.viralagenda.com/pt/tags/cosplay")[0]!.url).toBe(
    "https://www.viralagenda.com/pt/events/1/test-con",
  );
  expect(parseViralAgenda(va("javascript:alert(1)"), "https://www.viralagenda.com/pt/tags/cosplay")).toHaveLength(0);

  // Feeds: unsafe permalinks and images are dropped (the post itself is kept).
  const [post] = parseFeed(readFileSync("tests/fixtures/instagram/unsafe_links.xml", "utf8"));
  expect(post).toMatchObject({ externalId: "unsafe-links-001", permalink: null, imageUrl: null });
  const rss = parseFeed(
    `<rss><channel><item><title>x</title><link>javascript:alert(1)</link><guid>g1</guid><enclosure url="data:image/png;base64,AAAA" type="image/png"/></item></channel></rss>`,
  );
  expect(rss[0]).toMatchObject({ externalId: "g1", permalink: null, imageUrl: null });
});

async function asAdmin(browser: Browser, ip: string) {
  const user = newUser("HardAdmin");
  const admin = await asNewPerson(browser, ip);
  await register(admin.page, user);
  makeAdmin(user.email);
  await login(admin.page, user, "/admin/organisers");
  await expect(admin.page.getByRole("heading", { name: "Organisers", level: 1 })).toBeVisible();
  return admin;
}

async function ready(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test("external links: a feed with javascript:/data: links stores and shows none", async ({ browser }) => {
  const { page: a } = await asAdmin(browser, "10.0.12.1");
  await ready(a, "/admin/organisers");
  await a.getByText("Add Instagram source").first().click();
  await a.getByLabel("Instagram username").fill("@unsafe_links");
  await a.getByRole("button", { name: "Add Instagram source" }).click();
  const source = a.getByTestId("instagram-source").filter({ hasText: "@unsafe_links" });
  await source.getByRole("button", { name: "Check now" }).click();
  await expect(source.getByTestId("source-status")).toHaveText("Healthy");
  await expect(source).toContainText("Posts stored1");

  await ready(a, "/admin/events");
  const pending = a.getByTestId("pending-post").filter({ hasText: "UNSAFE LINKS CON" });
  await expect(pending).toBeVisible();
  await expect(a.locator('[href^="javascript:" i], [src^="data:" i]')).toHaveCount(0);
  await ready(a, "/admin");
  await expect(a.getByTestId("notification").filter({ hasText: "UNSAFE LINKS CON" })).toBeVisible();
  await expect(a.locator('[href^="javascript:" i]')).toHaveCount(0);
});

test("external links: the 1.7.2 migration clears stored non-http links and keeps http ones", async () => {
  const db = new PrismaClient({ datasourceUrl: "file:./playwright.db" });
  try {
    const old = { name: "Old unsafe event", startDate: new Date("2000-01-01"), city: "Porto", status: "rejected" };
    const bad = await db.event.create({
      data: { ...old, url: "javascript:alert(1)", sourceUrl: " data:text/html,x", posterUrl: "vbscript:x", mapUrl: "javascript:void(0)" },
    });
    const good = await db.event.create({
      data: { ...old, url: "https://example.org/a", sourceUrl: "http://example.org/b", posterUrl: "https://example.org/c.jpg", mapUrl: "https://maps.app.goo.gl/x" },
    });
    const post = await db.instagramPost.create({ data: { provider: "manual", permalink: "javascript:alert(1)", imageUrl: "data:image/png;base64,AA" } });
    const okPost = await db.instagramPost.create({ data: { provider: "manual", permalink: "https://www.instagram.com/p/Ok1/", imageUrl: "https://example.org/i.jpg" } });

    const sql = readFileSync("prisma/migrations/20261101090000_http_links_only/migration.sql", "utf8");
    for (const statement of sql.split(";").map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(statement);
    }

    expect(await db.event.findUnique({ where: { id: bad.id }, select: { url: true, sourceUrl: true, posterUrl: true, mapUrl: true } })).toEqual({
      url: null,
      sourceUrl: null,
      posterUrl: null,
      mapUrl: null,
    });
    expect(await db.event.findUnique({ where: { id: good.id }, select: { url: true, sourceUrl: true, posterUrl: true, mapUrl: true, name: true } })).toEqual({
      url: "https://example.org/a",
      sourceUrl: "http://example.org/b",
      posterUrl: "https://example.org/c.jpg",
      mapUrl: "https://maps.app.goo.gl/x",
      name: "Old unsafe event",
    });
    expect(await db.instagramPost.findUnique({ where: { id: post.id }, select: { permalink: true, imageUrl: true } })).toEqual({ permalink: null, imageUrl: null });
    expect(await db.instagramPost.findUnique({ where: { id: okPost.id }, select: { permalink: true, imageUrl: true } })).toEqual({
      permalink: "https://www.instagram.com/p/Ok1/",
      imageUrl: "https://example.org/i.jpg",
    });
    await db.event.deleteMany({ where: { id: { in: [bad.id, good.id] } } });
    await db.instagramPost.deleteMany({ where: { id: { in: [post.id, okPost.id] } } });
  } finally {
    await db.$disconnect();
  }
});

test("events page: 'not announced yet' links the organiser's Instagram sources", async ({ browser, page }) => {
  const { page: a } = await asAdmin(browser, "10.0.12.2");
  const name = `Linked Org ${Date.now()}`;
  await ready(a, "/admin/organisers");
  const addOrganiser = a.locator("details").filter({ hasText: "Add organiser" });
  await addOrganiser.getByText("Add organiser").first().click();
  await addOrganiser.getByLabel("Name").fill(name);
  await addOrganiser.getByLabel("City").fill("Braga");
  await addOrganiser.getByRole("button", { name: "Add organiser" }).click();
  await expect(a.getByTestId("organisers").getByText(name)).toBeVisible();

  await ready(a, "/admin/organisers");
  const addSource = a.locator("details").filter({ hasText: "Add Instagram source" }).first();
  await addSource.getByText("Add Instagram source").first().click();
  await addSource.getByLabel("Instagram username").fill("@linked_org_test");
  await addSource.getByLabel("Organiser", { exact: true }).selectOption({ label: name });
  await addSource.getByRole("button", { name: "Add Instagram source" }).click();
  await expect(a.getByTestId("instagram-source").filter({ hasText: "@linked_org_test" })).toBeVisible();

  await page.goto("/events");
  const card = page.getByTestId("awaiting").locator("li").filter({ hasText: name });
  await expect(card.getByRole("link", { name: "@linked_org_test" })).toHaveAttribute("href", "https://www.instagram.com/linked_org_test/");
});

test("image paths are indexed (query plan)", async () => {
  const db = new PrismaClient({ datasourceUrl: "file:./playwright.db" });
  try {
    const plan = await db.$queryRawUnsafe<{ detail: string }[]>(
      `EXPLAIN QUERY PLAN SELECT "id" FROM "ReferenceImage" WHERE "filePath" = 'a' OR "thumbPath" = 'a'`,
    );
    const details = plan.map((p) => p.detail).join("\n");
    expect(details).toContain("ReferenceImage_filePath_idx");
    expect(details).toContain("ReferenceImage_thumbPath_idx");
    expect(details).not.toMatch(/SCAN "?ReferenceImage"?(\s|$)/);
  } finally {
    await db.$disconnect();
  }
});

/**
 * A POST with control over how the body is sent. `contentLength` = claim a size
 * and send no body at all (the reply must come before any body is read);
 * `chunkedMb` = stream that many MB without a Content-Length.
 */
function rawUpload(path: string, cookie: string, opts: { contentLength?: number; chunkedMb?: number; referer?: string }) {
  return new Promise<{ status: number; location: string | null; body: string }>((resolve, reject) => {
    const headers: Record<string, string | number> = { "Content-Type": "multipart/form-data; boundary=----x", Cookie: cookie };
    if (opts.referer) headers.Referer = `${BASE}${opts.referer}`;
    if (opts.contentLength !== undefined) headers["Content-Length"] = opts.contentLength;
    else headers["Transfer-Encoding"] = "chunked";
    let answered = false;
    const req = httpRequest(`${BASE}${path}`, { method: "POST", headers }, (res) => {
      answered = true;
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        req.destroy();
        resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? null, body });
      });
    });
    req.on("error", (err) => (answered ? undefined : reject(err)));
    req.flushHeaders();
    if (opts.chunkedMb) {
      const chunk = Buffer.alloc(1024 * 1024, 0x61);
      let sent = 0;
      const write = () => {
        while (!answered && sent < opts.chunkedMb!) {
          sent += 1;
          if (!req.write(chunk)) return void req.once("drain", write);
        }
        if (!answered) req.end();
      };
      write();
    }
  });
}

const cookieHeader = async (page: Page) => (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

test("uploads: an oversized request is refused before its body is read; normal uploads still work", async ({ browser }) => {
  // Account: the limit is 20 × MAX_UPLOAD_MB (15) + 1 MB. A claimed 400 MB is
  // refused without sending a single byte of body.
  const owner = await asNewPerson(browser, "10.0.12.3");
  await register(owner.page, newUser("BigUpload"));
  const projectId = await createProject(owner.page, "Big upload");
  const cookie = await cookieHeader(owner.page);
  const refs = `/projects/${projectId}/references`;
  const claimed = await rawUpload(`/api/projects/${projectId}/references`, cookie, { contentLength: 400 * 1024 * 1024, referer: refs });
  expect(claimed.status).toBe(303);
  const location = new URL(claimed.location!, BASE);
  expect(location.pathname).toBe(refs);
  expect(location.searchParams.get("uploadError")).toBe("That upload is too large (over 301 MB in total). Upload fewer images at a time.");
  // Without a page of this project to go back to: a plain 413.
  const noReferer = await rawUpload(`/api/projects/${projectId}/references`, cookie, { contentLength: 400 * 1024 * 1024 });
  expect(noReferer.status).toBe(413);
  expect(JSON.parse(noReferer.body).error).toContain("too large");
  const otherPage = await rawUpload(`/api/projects/${projectId}/references`, cookie, { contentLength: 400 * 1024 * 1024, referer: "/admin" });
  expect(otherPage.status).toBe(413);

  // The error is shown on the page it goes back to.
  await owner.page.goto(`${location.pathname}${location.search}`);
  await expect(owner.page.getByText("That upload is too large")).toBeVisible();

  // A normal upload still works.
  const ok = await owner.page.request.post(`/api/projects/${projectId}/references`, {
    multipart: { kind: "reference", images: { name: "ok.png", mimeType: "image/png", buffer: PNG } },
    maxRedirects: 0,
  });
  expect(ok.status()).toBe(303);
  expect(ok.headers().location).toContain("uploaded=1");

  // Guest: no more than their remaining storage (50 MB) + 1 MB, also when the
  // body is streamed without a Content-Length.
  const guest = await asNewPerson(browser, "10.0.12.4");
  await guest.page.goto("/login");
  await guest.page.getByRole("button", { name: "Try without an account" }).click();
  await expect(guest.page).toHaveURL(/\/projects\?welcome=guest/, { timeout: 30_000 });
  const guestProject = await createProject(guest.page, "Guest big upload");
  const guestCookie = await cookieHeader(guest.page);
  const streamed = await rawUpload(`/api/projects/${guestProject}/references`, guestCookie, {
    chunkedMb: 60,
    referer: `/projects/${guestProject}/references`,
  });
  expect(streamed.status).toBe(303);
  expect(new URL(streamed.location!, BASE).searchParams.get("uploadError")).toContain("50 MB");
  const guestOk = await guest.page.request.post(`/api/projects/${guestProject}/references`, {
    multipart: { images: { name: "g.png", mimeType: "image/png", buffer: PNG } },
    maxRedirects: 0,
  });
  expect(guestOk.headers().location).toContain("uploaded=1");
});
