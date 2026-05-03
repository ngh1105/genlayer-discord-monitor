const evaluationsRepo = require('../repositories/evaluations');
const { buildNomiCandidatePayload } = require('./contribution-summary');
const genlayer = require('./genlayer-client');

/**
 * Build candidate list and run Nomi Singularity selection.
 */
async function runNomiSingularity(month) {
  const payload = buildNomiCandidatePayload({ month, role: 'Brain' });
  const topCandidates = payload.candidates;
  if (topCandidates.length === 0) {
    return { error: 'No eligible candidates after filtering.' };
  }

  const evaluationId = `${month}-nomi-singularity`;
  const existing = evaluationsRepo.getEvaluation(evaluationId);
  if (existing) {
    return { result: existing.result, source: existing.source || 'local', candidates: topCandidates };
  }

  let genlayerError = '';
  if (genlayer.isConfigured()) {
    try {
      const result = await genlayer.selectWinner(evaluationId, payload);
      return { result, source: 'genlayer', candidates: topCandidates };
    } catch (err) {
      genlayerError = err.message;
      console.error('GenLayer failed, using local scoring:', err.message);
    }
  }

  // Local fallback: pick the top-scored candidate
  const winner = topCandidates[0];
  const localResult = {
    winner_user_id: winner.user_id,
    confidence: 70,
    decision: 'award',
    reason: `Highest contribution score based on ${winner.meaningful_messages} meaningful messages, ${winner.high_quality_posts} high-quality posts, and focus score of ${winner.genlayer_focus_score}.`,
    risk_notes: ['GenLayer evaluation unavailable; using local scoring.'],
  };

  evaluationsRepo.saveEvaluation({
    evaluationId,
    taskType: 'select_winner',
    month,
    inputSummary: payload,
    result: localResult,
    confidence: localResult.confidence,
    txHash: null,
    source: 'local',
    errorMessage: genlayerError,
  });

  return { result: localResult, source: 'local', candidates: topCandidates };
}

module.exports = { runNomiSingularity };
