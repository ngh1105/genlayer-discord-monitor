const crypto = require('crypto');

const DEFAULT_DATABASE_PATH = './data/demo-monitor.db';
const DEMO_USER_PREFIX = 'demo-';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseArgs(argv) {
  return argv.reduce((options, arg) => {
    if (arg.startsWith('--month=')) options.month = arg.slice('--month='.length);
    if (arg.startsWith('--database=')) options.databasePath = arg.slice('--database='.length);
    return options;
  }, {});
}

function normalizeMonth(month) {
  const value = String(month || getCurrentMonth());
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error(`Invalid month "${value}". Expected YYYY-MM.`);
  }
  return value;
}

function dateForDay(month, day) {
  const [year, monthNumber] = month.split('-').map(Number);
  const maxDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(Math.min(day, maxDay)).padStart(2, '0')}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function firstMonday(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  const day = date.getUTCDay() || 7;
  return addDays(date.toISOString().slice(0, 10), (8 - day) % 7);
}

function isoWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function contestPoints(rank) {
  return { 1: 120, 2: 100, 3: 80, 4: 60, 5: 50 }[rank] || 0;
}

function hashContent(content) {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function deleteDemoRows(db, month) {
  const demoUsers = db.prepare(
    'SELECT id FROM users WHERE discord_user_id LIKE ?'
  ).all(`${DEMO_USER_PREFIX}%`);

  if (demoUsers.length > 0) {
    const placeholders = demoUsers.map(() => '?').join(',');
    const ids = demoUsers.map(user => user.id);
    for (const table of [
      'message_log',
      'role_health_reports',
      'contest_recognitions',
      'contribution_proofs',
      'weekly_post_metrics',
      'daily_user_metrics',
      'user_role_snapshots',
    ]) {
      db.prepare(`DELETE FROM ${table} WHERE user_id IN (${placeholders})`).run(...ids);
    }
  }

  db.prepare('DELETE FROM users WHERE discord_user_id LIKE ?').run(`${DEMO_USER_PREFIX}%`);
  db.prepare('DELETE FROM genlayer_evaluations WHERE evaluation_id LIKE ?').run(`demo-${month}-%`);
}

function seedDemo(options = {}) {
  if (options.databasePath) {
    process.env.DATABASE_PATH = options.databasePath;
  }

  const month = normalizeMonth(options.month || process.env.DEMO_MONTH);
  const databasePath = options.databasePath || process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH;
  process.env.DATABASE_PATH = databasePath;

  const { getDb } = require('./connection');
  const usersRepo = require('../repositories/users');
  const { getMonthlyLeaderboard } = require('../services/contribution-summary');
  const evaluationsRepo = require('../repositories/evaluations');

  const db = getDb();
  const weekOne = isoWeek(firstMonday(month));
  const weekTwo = isoWeek(addDays(firstMonday(month), 7));
  const weekThree = isoWeek(addDays(firstMonday(month), 14));

  const demoUsers = [
    {
      discordUserId: 'demo-ada',
      displayName: 'Ada IC Builder',
      roles: ['Brain', 'Neurocreative'],
      daily: [
        { day: 1, meaningful: 34, lowEffort: 2, focus: 92, minutes: 95 },
        { day: 5, meaningful: 38, focus: 96, minutes: 120 },
        { day: 10, meaningful: 42, lowEffort: 1, focus: 94, minutes: 135 },
        { day: 17, meaningful: 35, focus: 91, minutes: 110 },
        { day: 24, meaningful: 31, focus: 93, minutes: 90 },
      ],
      posts: [
        { week: weekOne, submitted: 1, valid: 1, highQuality: 1, quality: 94, points: 25 },
        { week: weekTwo, submitted: 1, valid: 1, highQuality: 1, quality: 88, points: 20 },
      ],
      proofs: [
        { source: 'x', status: 'approved', points: 25 },
        { source: 'builder_proof', status: 'approved', points: 40 },
        { source: 'admin_bonus', status: 'approved', points: 35 },
      ],
      contests: [{ week: weekTwo, rank: 1, xp: 5000 }],
      riskLevel: 'Healthy',
      reason: 'Sustained technical discussion, strong project posts, and verified build proof.',
    },
    {
      discordUserId: 'demo-max',
      displayName: 'Max Research',
      roles: ['Brain'],
      daily: [
        { day: 2, meaningful: 30, focus: 86, minutes: 85 },
        { day: 8, meaningful: 28, lowEffort: 2, focus: 88, minutes: 92 },
        { day: 13, meaningful: 27, focus: 84, minutes: 76 },
        { day: 19, meaningful: 25, spam: 1, focus: 82, minutes: 70 },
        { day: 23, meaningful: 24, focus: 85, minutes: 69 },
      ],
      posts: [
        { week: weekOne, submitted: 1, valid: 1, highQuality: 1, quality: 82, points: 15 },
      ],
      proofs: [
        { source: 'x', status: 'approved', points: 20 },
        { source: 'builder_proof', status: 'pending', points: 0 },
      ],
      contests: [{ week: weekThree, rank: 2, xp: 3000 }],
      riskLevel: 'Healthy',
      reason: 'Consistent research notes and one contest recognition.',
    },
    {
      discordUserId: 'demo-rin',
      displayName: 'Rin Community Ops',
      roles: ['Brain', 'Singularity'],
      daily: [
        { day: 3, meaningful: 22, lowEffort: 1, focus: 78, minutes: 80 },
        { day: 7, meaningful: 21, focus: 74, minutes: 64 },
        { day: 14, meaningful: 20, focus: 76, minutes: 72 },
        { day: 21, meaningful: 18, focus: 73, minutes: 55 },
      ],
      posts: [
        { week: weekTwo, submitted: 1, valid: 1, highQuality: 0, quality: 64, points: 5 },
      ],
      proofs: [
        { source: 'x', status: 'approved', points: 15 },
      ],
      contests: [],
      riskLevel: 'Watch',
      reason: 'Useful operational help, but lower technical depth this month.',
    },
    {
      discordUserId: 'demo-kai',
      displayName: 'Kai Burst Tester',
      roles: ['Brain'],
      daily: [
        { day: 4, meaningful: 12, lowEffort: 18, spam: 4, focus: 41, minutes: 35 },
        { day: 11, meaningful: 10, lowEffort: 16, spam: 3, focus: 45, minutes: 30 },
        { day: 18, meaningful: 8, lowEffort: 12, spam: 2, focus: 39, minutes: 24 },
      ],
      posts: [],
      proofs: [
        { source: 'x', status: 'rejected', points: 0 },
        { source: 'builder_proof', status: 'pending', points: 0 },
      ],
      contests: [],
      riskLevel: 'Purge Risk',
      reason: 'Repeated burst activity and low meaningful contribution count.',
    },
    {
      discordUserId: 'demo-noor',
      displayName: 'Noor Newcomer',
      roles: ['Neurocreative'],
      daily: [
        { day: 6, meaningful: 18, lowEffort: 1, focus: 69, minutes: 58 },
        { day: 15, meaningful: 16, focus: 71, minutes: 52 },
        { day: 22, meaningful: 14, focus: 73, minutes: 45 },
      ],
      posts: [
        { week: weekThree, submitted: 1, valid: 1, highQuality: 1, quality: 79, points: 12 },
      ],
      proofs: [
        { source: 'builder_proof', status: 'approved', points: 25 },
      ],
      contests: [],
      riskLevel: 'Healthy',
      reason: 'New contributor with one promising project proof.',
    },
  ];

  const insertDaily = db.prepare(`
    INSERT INTO daily_user_metrics
      (user_id, date, valid_messages, meaningful_messages, low_effort_messages, spam_flags, active_minutes, genlayer_focus_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPost = db.prepare(`
    INSERT INTO weekly_post_metrics
      (user_id, week, submitted_posts, valid_posts, high_quality_posts, quality_score, points)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, week) DO UPDATE SET
      submitted_posts = submitted_posts + excluded.submitted_posts,
      valid_posts = valid_posts + excluded.valid_posts,
      high_quality_posts = high_quality_posts + excluded.high_quality_posts,
      quality_score = MAX(quality_score, excluded.quality_score),
      points = points + excluded.points
  `);
  const insertProof = db.prepare(`
    INSERT INTO contribution_proofs
      (user_id, source, url, message_id, channel_id, month, status, points, reviewed_by, created_at, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertContest = db.prepare(`
    INSERT INTO contest_recognitions
      (user_id, event_type, week, rank, external_xp, internal_points, source_message_id, proof_urls_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHealth = db.prepare(`
    INSERT INTO role_health_reports
      (user_id, role_name, month, risk_level, reason, metrics_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMessage = db.prepare(`
    INSERT INTO message_log
      (user_id, channel_id, message_id, content_hash, content_length, is_meaningful, is_spam, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    deleteDemoRows(db, month);

    for (const demo of demoUsers) {
      const user = usersRepo.upsertUser(demo.discordUserId, demo.displayName);
      usersRepo.snapshotRoles(user.id, demo.roles);

      for (const row of demo.daily) {
        const valid = row.meaningful + (row.lowEffort || 0);
        insertDaily.run(
          user.id,
          dateForDay(month, row.day),
          valid,
          row.meaningful,
          row.lowEffort || 0,
          row.spam || 0,
          row.minutes || 0,
          row.focus || 0
        );
      }

      for (const post of demo.posts) {
        insertPost.run(
          user.id,
          post.week,
          post.submitted,
          post.valid,
          post.highQuality,
          post.quality,
          post.points
        );
      }

      demo.proofs.forEach((proof, index) => {
        const createdAt = `${dateForDay(month, 9 + index)} 12:0${index}:00`;
        const reviewedAt = proof.status === 'pending' ? null : `${dateForDay(month, 10 + index)} 09:15:00`;
        insertProof.run(
          user.id,
          proof.source,
          `https://example.com/${demo.discordUserId}/${proof.source}/${month}/${index + 1}`,
          `${demo.discordUserId}-proof-${index + 1}`,
          'demo-proof-channel',
          month,
          proof.status,
          proof.points,
          proof.status === 'pending' ? null : 'demo-admin',
          createdAt,
          reviewedAt
        );
      });

      demo.contests.forEach((contest, index) => {
        insertContest.run(
          user.id,
          'neurocreative_challenge',
          contest.week,
          contest.rank,
          contest.xp,
          contestPoints(contest.rank),
          `${demo.discordUserId}-contest-${index + 1}`,
          JSON.stringify([`https://example.com/contest/${demo.discordUserId}/${index + 1}`]),
          `${dateForDay(month, 16 + index)} 18:00:00`
        );
      });

      for (const role of demo.roles) {
        insertHealth.run(
          user.id,
          role,
          month,
          demo.riskLevel,
          demo.reason,
          JSON.stringify({
            meaningful_messages: demo.daily.reduce((sum, row) => sum + row.meaningful, 0),
            spam_flags: demo.daily.reduce((sum, row) => sum + (row.spam || 0), 0),
            focus_score: Math.round(demo.daily.reduce((sum, row) => sum + row.focus, 0) / demo.daily.length),
          }),
          `${dateForDay(month, 25)} 08:30:00`
        );
      }

      demo.daily.slice(0, 3).forEach((row, index) => {
        const content = `${demo.displayName} demo message ${index + 1} about GenLayer contribution quality and community progress.`;
        insertMessage.run(
          user.id,
          index % 2 === 0 ? 'demo-general' : 'demo-builders',
          `${demo.discordUserId}-message-${index + 1}`,
          hashContent(content),
          content.length,
          row.meaningful > 15 ? 1 : 0,
          row.spam ? 1 : 0,
          `${dateForDay(month, row.day)} 14:${String(index * 7).padStart(2, '0')}:00`
        );
      });
    }
  });

  tx();

  const leaderboard = getMonthlyLeaderboard({ month, role: 'Brain' });
  const winner = leaderboard[0];
  evaluationsRepo.saveEvaluation({
    evaluationId: `demo-${month}-nomi-singularity`,
    taskType: 'select_winner',
    month,
    inputSummary: {
      month,
      eligible_role: 'Brain',
      candidates: leaderboard.slice(0, 5).map(row => ({
        user_id: row.discord_user_id,
        display_name: row.display_name,
        score: row.score,
        meaningful_messages: row.meaningful_messages,
        high_quality_posts: row.high_quality_posts,
        weekly_contest_points: row.weekly_contest_points,
        admin_bonus: row.admin_bonus,
        risk_level: row.risk_level,
      })),
    },
    result: {
      decision: 'award',
      winner_user_id: winner?.discord_user_id || '',
      winner_display_name: winner?.display_name || '',
      confidence: 92,
      reason: 'Demo evaluation selects the strongest monthly contributor using meaningful activity, verified proofs, contest points, admin bonus, and risk signals.',
      risk_notes: leaderboard.filter(row => row.risk_level !== 'Healthy').map(row => `${row.display_name}: ${row.risk_level}`),
    },
    confidence: 92,
    txHash: `0x${'d'.repeat(64)}`,
    source: 'demo',
  });

  evaluationsRepo.saveEvaluation({
    evaluationId: `demo-${month}-post-evaluation`,
    taskType: 'evaluate_post',
    month,
    inputSummary: {
      source: 'discord_project_post',
      week: weekOne,
      content_excerpt: 'Demo post describing an intelligent contract monitoring workflow and dashboard evidence.',
    },
    result: {
      decision: 'approve',
      quality_score: 88,
      originality_score: 84,
      genlayer_focus_score: 94,
      spam_risk: 4,
      reason: 'The post is specific, technical, and tied to visible project progress.',
    },
    confidence: 88,
    source: 'demo',
  });

  const totalUsers = db.prepare('SELECT COUNT(*) AS total FROM users WHERE discord_user_id LIKE ?').get(`${DEMO_USER_PREFIX}%`).total;
  return {
    month,
    databasePath,
    totalUsers,
    leaderboardRows: leaderboard.length,
    winner: winner?.displayName || winner?.display_name || '',
  };
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  if (!options.databasePath && !process.env.DATABASE_PATH) {
    options.databasePath = DEFAULT_DATABASE_PATH;
  }

  try {
    const result = seedDemo(options);
    console.log(`Seeded demo data for ${result.month}.`);
    console.log(`Database: ${result.databasePath}`);
    console.log(`Demo users: ${result.totalUsers}`);
    console.log(`Brain leaderboard rows: ${result.leaderboardRows}`);
    console.log(`Demo winner: ${result.winner}`);
  } catch (err) {
    console.error('Failed to seed demo data:', err.message);
    process.exitCode = 1;
  } finally {
    const { closeDb } = require('./connection');
    closeDb();
  }
}

module.exports = { seedDemo };
