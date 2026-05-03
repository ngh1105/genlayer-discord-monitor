const { getDb } = require('../db/connection');

/**
 * Store a GenLayer evaluation result.
 */
function parseJson(value) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    input_summary: parseJson(row.input_summary_json),
    result: parseJson(row.result_json),
  };
}

function saveEvaluation({
  evaluationId,
  taskType,
  month,
  inputSummary,
  result,
  confidence,
  txHash,
  source = '',
  errorMessage = '',
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO genlayer_evaluations
      (evaluation_id, task_type, month, input_summary_json, result_json, confidence, tx_hash, source, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(evaluation_id) DO UPDATE SET
      task_type = excluded.task_type,
      month = excluded.month,
      input_summary_json = excluded.input_summary_json,
      result_json = excluded.result_json,
      confidence = excluded.confidence,
      tx_hash = COALESCE(excluded.tx_hash, genlayer_evaluations.tx_hash),
      source = excluded.source,
      error_message = excluded.error_message
  `).run(
    evaluationId,
    taskType,
    month,
    JSON.stringify(inputSummary || {}),
    JSON.stringify(result || {}),
    confidence || 0,
    txHash || null,
    source || '',
    errorMessage || ''
  );
}

/**
 * Get evaluation by ID.
 */
function getEvaluation(evaluationId) {
  const row = getDb().prepare(
    'SELECT * FROM genlayer_evaluations WHERE evaluation_id = ?'
  ).get(evaluationId);

  return hydrate(row);
}

/**
 * Get latest evaluation for a task type and month.
 */
function getLatestByType(taskType, month) {
  const row = getDb().prepare(`
    SELECT * FROM genlayer_evaluations
    WHERE task_type = ? AND month = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(taskType, month);

  return hydrate(row);
}

module.exports = {
  saveEvaluation,
  getEvaluation,
  getLatestByType,
};
