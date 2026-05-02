# Nomi Singularity GenLayer Contract

Contract file:

- `contracts/nomi_singularity.py`

## Purpose

This contract is the GenLayer evaluation layer for the Discord contribution monitor.
It does not monitor Discord directly. The backend sends summarized candidate data,
and the contract uses GenLayer consensus to evaluate subjective criteria such as:

- genuine engagement
- GenLayer focus
- originality
- low-effort or spam risk
- whether a Brain user deserves Nomi Singularity for the month

## Public Methods

### `select_winner(evaluation_id, candidates_json)`

Selects one monthly Nomi Singularity winner from a backend-prepared candidate list.

Input shape:

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

Output:

```json
{
  "winner_user_id": "885076515929333823",
  "confidence": 91,
  "decision": "award",
  "reason": "Most consistent meaningful engagement with clear GenLayer alignment.",
  "risk_notes": []
}
```

### `evaluate_post(evaluation_id, post_json)`

Evaluates a single post/proof for quality and GenLayer relevance.

Input shape:

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

Output:

```json
{
  "decision": "approve",
  "quality_score": 84,
  "originality_score": 80,
  "genlayer_focus_score": 92,
  "spam_risk": 8,
  "reason": "Original, useful, and clearly related to GenLayer."
}
```

## Backend Integration Flow

```text
1. Backend tracks Discord metrics all month.
2. Backend calculates role health and filters eligible Brain users.
3. Admin runs /nomi_singularity.
4. Backend sends top 3-10 candidate summaries to select_winner().
5. Contract stores the evaluation result by evaluation_id.
6. Bot reads the result and posts it to the admin channel.
```

## Deployment

Example local deployment:

```bash
genlayer deploy --contract contracts/nomi_singularity.py --rpc http://localhost:4000/api
```

GenLayer docs used for this implementation:

- https://docs.genlayer.com/developers/intelligent-contracts/first-contract
- https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle
- https://docs.genlayer.com/developers/intelligent-contracts/testing

