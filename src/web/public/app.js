const state = {
  tab: 'leaderboard',
};

const els = {};

function $(id) {
  return document.getElementById(id);
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function api(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });

  return fetch(url).then(async response => {
    if (response.status === 401) {
      window.location.assign('/login');
      throw new Error('Unauthorized dashboard access.');
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Request failed with ${response.status}`);
    }
    return response.json();
  });
}

function fmtNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function fmtDate(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function text(value) {
  return value === undefined || value === null || value === '' ? 'None' : String(value);
}

function userCell(row) {
  const name = row.display_name || row.discord_user_id || 'Unknown';
  return `<div class="user"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(row.discord_user_id || '')}</span></div>`;
}

function pill(value) {
  const label = text(value);
  const cls = label.split(' ')[0];
  return `<span class="pill ${escapeHtml(cls)}">${escapeHtml(label)}</span>`;
}

function jsonDetails(value) {
  return `<details><summary>View JSON</summary><pre>${escapeHtml(JSON.stringify(value || {}, null, 2))}</pre></details>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setRows(tbody, rows, renderRow, columns) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td class="empty" colspan="${columns}">No records for this filter.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(renderRow).join('');
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('is-hidden');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add('is-hidden'), 4200);
}

async function loadSummary() {
  const summary = await api('/api/dashboard/summary', { month: els.month.value });
  els.metricUsers.textContent = fmtNumber(summary.total_users);
  els.metricMeaningful.textContent = fmtNumber(summary.meaningful_messages);
  els.metricSpam.textContent = fmtNumber(summary.spam_flags);
  els.metricProofs.textContent = fmtNumber(summary.pending_proofs);
  els.metricGenLayer.textContent = summary.latest_evaluation?.result?.winner_user_id
    ? `Winner ${summary.latest_evaluation.result.winner_user_id}`
    : summary.latest_evaluation?.evaluation_id || (summary.genlayer_health?.configured ? 'Configured' : 'Not configured');
  els.summaryLine.textContent = `${fmtNumber(summary.active_users)} active users in ${summary.month}`;
}

async function loadLeaderboard() {
  const rows = await api('/api/dashboard/leaderboard', {
    month: els.month.value,
    role: els.role.value,
  });
  setRows(els.leaderboardRows, rows, row => `
    <tr>
      <td>${row.rank}</td>
      <td>${userCell(row)}</td>
      <td><strong>${fmtNumber(row.score)}</strong></td>
      <td>${fmtNumber(row.meaningful_messages)}</td>
      <td>${fmtNumber(row.active_days)}</td>
      <td>${fmtNumber(row.genlayer_focus_score)}</td>
      <td>${fmtNumber(row.high_quality_posts)} high / ${fmtNumber(row.submitted_posts)} total</td>
      <td>${fmtNumber(row.weekly_contest_points)}</td>
      <td>${fmtNumber(row.admin_bonus)}</td>
      <td>${pill(row.risk_level)}</td>
    </tr>
  `, 10);
}

async function loadLogs() {
  const rows = await api('/api/dashboard/message-logs', { limit: 100 });
  setRows(els.logRows, rows, row => `
    <tr>
      <td>${fmtDate(row.created_at)}</td>
      <td>${userCell(row)}</td>
      <td class="mono">${escapeHtml(row.channel_id)}</td>
      <td>${fmtNumber(row.content_length)}</td>
      <td>${pill(row.is_meaningful ? 'Yes' : 'No')}</td>
      <td>${row.is_spam ? pill('spam') : pill('No')}</td>
      <td class="mono clip">${escapeHtml(row.content_hash)}</td>
    </tr>
  `, 7);
}

async function loadProofs() {
  const rows = await api('/api/dashboard/proofs', {
    month: els.month.value,
    status: els.proofStatus.value,
  });
  setRows(els.proofRows, rows, row => `
    <tr>
      <td>${row.id}</td>
      <td>${userCell(row)}</td>
      <td>${escapeHtml(row.source)}</td>
      <td>${pill(row.status)}</td>
      <td>${fmtNumber(row.points)}</td>
      <td><a class="clip" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">${escapeHtml(row.url)}</a></td>
      <td>${escapeHtml(row.reviewed_by || '')}</td>
      <td>${fmtDate(row.created_at)}</td>
    </tr>
  `, 8);
}

async function loadHealth() {
  const rows = await api('/api/dashboard/role-health', {
    month: els.month.value,
    role: els.role.value === 'All' ? 'Brain' : els.role.value,
  });
  setRows(els.healthRows, rows, row => `
    <tr>
      <td>${userCell(row)}</td>
      <td>${escapeHtml(row.role_name)}</td>
      <td>${pill(row.risk_level)}</td>
      <td class="clip">${escapeHtml(row.reason)}</td>
      <td>${jsonDetails(row.metrics)}</td>
      <td>${fmtDate(row.created_at)}</td>
    </tr>
  `, 6);
}

async function loadGenLayer() {
  const [health, rows] = await Promise.all([
    api('/api/dashboard/genlayer-health', { month: els.month.value }),
    api('/api/dashboard/genlayer-evaluations', { month: els.month.value }),
  ]);
  els.genlayerHealth.textContent = health.configured
    ? `Configured on ${health.network || 'default network'} at ${health.contract_address || 'no contract address'}; latest local evaluation: ${health.latest_evaluation_id || 'none'}.`
    : 'GenLayer is not configured for this environment.';
  setRows(els.genlayerRows, rows, row => `
    <tr>
      <td>${fmtDate(row.created_at)}</td>
      <td class="mono">${escapeHtml(row.evaluation_id)}</td>
      <td>${escapeHtml(row.task_type)}</td>
      <td>${fmtNumber(row.confidence)}%</td>
      <td class="mono clip">${escapeHtml(row.tx_hash || '')}</td>
      <td>${jsonDetails(row.result)}</td>
    </tr>
  `, 6);
}

async function refresh() {
  try {
    await loadSummary();
    if (state.tab === 'leaderboard') await loadLeaderboard();
    if (state.tab === 'logs') await loadLogs();
    if (state.tab === 'proofs') await loadProofs();
    if (state.tab === 'health') await loadHealth();
    if (state.tab === 'genlayer') await loadGenLayer();
  } catch (err) {
    showToast(err.message);
  }
}

function selectTab(tabName) {
  state.tab = tabName;
  document.querySelectorAll('.tab').forEach(button => {
    button.classList.toggle('is-active', button.dataset.tab === tabName);
  });
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.classList.toggle('is-hidden', panel.dataset.panel !== tabName);
  });
  refresh();
}

function bindElements() {
  els.month = $('monthInput');
  els.role = $('roleInput');
  els.proofStatus = $('proofStatusInput');
  els.summaryLine = $('summaryLine');
  els.metricUsers = $('metricUsers');
  els.metricMeaningful = $('metricMeaningful');
  els.metricSpam = $('metricSpam');
  els.metricProofs = $('metricProofs');
  els.metricGenLayer = $('metricGenLayer');
  els.leaderboardRows = $('leaderboardRows');
  els.logRows = $('logRows');
  els.proofRows = $('proofRows');
  els.healthRows = $('healthRows');
  els.genlayerRows = $('genlayerRows');
  els.genlayerHealth = $('genlayerHealth');
}

function init() {
  bindElements();
  els.month.value = getCurrentMonth();

  document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => selectTab(button.dataset.tab));
  });
  $('refreshButton').addEventListener('click', refresh);
  els.month.addEventListener('change', refresh);
  els.role.addEventListener('change', refresh);
  els.proofStatus.addEventListener('change', refresh);

  refresh();
}

init();
