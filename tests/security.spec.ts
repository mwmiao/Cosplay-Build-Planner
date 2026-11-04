import { expect, test } from "@playwright/test";
import { sameOrigin } from "../src/lib/http";
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
