# Cosplay Build Planner

A self-hosted, mobile-first planner for cosplay builds: projects, parts, costs, deadlines, a combined shopping list and reference photos. Single-user, no login by default (an optional password is available), no cloud services. It's meant to run on a home NAS and be reached through Tailscale.

**Repo:** https://github.com/mwmiao/Cosplay-Build-Planner · **Image:** `ghcr.io/mwmiao/cosplay-build-planner`

**Stack:** Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS · Prisma + SQLite · Zod · sharp · Playwright

## Features

- **Projects**: character, series, convention, deadline, status, budget, notes. The dashboard shows completion %, days left, spent vs budget, and estimated vs actual cost. Projects can be archived, deleted (restorable from Settings) or deleted permanently.
- **Build parts**: category, status (needed → ordered → arrived → building → done), estimated and actual cost per item, quantity, supplier, link and notes. Filter parts by status or category, and tick them done with one tap.
- **Shopping list**: parts marked *Needed* in active projects appear automatically. You can also add items by hand. Group by supplier, category or project. Ticking an item marks its part *Ordered*. Exports to CSV.
- **Budget CSV** export for each project.
- **References**: upload several images at once with a caption and source link. The app makes thumbnails and removes location data from photos.
- **Phone-friendly layout**: works from 360 px wide, with bottom tabs on phones and a sidebar on desktop. Dark mode follows your system setting, with an option to override it. Form fields have proper labels and keyboard focus is visible. It can be added to your home screen like an app.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `APP_PASSWORD` | no | empty | Leave empty for no login (the default). Set it (8+ characters) to require a password. |
| `SESSION_SECRET` | only with a password | empty | Signs the login cookie (32+ characters). Changing it logs you out everywhere. |
| `DATABASE_URL` | yes | `file:./dev.db` locally, `file:/app/data/cosplay.db` in Docker | SQLite database location. |
| `UPLOAD_DIR` | no | `./data/uploads`, `/app/data/uploads` in Docker | Where images are stored. |
| `MAX_UPLOAD_MB` | no | `15` | Maximum size per image. |
| `COOKIE_SECURE` | no | `false` | Set `true` **only** if you use the app over HTTPS. On plain `http://`, a `true` here means you can't stay logged in. |
| `TZ` | no | container default | Time zone used to count "days left". |
| `PUID` / `PGID` | no | `1000` / `1000` | (Docker) The user and group that will own the files in the data folder. |
| `BACKUP_INTERVAL_HOURS` | no | `24` | (Docker) How often to back up the database automatically. `0` turns it off. |
| `BACKUP_KEEP` | no | `14` | How many database backups to keep. |
| `SEED_EXAMPLE` | no | `true` | (Docker) Adds an example project the first time the app starts. |

To generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Local development (Windows, macOS, Linux)

Requires **Node.js 20 or newer** (22 LTS recommended).

```bash
npm install
cp .env.example .env          # defaults work as-is (no login)
npx prisma migrate dev        # creates prisma/dev.db and applies migrations
npm run db:seed               # optional example project
npm run dev                   # http://localhost:1337
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check |
| `npm run build && npm start` | Production build and run locally |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run backup` | Write a database snapshot to `prisma/backups/` |
| `npx playwright install chromium` then `npm run test:e2e` | Smoke test (uses its own throwaway database on port 3100) |

After changing `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>` and commit the new folder in `prisma/migrations/`.

---

## How releases work

```
push to main ──► GitHub Actions: typecheck + Playwright ──► build image ──► ghcr.io/mwmiao/cosplay-build-planner:latest
                                                                                   │
                                          UGREEN NAS (Docker app) sees newer :latest ◄┘ ──► update
```

- **Every push to `main`** runs the tests, and if they pass, publishes a new image tagged:
  - `latest`
  - `sha-<commit>`, e.g. `sha-f053d1f`
- **Pull requests** only run the tests.
- **Tags like `v1.2.0`** also publish `1.2.0`. Use one if you ever want to pin the NAS to a fixed version.
- **Failed tests mean nothing is published,** so a broken change never reaches the NAS.
- **Settings → About this install** shows the running version (linked to its commit) and when it was built, so you can confirm an update arrived.

Watch builds under the repo's **Actions** tab. Published images are listed under **Packages** on the repo page.

---

## Docker

The image listens on **port 1337**. Everything it stores lives in one folder mounted at `/app/data`:

```
data/
├── cosplay.db        SQLite database
├── uploads/          reference images (one folder per project)
└── backups/          automatic database snapshots
```

Each time the container starts, it:
1. Backs up the existing database.
2. Applies any pending database migrations.
3. On the first run only, adds the example project.
4. Starts the app as `PUID:PGID`, then keeps making database backups every `BACKUP_INTERVAL_HOURS`.

Because of this, updating is just replacing the container with a newer image. Your data and a fresh backup are already in place.

`/api/health` is the health check: it returns `200` with `{"status":"ok"}` when the database and upload folder are working. Docker uses it too (`docker ps` shows the container as *healthy*).

Run the published image anywhere:

```bash
docker compose up -d    # no .env needed; add one only to change defaults
```

To build from source instead (e.g. to try local changes in Docker):

```bash
docker build -t ghcr.io/mwmiao/cosplay-build-planner:latest .
docker compose up -d
```

---

## Setting it up on a UGREEN NAS (DXP2800, UGOS Pro)

The NAS doesn't build anything. It downloads the ready-made image from GitHub's registry, which is built for x86-64, the same CPU type as the DXP2800's Intel N100. The NAS only needs `docker-compose.yml` and a data folder: no source code and no `.env`.

### 1. Prepare the folders on the NAS
1. In **File Manager**, create `docker/cosplay-planner` with an empty `data` folder inside it. The compose file refers to it as `./data` (relative to its own folder), so it works whichever volume your `docker` shared folder is on.
   - Don't change this to an absolute path like `/volume1/docker/...`. UGOS treats that as creating a shared folder, and fails with *"A shared folder with the same name already exists in other volumes"* when `docker` lives on another volume.
2. Put `docker-compose.yml` from this repo in `docker/cosplay-planner`. It works as-is.
3. Optional: to change a default, create a `.env` next to it with just the lines you need, for example `TZ=Europe/Lisbon` (default `Europe/London`). See `.env.example` for all of them. Leave `DATABASE_URL` and `UPLOAD_DIR` out; the compose file sets the Docker paths.
4. Optional but recommended: turn on SSH in **Control Panel → Terminal**, run `id`, and if your user and group IDs aren't `1000`, add `PUID=…` and `PGID=…` to `.env`. This makes the files in the data folder owned by your NAS user.

### 2. Create the project
**Docker → Project → Create**. Name it `cosplay-planner`, set the storage path to the `docker/cosplay-planner` shared folder, and let it use the `docker-compose.yml` there. Then deploy. It downloads the image and starts.

Alternatively, over SSH:
```bash
cd /volume1/docker/cosplay-planner    # use your volume number, e.g. /volume2
sudo docker compose up -d
sudo docker compose logs -f     # wait for "Starting Cosplay Build Planner on port 1337"
```

Open `http://<nas-lan-ip>:1337` on your home network.

### 3. Updates
After you push changes and the GitHub workflow finishes (about 3–5 minutes), the UGOS Docker app shows that a newer `ghcr.io/mwmiao/cosplay-build-planner:latest` image is available. Update the image or project from there, and the container is recreated with the new version. Over SSH, the equivalent is:

```bash
cd /volume1/docker/cosplay-planner && sudo docker compose pull && sudo docker compose up -d
```

Before the new version starts, it backs up the database and applies any migrations. Check **Settings → About this install** to confirm the new version is running.

**Rolling back:** in `docker-compose.yml`, change `:latest` to an earlier `:sha-xxxxxxx` tag (see the package page), then redeploy. An older version usually works with the newer database. If it doesn't (a migration changed something it relies on), also restore the database backup made just before the update (see below).

---

## Access via Tailscale (outside your home)

Tailscale is already on the NAS, so the app is reachable from any device on your tailnet:

- `http://<nas-tailscale-name>:1337`. Find the MagicDNS name or the `100.x.y.z` address in the Tailscale admin console.
- On your phone, turn Tailscale on and open that address. Use **Share → Add to Home Screen** to get an app-style icon.

**Keep it private:**
- **Do not** forward port 1337 on your router, and don't use Tailscale *Funnel*.
- Login is off by default, so anyone who can reach port 1337 can see and change your plans. On your home network and tailnet that's only you and your devices, which is the intended setup.
- For extra protection, a Tailscale ACL can limit which of your devices can reach the NAS on port 1337.

**Optional HTTPS.** If the NAS's Tailscale install gives you the `tailscale` command, run `tailscale serve --bg 1337`. You can then use `https://<nas-name>.<tailnet>.ts.net`. If you've turned on the optional login, also set `COOKIE_SECURE=true` in `.env` and restart the container. Do that only if you'll always use the HTTPS address, otherwise logging in over plain `http://` will fail.

---

## Backup and restore

Back up the whole **data folder**. It contains the database, uploads and snapshots.

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
Copy the data folder, `docker-compose.yml` and your `.env` (if you made one), then run `docker compose up -d` on the new host.

---

## Security notes

- **No login by default.** The app trusts its network: anyone who can reach port 1337 can use it. Keep it on your home network and Tailscale; never expose it to the internet.
- **Optional login.** Set `APP_PASSWORD` and `SESSION_SECRET` (in a `.env` next to `docker-compose.yml`) and restart to require a password. The login cookie is signed, `HttpOnly` and `SameSite=Lax`, and lasts 30 days. After 10 wrong attempts within 15 minutes, logins from that address are refused for a while. Every page, API route and server action then checks the cookie itself, not only the middleware.
- Uploads are checked by actually reading the image, not by trusting the file name. They're re-encoded with metadata (including GPS) stripped and saved under random file names. Requests for files outside the upload folder are refused.
- CSV exports neutralise spreadsheet formulas, so a cell can't run code when opened in Excel.

## Project layout

```
prisma/              schema, migrations, seed
src/app/(app)/       logged-in pages: projects, parts, references, shopping, settings
src/app/api/         health, uploads (serve + upload), CSV exports
src/app/login/       login page and actions
src/lib/             db, auth, validation (Zod), uploads, shopping-list logic, CSV
src/components/      UI building blocks
.github/workflows/  CI: tests, then publishes the image to ghcr.io
docker/entrypoint.sh container start-up (backup → migrate → seed → run)
scripts/backup.mjs   SQLite snapshot script
tests/               Playwright smoke test
```
