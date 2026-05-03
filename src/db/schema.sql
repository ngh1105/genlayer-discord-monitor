-- GenLayer Discord Contribution Monitor - Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_user_id);

-- User role snapshots
CREATE TABLE IF NOT EXISTS user_role_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role_name TEXT NOT NULL,
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_role_snapshots_user ON user_role_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_role_snapshots_role ON user_role_snapshots(role_name);

-- Daily user metrics
CREATE TABLE IF NOT EXISTS daily_user_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  valid_messages INTEGER NOT NULL DEFAULT 0,
  meaningful_messages INTEGER NOT NULL DEFAULT 0,
  low_effort_messages INTEGER NOT NULL DEFAULT 0,
  spam_flags INTEGER NOT NULL DEFAULT 0,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  genlayer_focus_score INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_date ON daily_user_metrics(user_id, date);

-- Weekly post metrics
CREATE TABLE IF NOT EXISTS weekly_post_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  week TEXT NOT NULL,
  submitted_posts INTEGER NOT NULL DEFAULT 0,
  valid_posts INTEGER NOT NULL DEFAULT 0,
  high_quality_posts INTEGER NOT NULL DEFAULT 0,
  quality_score INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, week)
);

CREATE INDEX IF NOT EXISTS idx_weekly_posts_user_week ON weekly_post_metrics(user_id, week);

-- Contribution proofs (X posts, builder proofs, etc.)
CREATE TABLE IF NOT EXISTS contribution_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  message_id TEXT,
  channel_id TEXT,
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  points INTEGER NOT NULL DEFAULT 0,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  UNIQUE(url)
);

CREATE INDEX IF NOT EXISTS idx_proofs_user ON contribution_proofs(user_id);
CREATE INDEX IF NOT EXISTS idx_proofs_status ON contribution_proofs(status);
CREATE INDEX IF NOT EXISTS idx_proofs_month ON contribution_proofs(month);

-- Contest recognitions
CREATE TABLE IF NOT EXISTS contest_recognitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  week TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 0,
  external_xp INTEGER NOT NULL DEFAULT 0,
  internal_points INTEGER NOT NULL DEFAULT 0,
  source_message_id TEXT,
  proof_urls_json TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contest_user ON contest_recognitions(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_week ON contest_recognitions(week);

-- Role health reports
CREATE TABLE IF NOT EXISTS role_health_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role_name TEXT NOT NULL,
  month TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'Healthy',
  reason TEXT NOT NULL DEFAULT '',
  metrics_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_user ON role_health_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_health_month ON role_health_reports(month);
CREATE INDEX IF NOT EXISTS idx_health_risk ON role_health_reports(risk_level);

-- GenLayer evaluations
CREATE TABLE IF NOT EXISTS genlayer_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id TEXT NOT NULL UNIQUE,
  task_type TEXT NOT NULL,
  month TEXT NOT NULL,
  input_summary_json TEXT DEFAULT '{}',
  result_json TEXT DEFAULT '{}',
  confidence INTEGER NOT NULL DEFAULT 0,
  tx_hash TEXT,
  source TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_evaluations_type ON genlayer_evaluations(task_type);
CREATE INDEX IF NOT EXISTS idx_evaluations_month ON genlayer_evaluations(month);

-- Message tracking for spam detection (rolling window, pruned daily)
CREATE TABLE IF NOT EXISTS message_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  content_length INTEGER NOT NULL DEFAULT 0,
  is_meaningful INTEGER NOT NULL DEFAULT 0,
  is_spam INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_msglog_user_time ON message_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msglog_hash ON message_log(content_hash);
