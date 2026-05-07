# Demo Guide

This guide gives reviewers a complete local walkthrough without requiring a real Discord server, Discord bot token, or GenLayer private key.

## One-Command Dashboard Demo

Run:

```bash
npm run demo:dashboard
```

The script will:

1. Create or refresh `./data/demo-monitor.db`.
2. Seed demo users, message metrics, message logs, proofs, role health reports, contest recognitions, and GenLayer evaluation records.
3. Start the view-only dashboard on `http://127.0.0.1:3000`.
4. Use `dev-dashboard-token` as the login token unless `WEB_ADMIN_TOKEN` is already set.

To force a specific demo month for the dashboard, set `DEMO_MONTH=YYYY-MM` in the shell before running the command.

Open:

```text
http://127.0.0.1:3000/login
```

Then enter:

```text
dev-dashboard-token
```

## Seed Only

To create demo data without starting the dashboard:

```bash
npm run demo:seed
```

Use a specific month or database path:

```bash
npm run demo:seed -- --month=2026-05 --database=./data/demo-monitor.db
```

The seed is idempotent for demo rows. It deletes and recreates users whose Discord IDs start with `demo-`, plus `demo-<month>-*` GenLayer evaluation records. It does not delete real users.

## What To Show In A Review

Recommended demo path:

1. Open the Summary tab and show total users, meaningful messages, spam flags, pending proofs, and latest GenLayer winner.
2. Open Leaderboard and show that the ranking includes meaningful messages, project posts, contest points, admin bonus, proofs, focus score, and risk level.
3. Open Logs and show recent Discord-style message logs with meaningful and spam flags.
4. Open Proofs and switch between `all`, `pending`, `approved`, and `rejected`.
5. Open Role Health and show Healthy, Watch, and Purge Risk examples.
6. Open GenLayer and show the stored `select_winner` and `evaluate_post` demo evaluations.

## Evidence Checklist

For grant, hackathon, or approval submissions, capture:

- dashboard summary screenshot
- leaderboard screenshot
- proofs tab screenshot
- GenLayer tab screenshot
- terminal screenshot showing `npm run demo:dashboard`
- optional Discord command screenshots from a real configured server
- optional GenLayer Studio contract read screenshot for the deployed contract

## Real Bot Flow

For a real Discord server, use `.env` with real Discord and GenLayer values, then run:

```bash
npm run db:init
npm run deploy:commands
npm start
```

The demo database is separate from the default production-style database if you keep `DATABASE_PATH=./data/demo-monitor.db` only for demo runs.
