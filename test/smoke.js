const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genlayer-monitor-test-'));
process.env.DATABASE_PATH = path.join(tempDir, 'monitor.db');

const { closeDb } = require('../src/db/connection');
const usersRepo = require('../src/repositories/users');
const postsRepo = require('../src/repositories/posts');
const contestsRepo = require('../src/repositories/contests');
const proofsRepo = require('../src/repositories/proofs');

try {
  const user = usersRepo.upsertUser('123', 'Test User');

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

  console.log('Smoke tests passed.');
} finally {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
