# Operations Checklist

This is the minimum checklist before running the monitor for a real community.

## Local Safety

- Keep `WEB_BIND_HOST=127.0.0.1` for local use.
- Use a long random `WEB_ADMIN_TOKEN`.
- Do not commit `.env` or SQLite database files.
- Keep demo data in `./data/demo-monitor.db` and real data in a separate path.

## Public Dashboard

- Put the dashboard behind HTTPS before exposing it publicly.
- Set `WEB_PUBLIC_URL=https://your-domain.example` so cookies use the secure flag.
- Bind to an explicit deploy host only when needed, for example `WEB_BIND_HOST=0.0.0.0`.
- Use `/healthz` as the platform health check path.
- Restrict inbound access at the platform or reverse-proxy layer when possible.
- Rotate `WEB_ADMIN_TOKEN` after demos or public recordings.
- Use the dashboard Logout button after shared-screen demos.
- Treat the built-in login throttling as a basic guard, not a replacement for a private network or reverse-proxy protection.

## Docker And Render

- Build locally with `docker build -t genlayer-discord-monitor .`.
- Run with a mounted data directory so SQLite survives restarts.
- Render can use the included `render.yaml` blueprint.
- Keep `WEB_DASHBOARD_ENABLED=true` on Render so `/healthz` is available.
- Render sets `PORT`; the app uses it automatically when `WEB_PORT` is not set.
- Set all `sync: false` values in the Render dashboard before the first deploy.

## Database

- Use a persistent disk or volume for `DATABASE_PATH`.
- Back up the SQLite database before role-health purges, major releases, and deploy migrations.
- Keep WAL sidecar files with the database during backup windows if the bot is running.
- Test restore into a separate path before relying on a backup.

## GenLayer

- Keep `GENLAYER_RPC_URL` and `NOMI_SINGULARITY_CONTRACT_ADDRESS` on the same network.
- Use `GENLAYER_PRIVATE_KEY` only on machines allowed to write contract transactions.
- Read-only dashboard health should work without a private key.
- Run write tests against Studio only when the key is funded and intentionally configured.
- Record tx hashes and local fallback errors from the GenLayer tab after each monthly run.

## CI And Release

- Run `npm run check` before merging.
- Run `python -m py_compile contracts/nomi_singularity.py`.
- Run `genvm-lint check contracts/nomi_singularity.py` when GenVM tooling is available.
- Confirm `npm audit` has no actionable production dependency findings.
- Tag public demo releases after README, demo data, and dashboard screenshots are current.
