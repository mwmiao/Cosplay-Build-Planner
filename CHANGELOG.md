# Changelog

Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Each release is a git tag (`v1.1.0`) and a Docker image tag (`1.1.0` and `1.1`).
`latest` always follows the newest commit on `main`.

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
