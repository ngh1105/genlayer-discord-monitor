const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genlayer-monitor-test-'));
process.env.DATABASE_PATH = path.join(tempDir, 'monitor.db');

const { closeDb } = require('../src/db/connection');
const usersRepo = require('../src/repositories/users');
const metricsRepo = require('../src/repositories/metrics');
const postsRepo = require('../src/repositories/posts');
const contestsRepo = require('../src/repositories/contests');
const proofsRepo = require('../src/repositories/proofs');
const healthRepo = require('../src/repositories/health');
const evaluationsRepo = require('../src/repositories/evaluations');
const dashboardData = require('../src/web/dashboard-data');
const config = require('../src/config');
const { createWebDashboardApp } = require('../src/web/server');
const { buildNomiCandidatePayload } = require('../src/services/contribution-summary');
const { runNomiSingularity } = require('../src/services/nomi-singularity');

function request(server, { method = 'GET', path: requestPath, headers = {}, body = '' }) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({
      method,
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      headers: {
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    return await fn(server);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function main() {
  try {
  const user = usersRepo.upsertUser('123', 'Test User');
  usersRepo.snapshotRoles(user.id, ['Brain']);
  metricsRepo.incrementMessages(user.id, '2026-05-01', { meaningful: true });
  metricsRepo.incrementMessages(user.id, '2026-05-02', { lowEffort: true, spam: true });
  metricsRepo.updateFocusScore(user.id, '2026-05-01', 80);

  postsRepo.incrementSubmittedPosts(user.id, '2026-W18');
  postsRepo.markPostValid(user.id, '2026-W18', { highQuality: true, qualityScore: 90, points: 10 });
  postsRepo.incrementSubmittedPosts(user.id, '2026-W19');
  postsRepo.markPostValid(user.id, '2026-W19', { highQuality: true, qualityScore: 70, points: 10 });

  assert.deepStrictEqual(postsRepo.getMonthlyPostSummary(user.id, '2026-05'), {
    totalSubmitted: 1,
    totalValid: 1,
    totalHighQuality: 1,
    bestQualityScore: 70,
    totalPoints: 10,
  });

  contestsRepo.addRecognition(user.id, {
    eventType: 'neurocreative_challenge',
    week: '2026-W18',
    rank: 1,
    externalXp: 5000,
  });
  contestsRepo.addRecognition(user.id, {
    eventType: 'neurocreative_challenge',
    week: '2026-W19',
    rank: 2,
    externalXp: 3000,
  });

  assert.strictEqual(contestsRepo.getMonthlyContestPoints(user.id, '2026-05'), 100);

  postsRepo.incrementSubmittedPosts(user.id, '2025-W01');
  postsRepo.markPostValid(user.id, '2025-W01', { highQuality: false, points: 10 });
  assert.strictEqual(postsRepo.getMonthlyPostSummary(user.id, '2024-12').totalSubmitted, 1);

  contestsRepo.addRecognition(user.id, {
    eventType: 'neurocreative_challenge',
    week: '2025-W01',
    rank: 3,
    externalXp: 1000,
  });
  assert.strictEqual(contestsRepo.getMonthlyContestPoints(user.id, '2024-12'), 80);

  const proofResult = proofsRepo.addProof(user.id, {
    source: 'admin_bonus',
    url: 'admin-bonus-test',
    month: '2026-05',
  });
  assert.strictEqual(proofResult.success, true);
  proofsRepo.reviewProof(1, { status: 'approved', points: 25, reviewedBy: 'admin' });
  assert.strictEqual(proofsRepo.getApprovedAdminBonusPoints(user.id, '2026-05'), 25);

  healthRepo.saveReport(user.id, {
    roleName: 'Brain',
    month: '2026-05',
    riskLevel: 'Healthy',
    reason: 'Consistent contribution.',
    metricsJson: { meaningful_messages: 1 },
  });
  evaluationsRepo.saveEvaluation({
    evaluationId: '2026-05-smoke-existing',
    taskType: 'select_winner',
    month: '2026-05',
    inputSummary: { candidates: [{ user_id: '123' }] },
    result: { winner_user_id: '123', confidence: 90 },
    confidence: 90,
    txHash: '0xabc',
  });

  const summary = dashboardData.getSummary('2026-05');
  assert.strictEqual(summary.total_users, 1);
  assert.strictEqual(summary.meaningful_messages, 1);
  assert.strictEqual(summary.spam_flags, 1);
  assert.strictEqual(summary.latest_evaluation.result.winner_user_id, '123');

  const leaderboard = dashboardData.getLeaderboard({ month: '2026-05', role: 'Brain' });
  assert.strictEqual(leaderboard.length, 1);
  assert.strictEqual(leaderboard[0].discord_user_id, '123');
  assert.strictEqual(leaderboard[0].admin_bonus, 25);
  assert.strictEqual(leaderboard[0].risk_level, 'Healthy');

  assert.strictEqual(dashboardData.getProofs({ month: '2026-05', status: 'all' }).length, 1);
  assert.strictEqual(dashboardData.getRoleHealth({ month: '2026-05', role: 'Brain' }).length, 1);
  assert.strictEqual(dashboardData.getGenLayerEvaluations('2026-05')[0].confidence, 90);

  const highUser = usersRepo.upsertUser('456', 'High User');
  const midUser = usersRepo.upsertUser('789', 'Mid User');
  usersRepo.snapshotRoles(highUser.id, ['Brain']);
  usersRepo.snapshotRoles(midUser.id, ['Brain']);
  for (let i = 0; i < 60; i += 1) {
    metricsRepo.incrementMessages(highUser.id, '2026-05-03', { meaningful: true });
  }
  for (let i = 0; i < 55; i += 1) {
    metricsRepo.incrementMessages(midUser.id, '2026-05-03', { meaningful: true });
  }
  metricsRepo.updateFocusScore(highUser.id, '2026-05-03', 90);
  metricsRepo.updateFocusScore(midUser.id, '2026-05-03', 20);

  const nomiPayload = buildNomiCandidatePayload({ month: '2026-05', minimumMeaningfulMessages: 50 });
  assert.deepStrictEqual(nomiPayload.candidates.map(c => c.user_id), ['456', '789']);
  const nomiResult = await runNomiSingularity('2026-05');
  assert.strictEqual(nomiResult.result.winner_user_id, '456');
  assert.strictEqual(evaluationsRepo.getEvaluation('2026-05-nomi-singularity').source, 'local');

  const previousToken = config.WEB_ADMIN_TOKEN;
  config.WEB_ADMIN_TOKEN = '';
  await withServer(createWebDashboardApp(), async (server) => {
    const health = await request(server, { path: '/healthz' });
    assert.strictEqual(health.statusCode, 200);
    assert.strictEqual(JSON.parse(health.body).ok, true);

    const res = await request(server, { path: '/api/dashboard/summary?month=2026-05' });
    assert.strictEqual(res.statusCode, 503);
  });

  config.WEB_ADMIN_TOKEN = 'test-token';
  await withServer(createWebDashboardApp(), async (server) => {
    const unauth = await request(server, { path: '/api/dashboard/summary?month=2026-05' });
    assert.strictEqual(unauth.statusCode, 401);

    const badLogin = await request(server, {
      method: 'POST',
      path: '/login',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'token=bad-token',
    });
    assert.strictEqual(badLogin.statusCode, 401);

    const login = await request(server, {
      method: 'POST',
      path: '/login',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'token=test-token',
    });
    assert.strictEqual(login.statusCode, 302);
    assert.ok(login.headers['set-cookie']?.some(cookie => cookie.includes('dashboard_token=')));

    const html = await request(server, {
      path: '/',
      headers: { Cookie: login.headers['set-cookie'][0].split(';')[0] },
    });
    assert.strictEqual(html.statusCode, 200);
    assert.ok(html.body.includes('GenLayer Monitor'));
    assert.ok(html.body.includes('Logout'));

    const logout = await request(server, {
      method: 'POST',
      path: '/logout',
      headers: { Cookie: login.headers['set-cookie'][0].split(';')[0] },
    });
    assert.strictEqual(logout.statusCode, 302);
    assert.ok(logout.headers['set-cookie']?.some(cookie => cookie.includes('dashboard_token=')));

    const authedHeaders = { Authorization: 'Bearer test-token' };
    for (const endpoint of [
      '/api/dashboard/summary?month=2026-05',
      '/api/dashboard/leaderboard?month=2026-05&role=Brain',
      '/api/dashboard/message-logs?limit=5',
      '/api/dashboard/proofs?month=2026-05&status=all',
      '/api/dashboard/role-health?month=2026-05&role=Brain',
      '/api/dashboard/genlayer-evaluations?month=2026-05',
      '/api/dashboard/genlayer-health?month=2026-05',
    ]) {
      const res = await request(server, { path: endpoint, headers: authedHeaders });
      assert.strictEqual(res.statusCode, 200, endpoint);
      JSON.parse(res.body);
    }

    const emptyProofs = await request(server, {
      path: '/api/dashboard/proofs?month=2030-01&status=all',
      headers: authedHeaders,
    });
    assert.deepStrictEqual(JSON.parse(emptyProofs.body), []);
  });
  config.WEB_ADMIN_TOKEN = previousToken;

  console.log('Smoke tests passed.');
  } finally {
    closeDb();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
