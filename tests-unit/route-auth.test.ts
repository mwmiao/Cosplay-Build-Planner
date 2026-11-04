import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards against a new route or server action that forgets to check who is asking.
// Middleware only checks that a session cookie exists; every handler must validate it.

const GUARDS = /\b(getCurrentUser|requireUser|requireAccount|requireAdmin|requireModerator)\(/;

function files(dir: string, name: RegExp): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? files(full, name) : name.test(entry) ? [full] : [];
  });
}
const rel = (f: string) => path.relative(process.cwd(), f).replaceAll("\\", "/");

/** Public on purpose (anyone may call them). Anything else must check the session. */
const PUBLIC_ROUTES = [
  "src/app/api/health/route.ts", // uptime check
  "src/app/api/community/route.ts", // public list of published projects
  "src/app/api/community/[id]/route.ts",
  "src/app/api/community/images/[imageId]/[variant]/route.ts", // checks the publication itself
];

describe("API routes", () => {
  const routes = files("src/app/api", /^route\.ts$/);
  it("found the routes", () => expect(routes.length).toBeGreaterThan(5));
  for (const file of routes) {
    const name = rel(file);
    it(`${name} ${PUBLIC_ROUTES.includes(name) ? "is public by design" : "checks the session"}`, () => {
      const src = readFileSync(file, "utf8");
      if (PUBLIC_ROUTES.includes(name)) return;
      expect(src, `${name} must call getCurrentUser()/require*()`).toMatch(GUARDS);
    });
  }
});

/** Server actions that are open to visitors by design (sign-in flow, public pages). */
const PUBLIC_ACTIONS = new Set([
  "src/app/(auth)/actions.ts:signIn",
  "src/app/(auth)/actions.ts:signUp",
  "src/app/(auth)/actions.ts:startGuest",
  "src/app/(auth)/actions.ts:signOut",
  "src/app/(auth)/actions.ts:requestPasswordReset",
  "src/app/(auth)/actions.ts:resetPassword",
  "src/app/(app)/settings/actions.ts:setLanguage", // only sets the language cookie; visitors can too
]);

describe("server actions", () => {
  const actionFiles = files("src/app", /\.(ts|tsx)$/).filter((f) => /^\s*["']use server["']/m.test(readFileSync(f, "utf8").slice(0, 200)));
  it("found the action files", () => expect(actionFiles.length).toBeGreaterThan(5));
  for (const file of actionFiles) {
    const src = readFileSync(file, "utf8");
    // Split at each exported async function; check its body for a session check.
    const parts = src.split(/^export async function /m).slice(1);
    for (const part of parts) {
      const fn = /^(\w+)/.exec(part)![1]!;
      const key = `${rel(file)}:${fn}`;
      it(`${key} ${PUBLIC_ACTIONS.has(key) ? "is public by design" : "checks the session"}`, () => {
        if (PUBLIC_ACTIONS.has(key)) return;
        // The body runs until the next top-level declaration.
        const body = part.split(/^(?:export |async function |function |const |type )/m)[0] ?? part;
        expect(body, `${key} must call getCurrentUser()/require*()`).toMatch(GUARDS);
      });
    }
  }
});
