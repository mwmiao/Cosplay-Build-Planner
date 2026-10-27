# Cosplay Build Planner

A self-hosted, mobile-first planner for cosplay builds: projects, parts, costs, deadlines, a shopping list and reference photos.

**Who it's for:** cosplayers who want to plan their builds privately on their own hardware (for example a home NAS) and optionally share them with a small group. No cloud services are required.

**Repo:** https://github.com/mwmiao/Cosplay-Build-Planner · **Image:** [`eazyeight/cosplay-build-planner`](https://hub.docker.com/r/eazyeight/cosplay-build-planner) (also `ghcr.io/mwmiao/cosplay-build-planner`) · **Changes:** [CHANGELOG.md](CHANGELOG.md)

## Highlights

- **Projects:** character, series, convention, start date, deadline, status, budget, notes and a main picture. Shows progress, days left and paid / planned / budget left.
- **Build parts:** category, status (needed → ordered → arrived → building → done), costs, supplier, link and photos. Drag to reorder.
- **Shopping list:** built automatically from parts marked *Needed*, plus items you add yourself. Exports to CSV.
- **Multiple currencies:** each part keeps its own currency. Payments are converted once at the rate for the payment date and never recalculated.
- **References and progress photos:** grouped, reorderable and shown full-screen. Location data is removed from photos.
- **Accounts:** private projects per account, plus password reset by email when SMTP is set up.
- **Guests:** try the app without an account (5 projects, 50 MB, 30 days, encrypted images).
- **Community:** publish a project on purpose, choosing exactly what becomes public. Others can copy it as a private template. An admin can remove shared projects.
- **Events:** cosplay events in Portugal, with Maps links, user suggestions and admin review. New events can be picked up from public Instagram accounts through a self-hosted RSS-Bridge.
- **Export/import:** a project as a versioned JSON file, plus a budget CSV.
- **English and European Portuguese**, dark mode, works from 360 px wide, and can be added to your home screen.

## Tech stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS · Prisma + SQLite · Better Auth · Zod · sharp · Playwright

## Quick Docker setup

1. Create a folder with an empty `data/` folder inside it, and copy [`docker-compose.yml`](docker-compose.yml) into it.
2. Create a `.env` next to it with at least:
   ```bash
   APP_URL=https://cosplay-planner.example.com
   ```
3. Start it:
   ```bash
   docker compose up -d
   ```
4. Open `APP_URL`, register, then make yourself admin:
   ```bash
   sudo docker exec cosplay-planner node scripts/set-admin.js --email you@example.com
   ```
   Log in again afterwards. A **Moderation** link appears.

The app listens on port **1337** and keeps everything in `data/`: the database, uploads, secrets and backups. Every container start backs up the database and applies migrations. It never seeds, resets or deletes data. The health check is at `/api/health`.

On a UGREEN NAS, put the files in `docker/cosplay-planner` and create the project in **Docker → Project → Create**. Keep the data path relative (`./data`).

## Basic configuration

Set these in `.env` (all options are in [`.env.example`](.env.example)):

| Variable | Default | Purpose |
|---|---|---|
| `APP_URL` | `http://localhost:1337` | The address you open the app at. An `https://` value makes login cookies *Secure*. |
| `AUTH_SECRET` | generated once | Signs session cookies. Saved in `data/secrets/` if empty. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | empty | Email for password-reset links (optional). |
| `TZ` | container default | Time zone for "days left". |
| `DEFAULT_CURRENCY` | `EUR` | Starting currency for new accounts. |
| `MAX_UPLOAD_MB` | `15` | Maximum size per image. |
| `PUID` / `PGID` | `1000` | Owner of the files in `data/`. |
| `BACKUP_INTERVAL_HOURS` / `BACKUP_KEEP` | `24` / `14` | Automatic database backups (`0` turns them off). |
| `INSTAGRAM_MONITOR_ENABLED` | `true` | Automatic Instagram checks for Events. |

Without email, reset a password on the server:

```bash
sudo docker exec -it cosplay-planner node scripts/reset-password.js --email user@example.com
```

## Access from outside your home

**Cloudflare Tunnel (public HTTPS):**
- Add a public hostname pointing to `http://<nas-ip>:1337`.
- Set `APP_URL` to that https address.
- Anyone on the internet can then register and read the Community tab. Add **Cloudflare Access** to restrict who can reach it.

**Tailscale (private):**
- Run `sudo tailscale serve --bg 1337` on the NAS. This needs MagicDNS and HTTPS Certificates enabled.
- Set `APP_URL=https://<nas-name>.<tailnet>.ts.net`.
- Always open the app at that https address.
- Don't forward port 1337 on your router, and don't use Tailscale Funnel.

## Backups and updates

**Backups:**
- The container writes database snapshots to `data/backups/` at every start and every `BACKUP_INTERVAL_HOURS`.
- Take one now:
  ```bash
  sudo docker exec cosplay-planner node scripts/backup.mjs
  ```
- Keep an off-NAS copy of the whole `data/` folder, for example with a UGOS **Sync & Backup** job.

**Restore:** stop the app, then replace `data/cosplay.db` with a snapshot from `data/backups/` (remove any `cosplay.db-journal`, `-wal` and `-shm` files). Start it again.

**Updates:**
- Apply the image update in the UGOS Docker app, or run:
  ```bash
  sudo docker compose pull && sudo docker compose up -d
  ```
- The running version is shown in **Settings → About this install**.
- To roll back, pin an earlier image tag (e.g. `:1.7.1`) and restore the snapshot taken before the update if needed.

## Local development

Requires **Node.js 20+**.

```bash
npm install
cp .env.example .env          # APP_URL=http://localhost:1337
npx prisma migrate dev        # creates the database
npm run dev                   # http://localhost:1337
```

Other commands:
- `npm run typecheck`: TypeScript check.
- `npx playwright install chromium`, then `npm run test:e2e`: end-to-end tests, on their own database on port 3100.
- `npm run set-admin -- --email you@example.com`: make yourself admin.

Releases: bump the version in `package.json`, add a [CHANGELOG.md](CHANGELOG.md) entry, then push a `vX.Y.Z` tag. CI tests the tag, then publishes the image.

## License

No license has been chosen yet: the repository has no LICENSE file.
