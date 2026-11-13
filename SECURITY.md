# Security of Cosplay Build Planner

Cosplay Build Planner is a **personal, self-hosted** app with real accounts. It is meant to run on your own server, for you and people you trust. Anyone who can reach its address can register, so put it behind Cloudflare Access, Tailscale or a similar layer if you don't want that.

## How it protects you

| Area | What it does |
|---|---|
| **Accounts** | Email and password through Better Auth. Sessions are checked against the database on every request. Admins can suspend an account: the person is signed out, can't log in, and their Community projects are hidden. |
| **Access checks** | Every page, server action and route handler verifies who is asking. A unit test (`tests-unit/route-auth.test.ts`) fails if one is added without such a check, unless it is on a short list of deliberately public ones. |
| **Rate limits** | Login, registration, password reset and guest creation are limited in the database, per address, per address and account, and per account. Copying a Community project and the public list are limited too. |
| **Trusted proxy** | `TRUSTED_PROXY` decides which request header identifies the visitor (`cloudflare` or `proxy`). Without it, any forwarded-address header is accepted. |
| **Headers and CSP** | Security headers and a Content-Security-Policy are set in `next.config.mjs`, plus HSTS when served over https. |
| **Outgoing links** | Links from outside the app (event sources, feeds) must be http(s). Feed addresses typed by an admin must not point at private network addresses, unless you set `ALLOW_PRIVATE_FEED_URLS`. |
| **Photos** | Location data is removed from uploads. Guests' images are stored encrypted, and Community images are only served while the project is published and its owner isn't suspended. |
| **Your data** | You can download everything in your account as one file, or delete the account and all its data. Deleting needs your password. |
| **Destructive actions** | Deleting, suspending and role changes ask for confirmation. Role changes and suspensions are recorded and shown to admins. |
| **Backups** | The database is backed up when the container starts and on a schedule (`BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP`). Starting the container never resets your data. |

## Known limits

- **Open registration.** Anyone who can reach the address can create an account.
- **The CSP allows inline scripts**, because Next.js and the theme script need them.
- **Run one copy only.** The database is a single SQLite file and background jobs run inside the app, so don't start two containers on the same `data/` folder.
- **Secrets and data share one folder.** `data/` holds the database, uploads, secrets and backups. Protect that folder like the rest of your server.
- **Guest data** is removed after 30 days unless the guest registers.

## Reporting a problem

Open an issue on the repository, without passwords, keys or personal data in it. For something sensitive, contact [@mwmiao](https://github.com/mwmiao) through GitHub first and share details privately.
