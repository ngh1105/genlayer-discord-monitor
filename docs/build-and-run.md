# Build and Run Guide

This guide explains how to validate, deploy, and integrate the GenLayer contract for the Discord contribution monitor.

## 1. Repository Layout

```text
.
├── README.md
├── contracts/
│   └── nomi_singularity.py
└── docs/
    ├── build-and-run.md
    ├── genlayer-contract.md
    ├── genlayer-discord-monitoring-system.md
    └── project-structure.svg
```

## 2. Requirements

Required tools:

- GenLayer CLI
- GenVM linter
- Python 3.12+
- Node.js, if using the GenLayer CLI installed through npm

Current verified local tools:

```text
genlayer
genvm-lint
```

On this machine, the working linter binary is:

```powershell
C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\Scripts\genvm-lint.exe
```

## 3. Install Tooling

If tooling is not available yet, install the official GenLayer CLI:

```powershell
npm install -g genlayer
```

Install the GenVM linter:

```powershell
python -m pip install genvm-linter
```

If Windows has multiple Python installs, use the Python executable that has the correct packages installed.

## 4. Validate Contract Syntax

Run Python compile check:

```powershell
python -m py_compile contracts\nomi_singularity.py
```

If the default `python` alias points to Microsoft Store and fails, use a real Python path:

```powershell
py -3.12 -m py_compile contracts\nomi_singularity.py
```

## 5. Run GenVM Linter

Recommended command:

```powershell
genvm-lint check contracts\nomi_singularity.py
```

If Windows terminal fails to print Unicode symbols, force UTF-8:

```powershell
$env:PYTHONIOENCODING='utf-8'
$env:PYTHONUTF8='1'
genvm-lint check contracts\nomi_singularity.py
```

Verified result:

```text
✓ Lint passed (3 checks)
✓ Validation passed
  Contract: NomiSingularity
  Methods: 5 (3 view, 2 write)
```

## 6. Start Local GenLayer Simulator

Start localnet:

```powershell
genlayer up
```

In another terminal, confirm CLI access:

```powershell
genlayer account
```

If needed, check available localnet commands:

```powershell
genlayer localnet --help
```

## 7. Deploy Contract

Deploy to local simulator:

```powershell
genlayer deploy --contract contracts\nomi_singularity.py --rpc http://localhost:4000/api
```

Save the deployed contract address in backend configuration:

```env
GENLAYER_RPC_URL=http://localhost:4000/api
NOMI_SINGULARITY_CONTRACT_ADDRESS=<contract-address>
```

## 8. Read Contract Schema

After deployment:

```powershell
genlayer schema <contract-address> --rpc http://localhost:4000/api
```

The expected methods are:

- `select_winner`
- `evaluate_post`
- `get_evaluation`
- `get_latest_evaluation_id`
- `get_all_evaluations`

## 9. Call `select_winner`

Create a candidate payload in the backend and send it as JSON string.

Example payload:

```json
{
  "month": "2026-05",
  "eligible_role": "Brain",
  "candidates": [
    {
      "user_id": "885076515929333823",
      "roles": ["Brain", "Neurocreative"],
      "active_days": 24,
      "meaningful_messages": 168,
      "high_quality_posts": 2,
      "weekly_contest_points": 120,
      "x_approved_posts": 1,
      "builder_proofs": 1,
      "admin_bonus": 30,
      "genlayer_focus_score": 91,
      "spam_flags": 0,
      "risk_level": "Healthy",
      "summary": "Consistent GenLayer discussions, original weekly posts, and verified X contribution."
    }
  ]
}
```

Write transaction:

```powershell
genlayer write <contract-address> select_winner --rpc http://localhost:4000/api --args "2026-05-nomi-singularity" "<candidates-json-string>"
```

Then read the result:

```powershell
genlayer call <contract-address> get_evaluation --rpc http://localhost:4000/api --args "2026-05-nomi-singularity"
```

## 10. Call `evaluate_post`

Example payload:

```json
{
  "user_id": "885076515929333823",
  "source": "discord_project_post",
  "week": "2026-W18",
  "content_excerpt": "Post excerpt here...",
  "proof_urls": ["https://x.com/example/status/123"],
  "context": "Neurocreative weekly project post"
}
```

Write transaction:

```powershell
genlayer write <contract-address> evaluate_post --rpc http://localhost:4000/api --args "2026-W18-post-885076515929333823-001" "<post-json-string>"
```

Read result:

```powershell
genlayer call <contract-address> get_evaluation --rpc http://localhost:4000/api --args "2026-W18-post-885076515929333823-001"
```

## 11. Backend Integration

Backend should not send all Discord chat to GenLayer.

Backend should send only:

- top 3-10 Nomi candidates
- role health summary
- weekly post excerpts
- official winner proof records
- approved X proof counts
- spam/risk summary

Recommended backend flow for `/nomi_singularity`:

```text
1. Admin runs /nomi_singularity.
2. Backend queries monthly Brain users.
3. Backend filters out Purge Risk and Critical users.
4. Backend ranks candidates by monthly contribution score.
5. Backend builds a compact candidates_json payload.
6. Backend calls select_winner().
7. Backend stores tx id and evaluation_id.
8. Bot posts the returned winner and reason to admin channel.
```

## 12. Discord Bot Environment Variables

Suggested `.env` keys:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DATABASE_URL=
GENLAYER_RPC_URL=http://localhost:4000/api
NOMI_SINGULARITY_CONTRACT_ADDRESS=
ADMIN_ALERT_CHANNEL_ID=
PROJECT_POST_CHANNEL_IDS=
WINNER_ANNOUNCEMENT_CHANNEL_IDS=
OFFICIAL_ANNOUNCER_ROLE_IDS=
```

## 13. Build Order

Recommended implementation order:

```text
1. Build database schema.
2. Build Discord event collector.
3. Build daily message metrics.
4. Build weekly post tracker.
5. Build official contest winner parser.
6. Build role health reports and alerts.
7. Deploy GenLayer contract.
8. Connect backend to select_winner().
9. Add evaluate_post() for post quality review.
10. Add admin slash commands.
```

## 14. Troubleshooting

### `python` opens Microsoft Store

Use:

```powershell
py -3.12
```

or a full Python path.

### `genvm-lint` exits with no output

The executable may point to a broken Python install. Run:

```powershell
where.exe genvm-lint
```

Then use a known working linter binary or reinstall:

```powershell
python -m pip install genvm-linter
```

### UnicodeEncodeError on Windows

Set UTF-8:

```powershell
$env:PYTHONIOENCODING='utf-8'
$env:PYTHONUTF8='1'
```

### Linter reports non-deterministic storage writes

Do not write contract storage inside a non-deterministic block.

Correct pattern:

```text
1. Run gl.vm.run_nondet_unsafe(...)
2. Normalize deterministic result
3. Write to storage after nondet call returns
```

