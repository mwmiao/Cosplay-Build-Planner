# Cosplay Build Planner

A self-hosted, mobile-first planner for cosplay builds: projects, parts, costs, deadlines, a combined shopping list and reference photos. Each person has their own account and private projects, and can choose to share a project in the Community tab. No cloud services are required. It's meant to run on a home NAS and be reached through a Cloudflare Tunnel or Tailscale.

**Repo:** https://github.com/mwmiao/Cosplay-Build-Planner · **Image:** [`eazyeight/cosplay-build-planner`](https://hub.docker.com/r/eazyeight/cosplay-build-planner) (also `ghcr.io/mwmiao/cosplay-build-planner`)

**Stack:** Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS · Prisma + SQLite · Zod · sharp · Playwright

## Features

- **Try without an account**: guests get up to 5 private projects for 30 days, with their images encrypted; creating an account keeps everything (see [Guests](#guests)).
- **Accounts**: register with email and password, log in and out, change your display name and password. Password reset uses a single-use email link when email is configured. Every project is private to its owner (see [Accounts](#accounts)).
- **Community**: publish a project on purpose, choosing exactly what becomes public, and browse what others shared. Others can copy a published project into their own projects as a private template (see [Community](#community)).
- **Moderation**: an admin account can remove Community projects that break the rules, with a reason the owner sees (see [Admin and moderation](#admin-and-moderation)).
- **Projects**: character, series, convention (suggested from upcoming events), start date, deadline, status, base currency, budget, notes, and a **main picture** you upload on purpose. The dashboard shows completion %, when it starts, days left, and paid / planned / budget left / over-or-under budget. Sort the list by deadline, start date, recently updated, newest, name or progress, and switch between **grid** and **list** (remembered per device). Projects can be archived, deleted (restorable from Settings) or deleted permanently.
- **Build parts**: category, status (needed → ordered → arrived → building → done), estimated and actual cost per item, quantity, supplier, link, notes and **photos**. Filter parts by status or category, tick them done with one tap, and **reorder** them by dragging (or with the arrow buttons).
- **Shopping list**: parts marked *Needed* in active projects appear automatically. You can also add items by hand. Group by supplier, category or project. Ticking an item marks its part *Ordered*. Exports to CSV.
- **Multiple currencies**: every part keeps its own currency. Totals are shown in the project's base currency, split into *paid*, *planned*, *budget left* and *over/under budget* (see [Currencies and exchange rates](#currencies-and-exchange-rates)).
- **Project export/import**: export a project as a versioned JSON file and import it as a new project, merged into an existing one, or replacing one (see [Export and import](#export-and-import)).
- **Budget CSV** export for each project, including the original amount, currency, exchange rate, rate date, source and manual/automatic for every payment.
- **Progress timeline**: progress photos with a date, stage (e.g. "Painting") and caption, shown oldest to newest on the project page. Optional on the public page.
- **References**: upload several images at once with a caption, source link and **group** (e.g. Armour, Wig). Images are shown by group, can be filtered and **reordered**, and open full-screen **inside the app** (swipe or ←/→ to browse, Esc to close). The app makes thumbnails and removes location data from photos.
- **Events**: cosplay, anime, comics and gaming events in Portugal, upcoming (by month) and past (by year), filterable by city (see [Events](#events)).
- **English and European Portuguese**: switch in **Settings → Language** (saved per device; the first visit follows the browser's language). Dates, numbers and currency names follow the language.
- **Phone-friendly layout**: works from 360 px wide, with bottom tabs on phones and a sidebar on desktop. Dark mode follows your system setting, with an option to override it. Form fields have proper labels and keyboard focus is visible. It can be added to your home screen like an app.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `APP_URL` | recommended | `http://localhost:1337` | The address you open the app at, e.g. `https://cosplay-planner.example.com`. Password-reset links use it, and an `https://` value makes login cookies *Secure*. |
| `AUTH_SECRET` | no | generated | Signs session cookies (32+ characters). If empty, one is generated **once** into `data/secrets/auth-secret` and reused across container updates. Changing it logs everyone out. |
| `COOKIE_SECURE` | no | from `APP_URL` | Override the *Secure* cookie flag. Leave empty unless you know you need it. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `EMAIL_FROM` | no | empty | Outgoing email for password-reset links. Without `SMTP_HOST`, "Forgot password" says it's unavailable (see [Accounts](#accounts)). |
| `DATABASE_URL` | yes | `file:./dev.db` locally, `file:/app/data/cosplay.db` in Docker | SQLite database location. |
| `UPLOAD_DIR` | no | `./data/uploads`, `/app/data/uploads` in Docker | Where images are stored (private images, plus published copies under `public/`). |
| `MAX_UPLOAD_MB` | no | `15` | Maximum size per image. |
| `DEFAULT_CURRENCY` | no | `EUR` | Starting default currency for new accounts. Each user can change theirs in Settings. |
| `TZ` | no | container default | Time zone used to count "days left". |
| `PUID` / `PGID` | no | `1000` / `1000` | (Docker) The user and group that will own the files in the data folder. |
| `BACKUP_INTERVAL_HOURS` | no | `24` | (Docker) How often to back up the database automatically. `0` turns it off. |
| `BACKUP_KEEP` | no | `14` | How many automatic database backups to keep. |
| `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` | no | empty | Instagram API for the Events tab (see [Instagram](#instagram-optional-one-time-setup)). Keep the token secret. |
| `EMAIL_OUTBOX_DIR` | **testing only** | empty | Writes emails to files instead of sending them (used by the automated tests). Never set this in production. |

`APP_PASSWORD`, `SESSION_SECRET` and `SEED_EXAMPLE` from 1.2, and `REGISTRATION_CODE` from 1.3, are no longer used.

---

## Accounts

- **Registration** is open: anyone who can reach the app can create an account with a name, email and a password of at least 8 characters. Registration is rate-limited per address. New accounts only see their own projects and the Community.
- **Login** uses email and password. Passwords are hashed with scrypt by [Better Auth](https://www.better-auth.com) and never stored in readable form. Sessions are stored in the database, checked on every request, and expire after 30 days of not using the app.
- **Rate limits:** too many login, registration or password-reset attempts are refused for a while, per address and per account. Error messages don't reveal whether an email is registered.
- **Account page:** change your display name (the only thing shown publicly, and only if you publish) and your password. Changing the password signs out your other devices.
- **Password reset by email** needs SMTP settings (any provider: a Gmail app password, Fastmail, Brevo…) and `APP_URL`. The link works **once** and expires after **60 minutes**.
- **Without email:** "Forgot password" says reset isn't available; it never pretends to send anything. The admin resets the password on the server instead:
  ```bash
  sudo docker exec -it cosplay-planner node scripts/reset-password.js --email user@example.com
  ```
  This prints a new random password once and signs that user out everywhere.

**Privacy:** every project, part, image, shopping item, export and import belongs to one account. The server checks the owner on every page, action and download. Another user's project looks exactly like one that doesn't exist, and knowing an image's address isn't enough to open it.

---

## Admin and moderation

There is no admin email setting and no way to become admin from the web page. The NAS owner grants it on the server:

```bash
sudo docker exec cosplay-planner node scripts/set-admin.js --email you@example.com
sudo docker exec cosplay-planner node scripts/set-admin.js --email you@example.com --remove   # take it away
```

The account must already be registered. The command signs that user out, so log in again; a **Moderation** link then appears in the menu and on the Account page.

- **Moderation page** (`/admin`) lists every published project with its owner's display name. Open one, give a reason (3 to 500 characters, for example "copyrighted images") and press **Remove from Community**. Admins also see the same form at the bottom of each public Community page.
- **What removal does:** the same as the owner unpublishing. The public page, its data and its image copies stop working immediately.
- **What it never does:** change or delete the owner's private project. The owner sees a notice on the project with the date and reason, and can fix it and publish again (which clears the notice).
- **Log:** the last 20 removals are listed on the Moderation page. Admins can't see other users' private projects or emails.

---

## Events

The **Events** tab lists cosplay-friendly events in Portugal (Lisboa Games Week, XL Games, Comic Con Portugal, IberAnime, Mercado Pingado, Aniaki…). Anyone who can reach the app can read it.

- **What an event holds:** dates (multi-day up to 14 days), time, venue, address, city, country, tickets, type (convention, market, gaming, workshop, other), status (**announced**, **tickets on sale**, **confirmed**, **cancelled**) and its source with the date it was found. The year and "past" come from the dates. Past events stay in the **Past** archive.
- **Built-in list:** researched from organisers' websites and event press (`src/lib/events/builtin.ts`), copied into the database. When an update changes the list, events you haven't edited are refreshed automatically; for events you edited, the change waits under **Suggested events → Changes reported** instead of overwriting your edit. Deleting a built-in or found event hides it for good.
- **Organisers** (**Suggested events → Organisers**): recurring events and who runs them, with their Instagram username, usual venue and city. Organisers with no upcoming date are listed under **Next edition not announced yet**; no dates are guessed.
- **Daily check:** organisers' **Instagram** posts (see below), plus public listings that allow it (Viral Agenda's cosplay and anime pages, schema.org event data such as XL Games; `robots.txt` honoured). Dates, times, venues, addresses and tickets are read from the post text. Everything new goes to **Suggested events** as *needs review*, with the post link, poster and the date it was found. If a source later reports a different date or venue for a published event, it shows up as a change to apply or dismiss.
- **Data quality:** addresses are tidied ("R." → Rua, "Av." → Avenida, postal codes 0000-000), city names standardised, possible duplicates (similar name and venue within 3 days) flagged, and events missing a venue or source marked for review.
- **Suggestions:** anyone with an account can **Suggest event**, pasting the Instagram caption into **Fill in from post text** to fill the form. An admin approves, edits or rejects it. Rejected events aren't suggested again.
- **Maps:** each event with a venue has an **Open in Maps** button. It searches Google Maps for the venue exactly as the organiser names it (plus address and city) and opens the Maps app on phones. Admins can paste an exact map link to override the search.
- **Admins** can also **Add event** directly and edit or delete the events they added.
- Upcoming event names are suggested in a project's *Convention / event* field.

### Instagram (optional, one-time setup)

The app reads organisers' public posts through Meta's official Instagram API ("business discovery"); there's no scraping. It works for **business and creator accounts** only: personal and age-gated accounts can't be read. You need:

1. **Your own Instagram professional account** (Business or Creator), linked to a Facebook Page.
2. **A Meta app** at developers.facebook.com with the Instagram API (Facebook Login) product.
3. **An access token** for your account with the `instagram_basic` and `pages_show_list` permissions, exchanged for a **long-lived token**. Long-lived tokens expire after about 60 days unless refreshed; the Organisers page then shows "Access token expired or invalid".
4. **Your Instagram user ID:** `GET /me/accounts` gives your Page, then `GET /{page-id}?fields=instagram_business_account`.
5. **Add both to `.env` and redeploy:**
   ```bash
   INSTAGRAM_USER_ID=1784…
   INSTAGRAM_ACCESS_TOKEN=EAAG…
   ```
6. **Add each organiser's username** under **Organisers**.

Each organiser costs one API request per day. Only the post link, the details read from the text and the poster URL (for review) are stored; posts aren't copied.

---

## Community

- **Publishing is always opt-in:** open a project, go to **Community → Publish to Community**, choose what to share, check the **preview**, then publish.
- **Always public** once published: a public title, a public description (written separately; your private notes are never published), tags, status and progress, and the item list (name, category, status, quantity).
- **Your choice, off by default:**
  - budget totals (budget, total spent, total still planned)
  - estimated item costs (what you actually paid stays private)
  - shop names and links
  - **progress timeline** (off by default): your progress photos with dates and stages
  - images: **main picture + all reference images** (the default; new reference images appear automatically) or **only the images you choose**. Part photos are never public.
- **Never public:** private notes, payments (dates, actual amounts, exchange-rate details), receipts, delivery details and anything about your account. Your display name is shown; your email never is.
- **It's live:** the public page is built from your project every time someone opens it, through the same allow-list. New parts, status, progress and (with "all images") new images appear without republishing. Change the settings any time in **Community → Manage → Save changes**.
- **Unpublish** at any time. The public page, its data and its image addresses stop working immediately. Anything someone already downloaded or saved can't be recalled.
- **Browsing:** the **Community** tab can be read without logging in, with search, newest/recently-updated sorting and pages. Anyone who can reach the app can see published projects. Behind a public Cloudflare Tunnel that's the whole internet, unless you add Cloudflare Access (see [Cloudflare Tunnel](#access-via-cloudflare-tunnel-public-https)).
- **Copy to My Projects:** logged-in users can copy a published project. The copy:
  - is private and theirs, with new IDs
  - contains only what was public at that moment (including the main picture)
  - has every item set to *needed*, with no actual costs or payments
  - shows "Based on … by …"
  - never affects the original when edited

---

## Guests

On the login page, **Try without an account** starts a guest session:

- up to **5 projects** and **50 MB** of images, all private; **publishing to the Community needs an account**;
- a banner shows how many days are left: guests are **deleted 30 days after they started** (projects, images, shopping items), checked every hour;
- **Create account** or **Log in** at any time: everything moves into that account, images included;
- **Leave guest mode** deletes everything immediately.

**Guest images are encrypted** on disk (AES-256-GCM) with a random key that exists only in the guest's browser cookie; the server never stores it. Opening the files or the database on the NAS shows nothing usable. What this doesn't cover: the key is sent with each request so the app can show the guest their images, so someone who changes the app's code could capture it while the guest is using it; and project text (names, notes, parts) isn't encrypted. If a guest clears their cookies, their images can't be recovered.

---

## Upgrading from 1.2 to 1.3 (one time)

1.3 adds accounts. Projects created before 1.3 have no owner yet: they're **hidden from everyone** until you claim them, so nobody can take them by registering first.

1. **Back up first:**
   - In 1.2, open each project and use **Export → Export JSON**.
   - Copy the whole `docker/cosplay-planner/data` folder somewhere safe.
2. **Add the new settings.** Create `docker/cosplay-planner/.env` next to `docker-compose.yml` with at least:
   ```bash
   APP_URL=https://cosplay-planner.example.com
   ```
   Use the https address you actually open the app at (your Cloudflare Tunnel hostname, or the `tailscale serve` address).
3. **Update** to the 1.3 image: set `image:` back to `eazyeight/cosplay-build-planner:latest` (or `:1.3`) and redeploy. On start it backs up the database and applies the migrations. These only add tables and columns, so nothing is changed or deleted.
4. **Register** your account in the app. Your old projects won't be visible yet.
5. **Claim them** over SSH, first as a dry run that only lists what it would do:
   ```bash
   sudo docker exec cosplay-planner node scripts/claim-projects.js --email you@example.com --dry-run
   sudo docker exec cosplay-planner node scripts/claim-projects.js --email you@example.com
   ```
   The second command:
   - takes a database snapshot (`data/backups/…-pre-claim.db`)
   - in one transaction, assigns every unowned project, its shopping items and the old default currency to your account
   - never changes paid amounts or exchange rates

   Running it again does nothing: projects that already have an owner are never touched.
6. Check your projects and totals.

**Rolling back to 1.2 after upgrading** is possible without losing data, because 1.2 ignores the new tables. But 1.2 has no accounts, so every project would be visible to anyone who can reach the app again. Use it only as an emergency fallback.

---

## Currencies and exchange rates

**Each project has a base currency**, which the budget and all totals use. Each part has its own currency (for example a wig bought in USD, fabric in GBP, a prop from Japan in JPY). The default currency for new projects and the shopping list is set in **Settings → Currency**.

**Paying for a part.** Tick **Paid** on the part, enter what you paid (each, in the part's currency) and the payment date. Then either:
- **Leave "Amount charged" blank.** The app converts the payment at the exchange rate for the payment date: the European Central Bank reference rate for that day, or the last business day before it.
- **Enter the amount your bank or PayPal actually charged** in the base currency. That exact amount is used, and the implied rate (charged ÷ original) is stored.

**Payments are converted once and kept.** For every paid part the app stores:
- the original amount and currency
- the payment date
- the converted base amount and the rate used
- the rate's date and source
- whether the conversion was manual or automatic

Editing the part later (notes, status…) never redoes the conversion at today's rate. Only changing the amount, currency, quantity, payment date or charged amount converts it again, and then still at the rate for the payment date. Once a project holds converted payments, its base currency is locked.

**Totals** on the project page, all in the base currency:

| Figure | Meaning |
|---|---|
| **Paid** | Sum of the stored converted payments |
| **Planned** | Parts not yet paid (actual cost if entered, else estimate), converted at **today's** rate. Marked ≈ when another currency is involved |
| **Budget left** | Budget − paid |
| **Over / under budget** | Budget − (paid + planned) |

**Where the rates come from:**
- **Today's rates** (for planned costs and shopping-list totals) come from [ExchangeRate-API's open endpoint](https://www.exchangerate-api.com/docs/free), which is updated daily and covers 160+ currencies. If it's unavailable, the app falls back to ECB rates via [Frankfurter](https://frankfurter.dev). Rates are cached in the database and refreshed at most every 6 hours, or with **Settings → Update rates now**. Offline, the last cached rates are used.
- **Payment-date rates** come from the ECB via Frankfurter, which has history back to 1999 for about 30 major currencies (EUR, USD, GBP, JPY, CNY, KRW, AUD, CAD, CHF…). For other currencies (e.g. TWD, ARS), payments from the last 3 days use today's rate. For older payments the app asks you to enter the amount charged.
- These are the only outside services the app contacts. Neither needs an account or API key, and only the currency codes are sent.

**Parts entered before currencies existed** were migrated as paid in their project's base currency (rate 1, source *"Entered before multi-currency"*). Pick your currency in **Settings** first, so those amounts are read in the right one.

---

## Export and import

**Export:** on a project, open **Export → Export JSON**. This downloads `<name>-<date>.cosplay.json`. JSON is the canonical, complete format; the CSV next to it is only for viewing in a spreadsheet.

**What the JSON contains** (format version 1):
- the project's settings, base currency and budget
- the categories used
- every expense with its stable ID, original amount and currency, quantity, status, dates and notes
- for paid expenses: payment date, converted base amount, FX rate, rate date, source, and whether the conversion was manual or automatic
- shopping items you added by hand
- the start date and the parts' manual order
- image metadata (references with their group, part photos and the main picture). The image files themselves aren't included.

Amounts are whole cents (`"actualCostCents": 6400` = 64.00).

**With accounts (1.3+):** you can only export your own projects, and the file contains no account data. Imports always become private projects owned by you: owner or publication information in a file is ignored, and you can only merge into or replace your own projects.

**Import:** go to **Projects → Import** and choose a `.json` file. Nothing changes until you confirm.
1. **Validation:** the format and schema version, currency codes, dates, amounts, required fields and duplicate IDs are checked. Every problem is listed with its location, e.g. `parts[3].currency: unknown currency code`.
2. **Preview:** project name, number of expenses and paid expenses, currencies, paid and planned totals, budget, and warnings. For example, unknown categories are imported as *Other*, and listed reference images aren't imported.
3. **Choose:**
   - **Create a new project:** a separate copy. Existing projects are untouched.
   - **Merge into an existing project:** adds only expenses and items whose stable ID isn't already there, so importing the same file twice never duplicates anything. Project settings stay as they are. This needs the same base currency, so paid conversions stay exact.
   - **Replace an existing project:** removes its current expenses and hand-added shopping items, then imports the file's settings, expenses and items. You must type the project's name to confirm. Reference images are kept.
4. **Import report:** what was created, skipped or removed, and how many paid conversions were kept.

**Safety:**
- Each import runs as a single database transaction, so on any error nothing is changed.
- Merge and replace first save a database snapshot to `data/backups/cosplay-…-pre-import.db`. These snapshots aren't removed by the automatic backup rotation.
- Paid expenses are stored exactly as in the file. Their conversion is never recalculated.

---

## Local development (Windows, macOS, Linux)

Requires **Node.js 20 or newer** (22 LTS recommended).

```bash
npm install
cp .env.example .env          # APP_URL=http://localhost:1337
npx prisma migrate dev        # creates prisma/dev.db and applies migrations
npm run db:seed               # optional example project (unclaimed)
npm run dev                   # http://localhost:1337 → register an account
npm run claim-projects -- --email you@example.com   # take ownership of the example project
npm run set-admin -- --email you@example.com        # make yourself admin, then log in again
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check |
| `npm run build && npm start` | Production build and run locally |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run backup` | Write a database snapshot to `prisma/backups/` |
| `npm run claim-projects -- --email …` / `npm run reset-password -- --email …` | Admin commands (same as in Docker) |
| `npx playwright install chromium` then `npm run test:e2e` | End-to-end tests (own throwaway database on port 3100) |
| `npx playwright test -c playwright.container.config.ts` | Container upgrade/persistence test (run by CI against real containers) |

After changing `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>` and commit the new folder in `prisma/migrations/`.

---

## How releases work

```
push to main ──► GitHub Actions: typecheck + Playwright ──► image tagged latest + sha-<commit>
tag v1.2.0   ──► same tests ──► image tagged 1.2.0 + 1.2  ──► GitHub Release with CHANGELOG notes
```

**Where images are published:**
- **`ghcr.io/mwmiao/cosplay-build-planner`**: always.
- **`eazyeight/cosplay-build-planner` on Docker Hub**: the one the NAS uses, since the UGOS Docker app offers updates for Docker Hub images.

**Tags:**

| Tag | Meaning |
|---|---|
| `latest` | Newest commit on `main` that passed the tests. Use this to get every change. |
| `1.1.0` | Exactly that release, for pinning or rolling back. |
| `1.1` | Newest `1.1.x` patch release. |
| `sha-8a81e0e` | One specific commit. |

**Versions** follow `MAJOR.MINOR.PATCH`. The version lives in `package.json`, every release is listed in [CHANGELOG.md](CHANGELOG.md), and the running version is shown in **Settings → About this install**.

**Making a release:**
1. Bump `version` in `package.json` (and `package-lock.json`).
2. Add a section to `CHANGELOG.md` and commit.
3. Run `git tag v1.2.0 && git push origin main v1.2.0`.

The workflow refuses a tag that doesn't match `package.json`. If the tests fail, nothing is published, so a broken change never reaches the NAS.

**Connecting Docker Hub** (already done for `eazyeight`; only needed again with a new account or token):
1. Create a free account at [hub.docker.com](https://hub.docker.com).
2. Go to **Account settings → Personal access tokens → Generate new token**, with access *Read & Write*.
3. In this GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret**. Set **Name** to `DOCKERHUB_TOKEN` and **Secret** to the token (`dckr_pat_…`). The Docker Hub username (`eazyeight`) is set in the workflow file (`DOCKERHUB_USER`).
4. Re-run the latest workflow, or push anything. The image then appears at `docker.io/<username>/cosplay-build-planner`, public by default.
5. On the NAS, change `image:` in `docker-compose.yml` to `<username>/cosplay-build-planner:latest` and redeploy the project once.

---

## Docker

The image listens on **port 1337**. Everything it stores lives in one folder mounted at `/app/data`:

```
data/
├── cosplay.db        SQLite database (accounts, sessions, projects…)
├── uploads/          private images (one folder per project)
│   └── public/       copies of images published to the Community
├── secrets/          auth-secret (session signing; created once, keep it)
└── backups/          automatic and pre-claim / pre-import snapshots
```

Each time the container starts, it:
1. Backs up the existing database.
2. Applies any pending database migrations.
3. Starts the app as `PUID:PGID`, then keeps making database backups every `BACKUP_INTERVAL_HOURS`.

It never seeds, resets or deletes data. The session-signing secret lives in `data/secrets/`, so it survives container replacement (Watchtower) and logins stay valid. CI checks this on every release: it upgrades a real 1.2.1 container to the new image on the same data folder, claims the old project, verifies the stored exchange-rate conversions are unchanged, replaces the container again, and checks that the session, data and images survive.

Because of this, updating is just replacing the container with a newer image. Your data and a fresh backup are already in place.

`/api/health` is the health check: it returns `200` with `{"status":"ok"}` when the database and upload folder are working. Docker uses it too (`docker ps` shows the container as *healthy*).

Run the published image anywhere:

```bash
docker compose up -d    # with a .env containing at least APP_URL
```

To build from source instead (e.g. to try local changes in Docker):

```bash
docker build -t eazyeight/cosplay-build-planner:latest .
docker compose up -d
```

---

## Setting it up on a UGREEN NAS (DXP2800, UGOS Pro)

The NAS doesn't build anything. It downloads the ready-made image from GitHub's registry, which is built for x86-64, the same CPU type as the DXP2800's Intel N100. The NAS only needs `docker-compose.yml`, a `.env` with your settings, and a data folder; no source code.

### 1. Prepare the folders on the NAS
1. In **File Manager**, create `docker/cosplay-planner` with an empty `data` folder inside it. The compose file refers to it as `./data` (relative to its own folder), so it works whichever volume your `docker` shared folder is on.
   - Don't change this to an absolute path like `/volume1/docker/...`. UGOS treats that as creating a shared folder, and fails with *"A shared folder with the same name already exists in other volumes"* when `docker` lives on another volume.
2. Put `docker-compose.yml` from this repo in `docker/cosplay-planner`. It works as-is.
3. Create a `.env` next to it with at least `APP_URL` (the https address you open the app at). Add `TZ=…` and any other settings from `.env.example` you want. Leave `DATABASE_URL` and `UPLOAD_DIR` out; the compose file sets the Docker paths.
4. Optional but recommended: turn on SSH in **Control Panel → Terminal**, run `id`, and if your user and group IDs aren't `1000`, add `PUID=…` and `PGID=…` to `.env`. This makes the files in the data folder owned by your NAS user.

### 2. Create the project
**Docker → Project → Create**. Name it `cosplay-planner`, set the storage path to the `docker/cosplay-planner` shared folder, and let it use the `docker-compose.yml` there. Then deploy. It downloads the image and starts.

Alternatively, over SSH:
```bash
cd /volume1/docker/cosplay-planner    # use your volume number, e.g. /volume2
sudo docker compose up -d
sudo docker compose logs -f     # wait for "Starting Cosplay Build Planner on port 1337"
```

Then set up a [Cloudflare Tunnel](#access-via-cloudflare-tunnel-public-https) or [HTTPS with tailscale serve](#https-with-tailscale-serve), open that address, register, and [make yourself admin](#admin-and-moderation).

### 3. Updates
After you push changes and the GitHub workflow finishes (about 3–5 minutes), a new `latest` image exists.
- **Docker Hub image** (`eazyeight/cosplay-build-planner`, the default in `docker-compose.yml`): the UGOS Docker app should show an update for it, like it does for other Docker Hub images. Apply it there, and the container is recreated with the new version.
- **`ghcr.io` image:** UGOS doesn't appear to check GitHub's registry, so pull the image again in the Docker app or update over SSH.

Over SSH, the update command is:

```bash
cd /volume1/docker/cosplay-planner && sudo docker compose pull && sudo docker compose up -d
```

Before the new version starts, it backs up the database and applies any migrations. Check **Settings → About this install** to confirm the new version is running.

**Rolling back:** in `docker-compose.yml`, change `:latest` to an earlier `:sha-xxxxxxx` tag (see the package page), then redeploy. An older version usually works with the newer database. If it doesn't (a migration changed something it relies on), also restore the database backup made just before the update (see below).

---

## Access via Cloudflare Tunnel (public HTTPS)

A Cloudflare Tunnel publishes the app at a normal https address without opening router ports.

1. In the Cloudflare Zero Trust dashboard, add a public hostname (e.g. `cosplay-planner.example.com`) pointing to `http://<nas-ip>:1337` (or `http://cosplay-planner:1337` if `cloudflared` runs in the same Docker network).
2. Set `APP_URL=https://cosplay-planner.example.com` in `.env` and redeploy. This makes login cookies *Secure*; always open the app at that address.
3. The app reads the visitor's real address from Cloudflare's `CF-Connecting-IP` header for per-address rate limits.

**This makes the app reachable by anyone on the internet**, so anyone can register and read the Community tab. That's fine for a small group: projects are private, passwords are hashed, and attempts are rate-limited. To restrict who can even reach it, add a **Cloudflare Access** application for the hostname (for example, a one-time PIN sent to allowed emails).

---

## Access via Tailscale (outside your home)

Tailscale is already on the NAS, so the app is reachable from any device on your tailnet. Turn Tailscale on on your phone and open the app's address. Use **Share → Add to Home Screen** for an app-style icon.

**Keep it private:**
- **Do not** forward port 1337 on your router, and don't use Tailscale *Funnel*.
- The Community tab can be read without logging in by anyone who can reach the app. On your home network and tailnet that's you and the people you invite.
- For extra protection, a Tailscale ACL can limit which devices can reach the NAS.

### HTTPS with tailscale serve

Use HTTPS so login cookies are *Secure*. Over plain `http://`, anyone snooping on your home network could read them.

1. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), make sure **MagicDNS** and **HTTPS Certificates** are enabled.
2. On the NAS (SSH), run:
   ```bash
   sudo tailscale serve --bg 1337
   sudo tailscale serve status        # shows https://<nas-name>.<tailnet>.ts.net
   ```
   If your UGOS Tailscale app doesn't provide the `tailscale` command over SSH, run it inside the Tailscale container (`sudo docker exec <tailscale-container> tailscale serve --bg 1337`) or use the app's own "serve" setting if it has one.
3. Put that address in `.env` as `APP_URL=https://<nas-name>.<tailnet>.ts.net` and redeploy.
4. Always open the app at that **https** address. With an https `APP_URL`, the app sets *Secure* cookies, which browsers won't send to `http://<nas-ip>:1337`, so logging in via the plain address won't stick.

`tailscale serve` passes the visitor's address on (`X-Forwarded-For`), which the app uses for per-address rate limits. Per-account limits apply regardless.

---

## Backup and restore

Back up the whole **data folder**. It contains the database (including accounts), uploads, published copies, the session secret and snapshots. If `secrets/` is lost, nothing breaks: a new secret is generated and everyone simply logs in again.

### Backing up
- **Automatic database snapshots:** the container writes `data/backups/cosplay-YYYYMMDD-HHMMSS.db` at every start and every `BACKUP_INTERVAL_HOURS`, keeping the newest `BACKUP_KEEP` (14 by default). These are consistent copies made safely while the app is running (SQLite `VACUUM INTO`).
- **Take a snapshot right now:**
  ```bash
  sudo docker exec cosplay-planner node scripts/backup.mjs
  ```
- **Off-NAS copy:** include the `docker/cosplay-planner/data` folder in a UGOS **Sync & Backup** job to a USB drive or another location. If the shared folder is on Btrfs, you can also turn on **snapshots** for it.
  - Snapshots alone don't protect you if the disk fails, so keep a copy somewhere else too.
  - Copying the live `cosplay.db` while the app is writing can capture a half-written file. Back up the `backups/` folder instead, or stop the container first.

### Restoring
1. Stop the app: `sudo docker compose stop` (or stop it in the Docker app).
2. Pick a snapshot and put it in place of the database:
   ```bash
   cd /volume1/docker/cosplay-planner/data
   mv cosplay.db cosplay.db.broken
   rm -f cosplay.db-journal cosplay.db-wal cosplay.db-shm
   cp backups/cosplay-20261025-030000.db cosplay.db
   ```
3. If you also lost images, restore the `uploads/` folder from your off-NAS copy. Images that the database lists but that are missing on disk show as broken thumbnails, and nothing else breaks.
4. Start it again: `sudo docker compose start`. Any newer migrations are applied automatically.

To get back to the state just before an update, use the newest snapshot taken before the update time (the container makes one on every start).

### Moving to a new machine
Copy the data folder (including `secrets/`), `docker-compose.yml` and your `.env`, then run `docker compose up -d` on the new host. Accounts, sessions and projects come along.

---

## Security notes

- **Accounts** (Better Auth):
  - scrypt password hashes
  - database sessions checked on every request
  - `HttpOnly`, `SameSite=Lax` cookies, *Secure* over HTTPS
  - 30-day sliding expiry
  - rate-limited login, registration and reset (per address, using `CF-Connecting-IP` / `X-Forwarded-For`, and per account), with messages that don't reveal whether an email is registered
  - single-use, 60-minute reset links
- **Admin** is a role set only by the server command `set-admin.js`; the browser can't set it. Admin pages return "not found" to everyone else, and admin actions check the role again on the server.
- **Authorization** happens on the server for every page, server action, API route, export, import and image. Ownership always comes from the session, never from an ID sent by the browser. Tests include a user tampering with a form submission to target someone else's project.
- **CSRF:** server actions use Next.js's built-in origin check; the image-upload route rejects cross-site requests.
- **Public vs private data:** public pages are built from an allow-list on every view and checked against a strict schema. Public images are served by a separate route that checks, on each request, that the image is a main picture or reference image of a published project and is currently included. Part photos and guest images are never served publicly. Private image URLs always require ownership.
- **Guests** can't publish, are limited in projects and storage, are rate-limited per address, and their images are encrypted with a key only their browser holds.
- **Imports** are always private and owned by the importer. Owner IDs and publication state in a file are ignored, internal IDs are always new, and paid conversions are copied exactly.
- **Exports** contain no account data (no email, owner ID or session data).
- **Uploads** are checked by actually reading the image, re-encoded with metadata (including GPS) removed, size-limited, and saved under random file names.
- **User text** is always shown as plain text (React escapes it), and links from projects open with `rel="nofollow noopener noreferrer"`.
- **CSV exports** neutralise spreadsheet formulas.
- **Errors** shown to users never include database messages or secrets.

## Project layout

```
prisma/              schema, migrations, seed
src/app/(app)/       logged-in pages: projects, parts, references, publish, shopping, settings, account
src/app/(auth)/      login, register, forgot/reset password
src/app/(community)/ public Community list and detail pages (+ Copy to My Projects)
src/app/api/         health, uploads (serve + upload), exports, community JSON + public images
src/lib/             db, auth, validation (Zod), uploads, shopping-list logic, CSV
src/lib/transfer/    project export/import: file format, export builder, import + preview
src/lib/community/   public snapshot (allow-list), public read model, published image copies
scripts/admin/       claim-projects and reset-password commands (bundled into the image)
tests/, tests-container/  end-to-end tests; container upgrade/persistence test
src/i18n/            translations: en.ts, pt-PT.ts (same keys, type-checked)
src/components/      UI building blocks
.github/workflows/  CI: tests, then publishes the image to Docker Hub and ghcr.io
docker/entrypoint.sh container start-up (backup → migrate → seed → run)
scripts/backup.mjs   SQLite snapshot script
tests/               Playwright smoke test
```
