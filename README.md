# Cosplay Build Planner

A self-hosted, mobile-first planner for cosplay builds: projects, parts, costs, deadlines, a combined shopping list and reference photos. Single-user, password-protected, no cloud services. It's meant to run on a home NAS and be reached through Tailscale.

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
| `APP_PASSWORD` | yes | — | Login password (8+ characters). |
| `SESSION_SECRET` | yes | — | Signs the login cookie (32+ characters). Changing it logs you out everywhere. |
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
cp .env.example .env          # then edit APP_PASSWORD and SESSION_SECRET
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

## Docker

```bash
cp .env.example .env    # set APP_PASSWORD and SESSION_SECRET
docker compose up -d --build
docker compose logs -f
```

The app listens on **port 1337**. Everything it stores lives in one folder mounted at `/app/data`:

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

`/api/health` is the health check: it returns `200` with `{"status":"ok"}` when the database and upload folder are working. Docker uses it too (`docker ps` shows the container as *healthy*).

Without Compose:

```bash
docker build -t cosplay-planner .
docker run -d --name cosplay-planner -p 1337:1337 --env-file .env -v /path/to/data:/app/data --restart unless-stopped cosplay-planner
```

---

## Setting it up on a UGREEN NAS (DXP2800, UGOS Pro)

The DXP2800 has an Intel N100 (x86-64), so the image builds directly on the NAS. Expect the first build to take about 5–10 minutes.

### 1. Copy the project to the NAS
1. Make sure a `docker` shared folder exists. The Docker app usually creates it; otherwise create it in **File Manager**.
2. Copy this whole project folder to `docker/cosplay-planner/app` over SMB from your PC. You can skip `node_modules`, `.next` and `data`.
3. Create an empty folder `docker/cosplay-planner/data`. On the NAS this is `/volume1/docker/cosplay-planner/data`. If your storage pool isn't volume 1, set `DATA_PATH` in `.env`.
4. In `docker/cosplay-planner/app`, copy `.env.example` to `.env` and set:
   - `APP_PASSWORD`: your login password.
   - `SESSION_SECRET`: a long random string.
   - `TZ`: your time zone, e.g. `Europe/London`.
   - Leave `DATABASE_URL` and `UPLOAD_DIR` as they are; the compose file sets the Docker paths.

### 2. Find your user and group IDs (optional but recommended)
Turn on SSH in **Control Panel → Terminal**, connect with `ssh <your-user>@<nas-ip>` and run `id`. If the numbers aren't `1000`, add `PUID=…` and `PGID=…` to `.env`. This makes the files in the data folder owned by your NAS user, so you can open and back them up normally.

### 3. Start it
**Option A: UGOS Docker app.** Open **Docker → Project → Create**. Name it `cosplay-planner`, set the path to `/volume1/docker/cosplay-planner/app`, and let it use the `docker-compose.yml` already there. Then deploy. Building the image is part of deploying.

**Option B: SSH.**
```bash
cd /volume1/docker/cosplay-planner/app
sudo docker compose up -d --build
sudo docker compose logs -f     # wait for "Starting Cosplay Build Planner on port 1337"
```

Open `http://<nas-lan-ip>:1337` on your home network.

### 4. Updating to a new version
Copy the new source files over the `app` folder (keep your `.env`), then rebuild: **Docker → Project → cosplay-planner → Rebuild**, or `sudo docker compose up -d --build`. Your data folder is untouched, and the app applies database migrations automatically after a pre-update backup.

---

## Access via Tailscale (outside your home)

Tailscale is already on the NAS, so the app is reachable from any device on your tailnet:

- `http://<nas-tailscale-name>:1337`. Find the MagicDNS name or the `100.x.y.z` address in the Tailscale admin console.
- On your phone, turn Tailscale on and open that address. Use **Share → Add to Home Screen** to get an app-style icon.

**Keep it private:**
- **Do not** forward port 1337 on your router, and don't use Tailscale *Funnel*.
- The app has a password, but it isn't designed to be on the public internet.
- For extra protection, a Tailscale ACL can limit which of your devices can reach the NAS on port 1337.

**Optional HTTPS.** If the NAS's Tailscale install gives you the `tailscale` command, run `tailscale serve --bg 1337`. You can then use `https://<nas-name>.<tailnet>.ts.net`. Set `COOKIE_SECURE=true` in `.env` afterwards and restart the container. Do this only if you'll always use the HTTPS address, otherwise logging in over plain `http://` will fail.

---

## Backup and restore

Back up the whole **data folder**. It contains the database, uploads and snapshots.

### Backing up
- **Automatic database snapshots:** the container writes `data/backups/cosplay-YYYYMMDD-HHMMSS.db` at every start and every `BACKUP_INTERVAL_HOURS`, keeping the newest `BACKUP_KEEP` (14 by default). These are consistent copies made safely while the app is running (SQLite `VACUUM INTO`).
- **Take a snapshot right now:**
  ```bash
  sudo docker exec cosplay-planner node scripts/backup.mjs
  ```
- **Off-NAS copy:** include `/volume1/docker/cosplay-planner/data` in a UGOS **Sync & Backup** job to a USB drive or another location. If the shared folder is on Btrfs, you can also turn on **snapshots** for it.
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

### Moving to a new machine
Copy the data folder and your `.env`, then run `docker compose up -d --build` on the new host.

---

## Security notes

- There is one password, set in `APP_PASSWORD`. The login cookie is signed, `HttpOnly` and `SameSite=Lax`, and lasts 30 days.
- After 10 wrong attempts within 15 minutes, logins from that address are refused for a while.
- Every page, API route and server action checks the login cookie itself, not only the middleware.
- `/api/health` is the only unauthenticated endpoint, and it reveals nothing beyond "ok/error".
- Uploads are checked by actually reading the image, not by trusting the file name. They're re-encoded with metadata (including GPS) stripped, saved under random file names, and served only to logged-in sessions.
- CSV exports neutralise spreadsheet formulas, so a cell can't run code when opened in Excel.

## Project layout

```
prisma/              schema, migrations, seed
src/app/(app)/       logged-in pages: projects, parts, references, shopping, settings
src/app/api/         health, uploads (serve + upload), CSV exports
src/app/login/       login page and actions
src/lib/             db, auth, validation (Zod), uploads, shopping-list logic, CSV
src/components/      UI building blocks
docker/entrypoint.sh container start-up (backup → migrate → seed → run)
scripts/backup.mjs   SQLite snapshot script
tests/               Playwright smoke test
```
