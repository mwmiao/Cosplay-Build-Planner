import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { type Browser, type Page, expect } from "@playwright/test";
import { INVITE_CODE, OUTBOX_DIR } from "../playwright.config";

export type TestUser = { name: string; email: string; password: string };

let counter = 0;
export function newUser(label: string): TestUser {
  counter += 1;
  const id = `${Date.now().toString(36)}${counter}`;
  return { name: `${label} ${id}`, email: `${label.toLowerCase()}-${id}@example.test`, password: `pw-${id}-long-enough` };
}

/** Registers (and is thereby signed in). */
export async function register(page: Page, user: TestUser) {
  await page.goto("/register");
  await page.getByLabel("Display name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.locator("input[name=password]").fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

export async function login(page: Page, user: Pick<TestUser, "email" | "password">, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** A separate browser context = a separate person with their own cookies. */
export async function asNewPerson(browser: Browser, ip: string) {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
    locale: "en-GB",
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  return { context, page: await context.newPage() };
}

export async function createProject(page: Page, name: string): Promise<string> {
  await page.goto("/projects/new");
  await page.getByLabel("Character name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  return new URL(page.url()).pathname.split("/")[2]!;
}

/** Newest test email sent to `to` (EMAIL_OUTBOX_DIR). */
export function lastEmailTo(to: string): { subject: string; text: string } | null {
  let files: string[];
  try {
    files = readdirSync(OUTBOX_DIR).sort();
  } catch {
    return null;
  }
  for (const f of files.reverse()) {
    const mail = JSON.parse(readFileSync(path.join(OUTBOX_DIR, f), "utf8"));
    if (mail.to === to) return mail;
  }
  return null;
}

/** 1×1 PNG for upload tests. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
