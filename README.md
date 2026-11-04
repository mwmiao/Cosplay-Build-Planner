# Cosplay Build Planner

[![CI](https://github.com/mwmiao/Cosplay-Build-Planner/actions/workflows/docker.yml/badge.svg)](https://github.com/mwmiao/Cosplay-Build-Planner/actions/workflows/docker.yml)
[![Docker image](https://img.shields.io/docker/v/eazyeight/cosplay-build-planner?sort=semver&label=docker)](https://hub.docker.com/r/eazyeight/cosplay-build-planner)

**Plan your cosplay builds: parts, budget, deadlines and reference photos in one place, on your own server.**

Cosplay Build Planner is a mobile-first web app you run yourself, for example on a home NAS. Your projects stay private unless you choose to publish one. No cloud account is needed.

<!-- ![Project page on a phone](docs/screenshot-project.png) -->

## Features

- **Projects:** character, series, convention, deadline and budget, with progress and days left.
- **Build parts:** track each part from *needed* to *done*, with cost, supplier and photos.
- **Shopping list:** built from the parts you still need. Export it as CSV.
- **Multiple currencies:** each part keeps its own currency, and past payments are never recalculated.
- **Photos:** reference and progress images, shown full-screen. Location data is removed.
- **Try it first:** use the app as a guest without an account.
- **Community:** publish a project on purpose and choose what becomes public. Others can save, react to or copy it.
- **Events:** cosplay events in Portugal, with "I'm going" and suggestions.
- **Backup and move:** export a project as a file, or the budget as CSV.
- **Your data:** download everything in your account as one file, or delete your account and all its data.
- English and European Portuguese, dark mode, and installable on a phone's home screen.

## Quick start

You need Docker. Copy and paste:

```bash
mkdir cosplay-planner && cd cosplay-planner && mkdir data
curl -O https://raw.githubusercontent.com/mwmiao/Cosplay-Build-Planner/main/docker-compose.yml
echo "APP_URL=http://localhost:1337" > .env
docker compose up -d
```

Open http://localhost:1337. If you serve it from another address, set `APP_URL` to that address instead.

To become admin, register first, then run:

```bash
docker exec cosplay-planner node scripts/set-admin.js --email you@example.com
```

Log in again afterwards. A **Moderation** link appears.

## Basic usage

1. Register, or choose **Try without an account**.
2. Press **New project** and enter the character.
3. Add parts, set their status and prices, and upload reference photos.
4. Check **Shopping** for what is left to buy.
5. Optional: **Publish** a project to the Community tab.

## Configuration

Set these in `.env`. All options are listed in [`.env.example`](.env.example).

| Variable | Default | What it does |
|---|---|---|
| `APP_URL` | `http://localhost:1337` | The address you open the app at. Use `https://` when served over HTTPS. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | empty | Email settings, used only for password-reset links. |
| `DEFAULT_CURRENCY` | `EUR` | Starting currency for new accounts. |
| `MAX_UPLOAD_MB` | `15` | Maximum size per image. |
| `TZ` | container default | Time zone for "days left". |
| `TRUSTED_PROXY` | unset | `cloudflare` or `proxy`: which header to believe for the visitor's address when rate limiting. Set it if the app is reachable from the internet (see below). |
| `ALLOW_PRIVATE_FEED_URLS` | unset | `true` lets an Instagram source use a feed address on your own network. By default only public addresses (and the bundled RSS-Bridge) are allowed. |
| `BACKUP_INTERVAL_HOURS` / `BACKUP_KEEP` | `24` / `14` | Automatic database backups (`0` turns them off). |

Everything lives in `data/`: the database, uploads, secrets and backups. Starting the container backs up the database and applies updates. It never resets your data.

**Updating:** `docker compose pull && docker compose up -d`. The version is shown in **Settings → About**.

**Restoring:** stop the app, copy a file from `data/backups/` over `data/cosplay.db`, and start it again.

**Forgot your password without email?**

```bash
docker exec -it cosplay-planner node scripts/reset-password.js --email user@example.com
```

**Moderators and admins:** admins are made with the `set-admin` command above. In the app, admins grant or remove the moderator role and can suspend an account under **Moderation → Users and roles**. A suspended person is signed out, can't log in, and their Community projects are hidden until restored. Nothing is deleted. The latest role changes and suspensions are listed on that page.

**Deleting an account:** people can delete their own account under **Account**. It needs their password and removes their projects, images and published pages for good. Admin accounts can't delete themselves: first remove the admin role with `docker exec cosplay-planner node scripts/set-admin.js --email you@example.com --remove`.

**Run one copy only.** The app keeps its database in a single SQLite file and runs its background jobs (guest clean-up, event and Instagram checks, rate-limit clean-up) inside the app itself, so don't start two containers on the same `data/` folder.

**Reaching it from outside your home:** use a Cloudflare Tunnel or Tailscale, and set `APP_URL` to the https address. Don't forward port 1337 on your router. Anyone who can reach a public address can register, so consider Cloudflare Access. Also set `TRUSTED_PROXY`: `cloudflare` behind a Cloudflare Tunnel, or `proxy` behind `tailscale serve`, nginx or Caddy. Without it the app accepts any forwarded-address header, which is fine on a home network but lets an outside visitor dodge the login limits.

## Roadmap

Email reminders for events you're going to.

## Contributing

Issues and pull requests are welcome. Please open an issue first for anything bigger than a small fix. Built with Next.js, TypeScript, Prisma (SQLite) and Playwright.

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev            # http://localhost:1337
npm run typecheck && npm run lint
npm run test:unit      # fast checks of the logic in src/lib
npm run test:e2e       # browser tests against a throwaway database
```

How the code is organised: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

See [CHANGELOG.md](CHANGELOG.md) for what has changed.

## License

No licence has been chosen yet, so all rights are reserved.
