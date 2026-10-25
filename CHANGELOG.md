# Changelog

Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Each release is a git tag (`v1.1.0`) and a Docker image tag (`1.1.0` and `1.1`).
`latest` always follows the newest commit on `main`.

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
