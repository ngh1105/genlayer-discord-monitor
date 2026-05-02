const { getDb } = require('../db/connection');

/**
 * Store a GenLayer evaluation result.
 */
function saveEvaluation({ evaluationId, taskType, month, inputSummary, result, confidence, txHash }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO genlayer_evaluations
      (evaluation_id, task_type, month, input_summary_json, result_json, confidence, tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    evaluationId,
    taskType,
    month,
    JSON.stringify(inputSummary || {}),
    JSON.stringify(result || {}),
    confidence || 0,
    txHash || null
  );
}

/**
 * Get evaluation by ID.
 */
function getEvaluation(evaluationId) {
  const row = getDb().prepare(
    'SELECT * FROM genlayer_evaluations WHERE evaluation_id = ?'
  ).get(evaluationId);

  if (row) {
    row.input_summary = JSON.parse(row.input_summary_json || '{}');
    row.result = JSON.parse(row.result_json || '{}');
  }
  return row;
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

  if (row) {
    row.input_summary = JSON.parse(row.input_summary_json || '{}');
    row.result = JSON.parse(row.result_json || '{}');
  }
  return row;
}

module.exports = {
  saveEvaluation,
  getEvaluation,
  getLatestByType,
};
