import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { pickClientIp } from "../src/lib/clientIp";
import { sameOrigin } from "../src/lib/http";
import { rssBridgeProvider } from "../src/lib/instagram/providers";
import { assertPublicUrl, isPrivateAddress } from "../src/lib/netGuard";
import { purgeRateLimits } from "../src/lib/rateLimitCleanup";
import { asNewPerson, login, newUser, register } from "./helpers";

// Security hardening: response headers, the CSRF guard, the login lockout key
// and the public Community API limit.

const req = (headers: Record<string, string>) => new Request("http://app.test/api/x", { method: "POST", headers });

test("CSRF guard: Origin must match; without Origin a cross-site browser request is refused (unit)", () => {
  expect(sameOrigin(req({ origin: "http://app.test", host: "app.test" }))).toBe(true);
  expect(sameOrigin(req({ origin: "http://evil.test", host: "app.test" }))).toBe(false);
  expect(sameOrigin(req({ origin: "http://evil.test", host: "app.test", "x-forwarded-host": "evil.test" }))).toBe(true); // proxy sets the public host
  expect(sameOrigin(req({ origin: "not a url", host: "app.test" }))).toBe(false);
  // No Origin: Sec-Fetch-Site decides when the browser sends it.
  expect(sameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
  expect(sameOrigin(req({ "sec-fetch-site": "same-site" }))).toBe(false);
  expect(sameOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
  expect(sameOrigin(req({ "sec-fetch-site": "none" }))).toBe(true);
  // curl / scripts send neither header.
  expect(sameOrigin(req({}))).toBe(true);
});

test("responses carry the security headers (no HSTS over http)", async ({ request }) => {
  const res = await request.get("/login", { headers: { "x-forwarded-for": "10.50.0.1" } });
  const h = res.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  const csp = h["content-security-policy"] ?? "";
  for (const part of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) {
    expect(csp).toContain(part);
  }
  // The test server runs on http://127.0.0.1, where HSTS would be wrong.
  expect(h["strict-transport-security"]).toBeUndefined();
});

test("pages still work under the CSP: no violations while browsing", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /content security policy/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
  const user = newUser("CspUser");
  await register(page, user);
  for (const path of ["/projects", "/projects/new", "/community", "/events", "/shopping", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(problems).toEqual([]);
});

test("cross-site upload POST is refused before any login check", async ({ request }) => {
  const res = await request.post("/api/projects/does-not-matter/references", {
    headers: { "sec-fetch-site": "cross-site", "x-forwarded-for": "10.50.0.2" },
    multipart: { kind: "reference" },
  });
  expect(res.status()).toBe(403);
});

test("login lockout is per address and account: a stranger can't lock you out", async ({ browser }) => {
  const user = newUser("LockUser");
  const owner = await asNewPerson(browser, "10.51.0.1");
  await register(owner.page, user);
  await owner.page.context().clearCookies();

  // A stranger guesses wrong from their own address until they're stopped.
  const stranger = await asNewPerson(browser, "10.51.0.2");
  for (let i = 0; i < 8; i++) {
    await login(stranger.page, { email: user.email, password: `wrong-${i}-password` });
    await expect(stranger.page.getByText("Email or password is incorrect.")).toBeVisible();
  }
  await login(stranger.page, { email: user.email, password: "wrong-again-password" });
  await expect(stranger.page.getByText("Too many attempts. Wait a few minutes and try again.")).toBeVisible();
  // ...even with the right password, from that address.
  await login(stranger.page, user);
  await expect(stranger.page.getByText("Too many attempts. Wait a few minutes and try again.")).toBeVisible();

  // The real owner, from another address, can still log in.
  const home = await asNewPerson(browser, "10.51.0.3");
  await login(home.page, user);
  await expect(home.page).toHaveURL(/\/projects$/);
  await expect(home.page.getByText("Too many attempts")).toHaveCount(0);

  await Promise.all([owner.context.close(), stranger.context.close(), home.context.close()]);
});

test("public Community API: rate limited per address with Retry-After", async ({ request }) => {
  const headers = { "x-forwarded-for": "10.52.0.1" };
  let limited = null;
  for (let i = 0; i < 125 && !limited; i++) {
    const res = await request.get("/api/community", { headers });
    if (res.status() === 429) limited = res;
    else expect(res.status()).toBe(200);
  }
  expect(limited).not.toBeNull();
  expect(limited!.headers()["retry-after"]).toBe("60");
  // Another address is unaffected.
  const other = await request.get("/api/community", { headers: { "x-forwarded-for": "10.52.0.2" } });
  expect(other.status()).toBe(200);
});

test("client address: TRUSTED_PROXY decides which header is believed (unit)", () => {
  const get = (h: Record<string, string>) => (name: string) => h[name] ?? null;
  const spoofed = get({ "x-forwarded-for": "6.6.6.6, 203.0.113.9", "cf-connecting-ip": "198.51.100.7", "x-real-ip": "5.5.5.5" });
  expect(pickClientIp(spoofed)).toBe("198.51.100.7"); // unset: first match, as before
  expect(pickClientIp(get({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("6.6.6.6");
  expect(pickClientIp(get({}))).toBe("local");
  // cloudflare: only CF-Connecting-IP; a forged X-Forwarded-For changes nothing.
  expect(pickClientIp(spoofed, "cloudflare")).toBe("198.51.100.7");
  expect(pickClientIp(get({ "x-forwarded-for": "6.6.6.6" }), "cloudflare")).toBe("local");
  // proxy: the entry your proxy appended (last), never the client-supplied first one.
  expect(pickClientIp(spoofed, "proxy")).toBe("203.0.113.9");
  expect(pickClientIp(get({ "cf-connecting-ip": "198.51.100.7" }), "proxy")).toBe("local");
});

test("rate-limit counters older than a day are purged, recent ones kept", async () => {
  const db = new PrismaClient({ datasourceUrl: "file:./playwright.db" });
  try {
    const now = new Date();
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
    await db.authRateLimit.createMany({
      data: [
        { key: "purge-test-old", count: 3, windowStart: hoursAgo(30) },
        { key: "purge-test-recent", count: 3, windowStart: hoursAgo(2) },
      ],
    });
    expect(await purgeRateLimits(db, now)).toBeGreaterThanOrEqual(1);
    expect(await db.authRateLimit.findUnique({ where: { key: "purge-test-old" } })).toBeNull();
    expect(await db.authRateLimit.findUnique({ where: { key: "purge-test-recent" } })).not.toBeNull();
    await db.authRateLimit.delete({ where: { key: "purge-test-recent" } });
  } finally {
    await db.$disconnect();
  }
});

test("feed URLs typed by an admin: private addresses are refused (unit)", async () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.5", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:192.168.0.1"]) {
    expect(isPrivateAddress(ip), ip).toBe(true);
  }
  for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "100.63.0.1", "2606:4700::1111"]) {
    expect(isPrivateAddress(ip), ip).toBe(false);
  }
  for (const url of ["http://localhost:3000/feed", "http://127.0.0.1:1337/", "http://[::1]/", "http://10.0.0.5/feed", "http://nas.local/feed", "http://169.254.169.254/latest/meta-data/"]) {
    await expect(assertPublicUrl(url), url).rejects.toThrow();
  }
  await expect(assertPublicUrl("http://93.184.216.34/feed")).resolves.toBeUndefined();

  // Through the provider: refused with a clear message, and nothing is fetched.
  delete process.env.ALLOW_PRIVATE_FEED_URLS;
  delete process.env.RSS_BRIDGE_BASE_URL;
  await expect(
    rssBridgeProvider.fetchRecentPosts({ username: "x", feedUrl: "http://127.0.0.1:3199/?u=quimera_test" }, { fresh: true }),
  ).rejects.toMatchObject({ kind: "invalid", message: expect.stringContaining("private network") });
  // The bundled/own RSS-Bridge address is trusted, and so is everything when the owner allows it.
  process.env.RSS_BRIDGE_BASE_URL = "http://127.0.0.1:3199";
  const ok = await rssBridgeProvider.fetchRecentPosts({ username: "x", feedUrl: "http://127.0.0.1:3199/?u=quimera_test" }, { fresh: true });
  expect(ok.posts.length).toBeGreaterThan(0);
  delete process.env.RSS_BRIDGE_BASE_URL;
  process.env.ALLOW_PRIVATE_FEED_URLS = "true";
  await expect(
    rssBridgeProvider.fetchRecentPosts({ username: "x", feedUrl: "http://127.0.0.1:3199/?u=quimera_test" }, { fresh: true }),
  ).resolves.toMatchObject({ feedUrl: "http://127.0.0.1:3199/?u=quimera_test" });
  delete process.env.ALLOW_PRIVATE_FEED_URLS;
});
