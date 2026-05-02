# GenLayer Discord Contribution Monitor

An AI-driven Discord contribution monitoring system for GenLayer communities.

This project helps community managers track meaningful contribution, detect low-effort activity, monitor role health, review external proofs, and select a monthly standout contributor through a GenLayer intelligent contract.

Instead of rewarding users only by raw message volume, the system combines deterministic Discord metrics with AI-assisted evaluation for contribution quality, GenLayer relevance, originality, and spam risk.

## Highlights

- Discord bot built with `discord.js`
- SQLite persistence with `better-sqlite3`
- Daily message and monthly contribution tracking
- Low-effort and burst-spam detection
- Weekly project post tracking
- X/Twitter post and builder proof submission workflow
- Admin review commands for approved proofs and bonus points
- Role health reports for Brain, Neurocreative, and Singularity roles
- Scheduled role-risk alerts
- GenLayer intelligent contract for subjective contribution evaluation
- Monthly Nomi Singularity winner selection

## Why This Exists

Community contribution programs often depend on visible activity, but visible activity is easy to game. Raw Discord message counts can reward spam, generic hype, repeated messages, or low-effort engagement.

This project creates a more robust workflow:

1. Track measurable Discord and proof activity.
2. Apply caps and spam filters to reduce farming.
3. Summarize each user's contribution profile.
4. Use GenLayer AI consensus for higher-level judgment.
5. Help admins make consistent, explainable decisions.

## Architecture

```text
Discord Server
  |
  v
Discord Bot
  |
  +-- Message classifier
  +-- Slash command handler
  +-- Contest winner parser
  +-- Scheduled role health jobs
  |
  v
SQLite Database
  |
  +-- users
  +-- daily_user_metrics
  +-- weekly_post_metrics
  +-- contribution_proofs
  +-- contest_recognitions
  +-- role_health_reports
  +-- genlayer_evaluations
  |
  v
GenLayer Contract
  |
  +-- select_winner()
  +-- evaluate_post()
```

## Repository Layout

```text
.
├── contracts/
│   └── nomi_singularity.py
├── docs/
│   ├── build-and-run.md
│   ├── genlayer-contract.md
│   ├── genlayer-discord-monitoring-system.md
│   └── project-structure.svg
├── src/
│   ├── commands/
│   ├── db/
│   ├── events/
│   ├── jobs/
│   ├── repositories/
│   └── services/
├── test/
│   └── smoke.js
├── .env.example
├── package.json
└── README.md
```

## Core Workflow

### 1. Discord Activity Collection

The bot listens to Discord messages and records user activity. It tracks:

- valid messages
- meaningful messages
- low-effort messages
- spam flags
- GenLayer focus score
- active days

The classifier applies basic quality checks, including minimum message length, duplicate detection, low-effort pattern matching, daily caps, and burst-spam detection.

### 2. Project Post Tracking

Configured project post channels are handled separately. Long-form posts can be counted toward weekly project activity, with caps to avoid repeated farming.

### 3. Proof Submission and Review

Users can submit:

- X/Twitter posts
- builder proofs
- external contribution links

Admins can approve or reject these proofs and assign contribution points.

### 4. Role Health Monitoring

The system calculates monthly health for tracked roles:

- Brain
- Neurocreative
- Singularity

Risk levels include:

- Healthy
- Watch
- Warning
- Purge Risk
- Critical

Scheduled jobs can send alerts to an admin channel when users are at risk.

### 5. GenLayer Evaluation

The backend prepares a compact monthly candidate summary and sends it to the GenLayer contract.

The contract evaluates:

- meaningful activity
- GenLayer focus
- verified X posts
- builder proofs
- weekly contest points
- admin bonuses
- spam and risk signals
- overall contribution quality

The contract stores the AI consensus result and exposes it through view methods.

## GenLayer Contract

Contract file:

```text
contracts/nomi_singularity.py
```

Main methods:

- `select_winner(evaluation_id, candidates_json)`
- `evaluate_post(evaluation_id, post_json)`
- `get_evaluation(evaluation_id)`
- `get_latest_evaluation_id()`
- `get_all_evaluations()`

Verified deployed contract on GenLayer Studio Network:

```text
0x77319Ec77bAA4aA850518BEf2EcCB8e63f7d6Db3
```

## Slash Commands

Admin commands:

- `/role_health`
- `/purge_risk`
- `/nomi_singularity`
- `/review_x_post`
- `/admin_bonus`
- `/weekly_posts`

Member commands:

- `/submit_x_post`
- `/submit_builder_proof`
- `/my_contribution`

## Requirements

- Node.js 20+
- npm
- Discord bot token
- SQLite-compatible local filesystem
- GenLayer CLI, for contract deployment/testing
- Python 3.12+, for contract compile checks
- GenVM linter, for contract validation

## Setup

Install dependencies:

```bash
npm install
```

Copy the environment template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in the required Discord and GenLayer values in `.env`.

## Environment Variables

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=

DATABASE_PATH=./data/monitor.db

GENLAYER_RPC_URL=http://localhost:4000/api
NOMI_SINGULARITY_CONTRACT_ADDRESS=

ADMIN_ALERT_CHANNEL_ID=
PROJECT_POST_CHANNEL_IDS=
WINNER_ANNOUNCEMENT_CHANNEL_IDS=
OFFICIAL_ANNOUNCER_ROLE_IDS=

MEANINGFUL_MESSAGE_MIN_LENGTH=30
DAILY_MESSAGE_CAP=50
WEEKLY_POST_CAP=3
SPAM_BURST_WINDOW_SECONDS=10
SPAM_BURST_MAX_MESSAGES=5
```

For the deployed GenLayer Studio Network contract, set:

```env
NOMI_SINGULARITY_CONTRACT_ADDRESS=0x77319Ec77bAA4aA850518BEf2EcCB8e63f7d6Db3
```

Use the RPC URL that matches the network you are targeting.

## Database

Initialize the SQLite schema:

```bash
npm run db:init
```

The default database path is:

```text
./data/monitor.db
```

The database is ignored by Git.

## Run the Bot

Start the bot:

```bash
npm start
```

Development mode:

```bash
npm run dev
```

Deploy Discord slash commands:

```bash
npm run deploy:commands
```

## Tests

Run the smoke test:

```bash
npm test
```

The smoke test checks:

- monthly post aggregation
- ISO week rollover handling
- monthly contest point aggregation
- approved admin bonus points

## Contract Validation

Compile the contract:

```bash
python -m py_compile contracts/nomi_singularity.py
```

On Windows, if `python` points to the Microsoft Store alias:

```powershell
py -3.12 -m py_compile contracts\nomi_singularity.py
```

Run GenVM lint:

```bash
genvm-lint check contracts/nomi_singularity.py
```

On Windows, if Unicode output fails:

```powershell
$env:PYTHONIOENCODING='utf-8'
$env:PYTHONUTF8='1'
genvm-lint check contracts\nomi_singularity.py
```

Expected result:

```text
Lint passed
Validation passed
Contract: NomiSingularity
Methods: 5
```

## Deploy the Contract

Local GenLayer simulator:

```bash
genlayer up
```

Deploy locally:

```bash
genlayer deploy --contract contracts/nomi_singularity.py --rpc http://localhost:4000/api
```

Deploy using the currently configured GenLayer CLI network:

```bash
genlayer deploy --contract contracts/nomi_singularity.py
```

Read schema:

```bash
genlayer schema <contract-address>
```

Read latest evaluation:

```bash
genlayer call <contract-address> get_latest_evaluation_id
```

Read a stored evaluation:

```bash
genlayer call <contract-address> get_evaluation --args <evaluation-id>
```

## Example Candidate Payload

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

Example result:

```json
{
  "confidence": 95,
  "decision": "award",
  "winner_user_id": "885076515929333823",
  "reason": "Exhibits the strongest genuine contribution profile with high GenLayer focus, consistent monthly activity, zero spam flags, and multiple verified signals.",
  "risk_notes": []
}
```

## Example Post Evaluation Payload

```json
{
  "user_id": "885076515929333823",
  "source": "discord_project_post",
  "week": "2026-W18",
  "content_excerpt": "Detailed GenLayer project update covering intelligent contracts, validators, and practical builder progress.",
  "proof_urls": ["https://x.com/example/status/123"],
  "context": "Neurocreative weekly project post"
}
```

Example result:

```json
{
  "decision": "approve",
  "quality_score": 82,
  "originality_score": 78,
  "genlayer_focus_score": 95,
  "spam_risk": 8,
  "reason": "Substantial technical update covering core GenLayer concepts with evidence of practical builder progress."
}
```

## Design Notes

The backend does not send every Discord message to GenLayer. It only sends compact summaries or post excerpts that require subjective evaluation. This keeps the system cheaper, clearer, and easier to audit.

Most routine metrics are deterministic and stored locally. GenLayer is used only for high-value decisions where AI consensus is useful:

- monthly winner selection
- high-quality post evaluation
- originality and GenLayer focus scoring
- ambiguous contribution review

## Documentation

- [System Design](docs/genlayer-discord-monitoring-system.md)
- [GenLayer Contract](docs/genlayer-contract.md)
- [Build and Run Guide](docs/build-and-run.md)
- [Project Structure Image](docs/project-structure.svg)

## Security Notes

- Do not commit `.env`.
- Do not commit Discord bot tokens.
- Do not commit SQLite database files.
- Keep admin commands restricted with Discord permissions.
- Review proof URLs manually before awarding points.

## License

ISC
