# Changelog

Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Each release is a git tag (`v1.1.0`) and a Docker image tag (`1.1.0` and `1.1`).
`latest` always follows the newest commit on `main`.

## 1.7.2 — 2026-11-01

### Fixed
- **Links from outside the app are http(s) only.** Event listings, JSON-LD
  and feeds could carry `javascript:` or `data:` links that became clickable
  links on the Events and admin pages. They are now dropped when read and
  when stored, and a migration clears any already stored (http/https links
  are kept).
- **"Next edition not announced yet"** shows the organiser's Instagram
  accounts from Admin › Organisers (it still read the pre-1.7.1 field).
- **Oversized uploads are refused before they're read.** The image upload
  route no longer runs through middleware (Next.js held the whole body in
  memory first) and refuses requests over 20 × MAX_UPLOAD_MB + 1 MB (for
  guests, their remaining storage), with a clear message.

### Changed
- Image file paths are indexed, so loading an image no longer scans every
  image row.

## 1.7.1 — 2026-10-31

### Changed
- **Instagram monitoring without Instagram login or API:** public accounts are
  read through a self-hosted RSS-Bridge (new `rss-bridge` service in Docker
  Compose, internal only). The Graph API integration and
  INSTAGRAM_USER_ID / INSTAGRAM_ACCESS_TOKEN are removed.
- Events waiting for review now have status `pending_review`.

### Added
- **Instagram sources** (username, type, organiser, provider, feed URL,
  health, latest post) with Check now, Check all, **Test feed** (validates
  only) and **Add manual post** as a fallback.
- Monitor every INSTAGRAM_POLL_INTERVAL_MINUTES (30): per-source lock,
  exponential backoff after failures, 5-minute feed cache, duplicate checks
  by post id then permalink, raw posts stored with the original caption.
- Deterministic event detection with confidence and reasons; new events are
  **pending review**, weak matches are "Possible event — needs review",
  posts about known events become **updates**; rejected events don't come back.
- Admin-only **notifications** with an unread badge (Moderation link; Settings
  tab on phones).
- Provider interface for swapping RSS-Bridge for RSS.app/Apify later; mock
  provider and an RSS-Bridge stand-in for tests.

### Fixed
- The Moderation page's "waiting for review" count was always 0.

### Upgrading
- Additive migration. Instagram usernames saved on organisers become sources.
  Add the new `rss-bridge` service by updating `docker-compose.yml` (see README).

## 1.7.0 — 2026-10-30

### Added
- **Progress timeline:** progress photos with date, stage and caption, shown
  oldest to newest on the project page; optional on the public page
  ("Show progress timeline", off by default).
- **Events:** type, status (announced / tickets on sale / confirmed /
  cancelled), time, tickets, country and provenance (source link, date found).
  IberAnime Santarém 2027 added.
- **Organisers**, with "Next edition not announced yet" for recurring events.
- **Instagram (official API):** organisers' business/creator accounts are
  checked daily; dates, venues, addresses and tickets are read from the post
  text and queued for review. Needs INSTAGRAM_USER_ID / INSTAGRAM_ACCESS_TOKEN.
- **Fill in from post text** in the event forms.
- **Change detection:** built-in list updates refresh events you haven't
  edited; other source changes wait for review ("Changes reported").
- **Data quality:** Portuguese address/city tidying, fuzzy duplicate checks
  (name + venue + dates), review flags (no venue/source, implausible dates).

### Changed
- Community pages show the main picture as a square beside the title, like
  the project page.
- Built-in events now live in the database, so admins can edit them.

### Upgrading
- Additive migration. Optional new settings INSTAGRAM_USER_ID and
  INSTAGRAM_ACCESS_TOKEN.

## 1.6.0 — 2026-10-29

### Added
- **Try without an account (guests):** up to 5 private projects and 50 MB of
  images for 30 days; can't publish. Registering or logging in moves everything
  into the account; "Leave guest mode" deletes it at once; expired guests are
  removed hourly. Guest images are encrypted on disk (AES-256-GCM) with a key
  that only the guest's browser holds.
- **Events: automatic check** of public listings once a day (Viral Agenda
  cosplay/anime, schema.org event data such as XL Games), honouring robots.txt.
  New events wait in **Suggested events** for admin approval.
- **Events: user suggestions** (with where they saw it) and an admin queue to
  approve, edit or reject; rejected events aren't suggested again.
- **Open in Maps** button on events (venue search; admins can set an exact
  map link). Aniaki's venue is ESPAV.

### Changed
- **Community pages are live:** built from the project on every view (same
  allow-list). Images: main picture + all reference images (default) or only
  chosen ones. No more copied image files or "Update published version".
  Existing publications keep exactly their previous images until the owner
  switches to "all".

### Fixed
- Logging in with a stale session cookie (expired session, or right after
  `set-admin`) could leave the user signed out.

### Upgrading
- Additive migration (guest flag, image encryption flag, publication image
  settings, event review fields). No new settings needed.

## 1.5.0 — 2026-10-28

### Added
- **Start date** for projects (next to the deadline; the deadline can't be
  earlier). Shown on the project ("starts in…" / "started … ago") and in the list.
- **Main picture**: uploaded on purpose in Edit project (replace or remove).
  Reference images no longer become the project picture. It's the default
  Community cover when published, and Copy to My Projects keeps it.
- **Part photos**: each part has its own photos (upload, caption, reorder,
  delete); the first one is the part's thumbnail in the list.
- **Manual order** for parts, reference images and part photos: drag by the
  handle (works on touch screens) or use the arrow buttons; saved instantly.
- **Reference groups** (e.g. Armour, Wig): sections, group filter, and
  reordering within a group.
- **In-app image viewer**: images open full-screen inside the app (swipe or
  ←/→, Esc to close) instead of a new tab — also on Community pages.
- **Sorting and grid/list views** for Projects (deadline, start date, updated,
  newest, name, progress) and Community (newest, updated, oldest, title),
  remembered per device.
- **Events** tab: Portuguese cosplay/anime/gaming events, upcoming and past,
  with a city filter. Built-in researched list plus events added by admins.
  Replaces "New" in the phone bottom bar (the projects page has a New button).

### Changed
- Export files include the start date, part order and image kind/group
  (format version 1, older files still import).

### Upgrading
- Additive migration (new columns and an Event table). Existing parts keep
  their order and reference images stay newest-first.

## 1.4.1 — 2026-10-27

### Changed
- New app icon: a "C" monogram with a sparkle on a violet-to-pink gradient,
  plus PNG home-screen icons (Android maskable, iOS apple-touch-icon).
- New colour theme: grape-violet accent and plum-tinted neutrals in light and
  dark mode, over a soft glow-and-dot background. Translucent cards, sidebar
  and bottom bar.

## 1.4.0 — 2026-10-27

### Changed
- **Open registration:** the invite code (`REGISTRATION_CODE`) is gone. Anyone
  who can reach the app can register; registration stays rate-limited per
  address. `REGISTRATION_CODE` in `.env` is now ignored.
- Per-address rate limits use Cloudflare's `CF-Connecting-IP` when present
  (Cloudflare Tunnel), then `X-Forwarded-For`.

### Added
- **Admin role and moderation:** grant with
  `node scripts/set-admin.js --email ...` (`--remove` to revoke). Admins get a
  Moderation page listing published projects and can remove one from the
  Community with a reason. Removal deletes the public snapshot and image
  copies only; the owner's private project is untouched, they see the reason,
  and they can publish again. Removals are logged.

### Upgrading
- Additive migration (user role column, moderation log). Existing accounts,
  sessions and projects are kept.

## 1.3.0 — 2026-10-26

### Added
- **Accounts** (Better Auth): register with an invite code (`REGISTRATION_CODE`),
  log in/out, change display name and password. Database sessions with a
  30-day sliding expiry; rate-limited login, registration and reset; messages
  don't reveal whether an email is registered.
- **Password reset** by single-use, 60-minute email link (SMTP settings), or,
  without email, a clear "unavailable" message and an admin command:
  `node scripts/reset-password.js --email …`.
- **Private projects**: every project, part, image, shopping item, export and
  import belongs to one account and is checked on the server. Image files need
  ownership, not just the URL.
- **Community**: opt-in publishing with a required preview. A publication is a
  snapshot built from an allow-list (title, public description, tags,
  progress, items; optionally budget totals, estimated item costs, shop links,
  chosen images). Private notes, payments and account data are never
  published. "Update published version", "Unpublish" (removes public pages and
  image copies). Public Community list with search, sorting and pages.
- **Copy to My Projects**: a private planning template from a published
  project, with new ids, items reset to "needed", no spending copied, and
  attribution to the original creator.
- `claim-projects` admin command for assigning projects created before 1.3.
- CI upgrade test: a real 1.2.1 container is replaced by the new image on the
  same data folder, old projects are claimed, stored FX conversions are
  verified unchanged, and session/data/images survive a further container
  replacement.

### Changed
- Imports are always private and owned by the importer; exports contain no
  account data.
- Containers never seed an example project.
- Navigation: Projects · Community · New · Shopping · Settings, plus an account
  menu.

### Removed
- `APP_PASSWORD` / `SESSION_SECRET` single-password login and `SEED_EXAMPLE`.

### Upgrade notes
- Read "Upgrading from 1.2 to 1.3" in the README **before** updating: export
  your projects and copy the data folder, add `REGISTRATION_CODE` and `APP_URL`
  to `.env`, update, register, then run `claim-projects`. Until claimed, old
  projects are hidden from everyone.
- Migrations only add tables and columns. Rolling back to 1.2 keeps your data
  but removes accounts (everything visible again), so treat it as an
  emergency fallback only.

## 1.2.1 — 2026-10-26

### Added
- **Project export** as a versioned JSON file (format version 1): project
  settings, budget, categories, and every expense with its original amount,
  currency, dates, status, FX rate, rate date, converted base amount, FX
  source, manual/automatic flag, notes and timestamps, plus hand-added
  shopping items and reference-image metadata. The budget CSV stays available
  for viewing.
- **Project import** (Projects → Import): validates the file (format, schema
  version, currency codes, dates, amounts, missing fields, duplicate IDs), shows
  a preview with name, expense count, currencies, totals and warnings, then
  creates a new project, merges into an existing one, or replaces one after
  typing its name to confirm. Runs in a single transaction, takes a database
  backup first for merge/replace, and ends with an import report.
- Stable expense IDs, so merging the same file twice never duplicates
  anything. Paid expenses keep their stored conversion exactly; nothing is
  recalculated on import.

### Upgrade notes
- The database migrates automatically (existing expenses get a stable ID).

## 1.2.0 — 2026-10-25

### Added
- European Portuguese (pt-PT) interface, alongside English. Switch in
  **Settings → Language**; the choice is saved per device, and the first visit
  follows the browser's language.
- Numbers, dates and currency names follow the chosen language (e.g. `23,10 €`,
  "iene japonês"). Form validation messages and CSV export headers are
  translated too.

### Changed
- On phones, the sticky form bar no longer shows Cancel (the back link at the
  top does the same), so the main buttons fit on one row.
- English dates and numbers use the British format (e.g. `25 Oct 2026`).

## 1.1.1 — 2026-10-25

### Changed
- Images are also published to Docker Hub as `eazyeight/cosplay-build-planner`
  (alongside `ghcr.io`), and `docker-compose.yml` now uses the Docker Hub image
  so the UGOS Docker app can detect updates. No app changes.

## 1.1.0 — 2026-10-25

### Added
- Multi-currency budgets. Every part keeps its own currency; each project has a
  base currency for its budget and totals.
- Marking a part **Paid** converts it once at the European Central Bank rate for
  the payment date, or uses the amount your bank/PayPal charged and stores the
  implied rate. The original amount, currency, date, rate, rate source and
  manual/automatic flag are kept and never recalculated.
- Project totals split into paid, planned (today's rate), budget left and
  over/under budget.
- Settings → Currency: default currency, current exchange rates and a refresh
  button. Rates are cached so the app keeps working offline.
- Currency-aware shopping list and CSV exports (budget CSV includes the full
  conversion details for every payment).
- Version number and build commit shown in Settings → About this install.

### Changed
- Login is optional and off by default; set `APP_PASSWORD` and
  `SESSION_SECRET` to turn it on.
- `docker-compose.yml` works without a `.env` file and mounts `./data`, so it
  works whichever volume the `docker` shared folder is on.
- Paying for a part ticks it off the shopping list.

### Removed
- The manual "Total spent" override on projects (totals now come only from
  converted payments).

### Upgrade notes
- The database migrates automatically on start (a backup is made first).
  Parts that already had an actual cost become *paid* in the project's base
  currency at rate 1. Set your default currency in Settings first.

## 1.0.0 — 2026-10-25

First release: projects, build parts, shopping list with CSV export, reference
images, mobile-first UI with dark mode, Docker image published from GitHub
Actions.
