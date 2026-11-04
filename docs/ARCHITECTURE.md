# Architecture

A map of how the app fits together, for someone about to change it. For running it, see the [README](../README.md).

## In one paragraph

One Next.js 14 app (App Router, TypeScript) with a SQLite database through Prisma, accounts through Better Auth, and images on disk. It runs as a single container on a home server. There is no separate API service: pages are server components, changes go through server actions, and a handful of route handlers serve files and downloads.

## Folder map

| Path | What lives there |
|---|---|
| `src/app/(app)/` | Signed-in pages: projects, parts, references, publish, shopping, settings, account, admin. |
| `src/app/(community)/` | Pages that work for visitors too: Community and Events. |
| `src/app/(auth)/` | Login, register, forgot/reset password, and the sign-in server actions. |
| `src/app/api/` | Route handlers: image uploads, private and public image files, exports, the public Community list, health check. |
| `src/lib/` | Business logic and data access. Pages and actions stay thin and call into here. |
| `src/lib/community/` | The public read model (what visitors may see) and reports. |
| `src/lib/events/`, `src/lib/instagram/` | Event data, the daily listing check, and the Instagram feed monitor. |
| `src/lib/transfer/` | Project export and import (the JSON file format). |
| `src/components/` | Shared UI (navigation, forms, lightbox, badges). |
| `src/i18n/` | English and European Portuguese dictionaries. Both must have identical keys (a test checks). |
| `prisma/` | Schema and migrations. `scripts/admin/` holds the server-side admin commands. |
| `tests/` | Playwright browser tests (throwaway database). `tests-unit/` holds fast Vitest tests for `src/lib`. |

## Request flow and access control

1. `src/middleware.ts` only checks that a session cookie exists. It never grants access.
2. Every page, server action and route handler then validates the session against the database with `getCurrentUser()` / `requireUser()` / `requireAccount()` / `requireAdmin()` / `requireModerator()` (`src/lib/auth.ts`). Someone else's project looks exactly like a missing one (404).
3. A test (`tests-unit/route-auth.test.ts`) fails if a route or server action is added without such a check, unless it is on the short list of deliberately public ones.

Roles are `user`, `moderator` and `admin`. Admin is granted only with the server command `set-admin`. Admins grant the moderator role in the app. A suspended account (`User.suspendedAt`) counts as signed out. Guests are Better Auth anonymous users: private projects only, with limits, deleted after 30 days.

## Data model

Money is stored as integer cents plus a currency code. A paid part stores its converted amount and exchange rate at payment time and is never recalculated.

- **Project → BuildPart, ReferenceImage, ShoppingListItem.** Deletes are soft (`deletedAt`) for projects, parts and shopping items.
- **ReferenceImage** covers references, part photos, the main picture (`kind: cover`) and progress photos.
- **Publication** is a Community listing of a project. Public pages are built live from the project through an allow-list (`src/lib/community/snapshot.ts`, `view.ts`), so private fields can't leak by accident.
- **Bookmark, Reaction, EventAttendance, Report** belong to an account.
- **Event, Organiser, InstagramSource, InstagramPost, EventUpdate** hold events and the review queue. Only `approved` events are public.
- **ModerationAction, RoleChange** keep a history of removals, role changes and suspensions.
- **User, Session, Account, Verification** are managed by Better Auth. `defaultCurrency`, `role` and `suspendedAt` are ours.

Migrations are additive, and the container backs up the database before applying them.

### Columns and tables kept only for old data

Nothing here is read by current code. They stay so existing databases and old exports keep working. Remove them only in a deliberate migration.

| What | Why it exists |
|---|---|
| `Project.spentCents` | Before multi-currency; totals now come from paid parts. |
| `Publication.snapshot`, `Publication.coverImageId` | Before 1.6, public pages were stored copies. `snapshot` is informational now. |
| `PublicImage` table | Copies of published images before 1.6. Only cleanup code touches it. |
| `Organiser.instagram` | Before 1.7.1; copied into `InstagramSource`. |
| `Project.ownerId` / `ShoppingListItem.ownerId` may be null | Projects created before accounts existed; assigned with `claim-projects`. |

## Images and files

- Uploads go through `POST /api/projects/[id]/references` (a route, not a server action, so large files aren't limited by the action body size). It checks the origin, the session and ownership, and caps the body size before reading it.
- `src/lib/uploads.ts` decodes every upload with sharp (the file name and type are not trusted), re-encodes it with metadata such as GPS removed, and writes a thumbnail. Files are stored as `<UPLOAD_DIR>/<projectId>/<random-id>.<ext>`.
- Private images are served by `/api/uploads/...` only to the owner. Guest images are encrypted on disk with a key that exists only in the guest's browser cookie.
- Published images are served by `/api/community/images/...` after a check on every request that the image is currently public. Responses carry an ETag so browsers re-download nothing that hasn't changed.

## Background jobs

`src/instrumentation.ts` starts `src/lib/jobs.ts` once per process: hourly guest and rate-limit clean-up, the Instagram monitor every few minutes, and the daily event listing check. Database backups run from `docker/entrypoint.sh`.

**Single instance only.** Jobs run inside the web process and the database is one SQLite file, so run one container per `data/` folder.

## Security measures worth knowing

- Security headers and a Content-Security-Policy are set in `next.config.mjs`. The CSP allows inline scripts because Next.js and the theme script need them.
- Login, registration, reset and guest creation are rate limited in the database (`src/lib/rateLimit.ts`). `TRUSTED_PROXY` decides which request header identifies the visitor (`src/lib/clientIp.ts`).
- Links from outside the app (event sources, feeds) must be http(s) (`safeHttpUrl`). Feed addresses typed by an admin must not point at private network addresses (`src/lib/netGuard.ts`).
- Account deletion and export live in `src/lib/account.ts`.

## Testing

| Command | What it covers |
|---|---|
| `npm run typecheck` | TypeScript. |
| `npm run lint` | Next.js and accessibility lint rules. |
| `npm run test:unit` | Vitest: money maths, import validation, CSV, formatting, translations, route/action access checks. About a second. |
| `npm run test:e2e` | Playwright on a phone-sized browser against a throwaway database and upload folder. About 8 minutes. |

CI runs all of them, plus a test that upgrades from the published 1.2.1 image.
