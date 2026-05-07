const express = require('express');
const path = require('path');
const config = require('../config');
const { getDb } = require('../db/connection');
const dashboard = require('./dashboard-data');

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const loginFailures = new Map();

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((cookies, part) => {
    const [rawName, ...rest] = part.trim().split('=');
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rest.join('=') || '');
    return cookies;
  }, {});
}

function getRequestToken(req) {
  const auth = req.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return parseCookies(req.get('cookie')).dashboard_token || '';
}

function cookieOptions() {
  const secure = config.WEB_PUBLIC_URL.startsWith('https://');
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 12 * 60 * 60 * 1000,
  };
}

function clearCookieOptions() {
  const { maxAge, ...options } = cookieOptions();
  return options;
}

function getClientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getFailureRecord(req) {
  const key = getClientKey(req);
  const now = Date.now();
  const record = loginFailures.get(key);
  if (!record || now - record.firstSeen > LOGIN_WINDOW_MS) {
    const fresh = { count: 0, firstSeen: now };
    loginFailures.set(key, fresh);
    return fresh;
  }
  return record;
}

function isLoginRateLimited(req) {
  return getFailureRecord(req).count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(req) {
  const record = getFailureRecord(req);
  record.count += 1;
}

function clearLoginFailures(req) {
  loginFailures.delete(getClientKey(req));
}

function requireDashboardToken(req, res, next) {
  if (!config.WEB_ADMIN_TOKEN) {
    return res.status(503).json({ error: 'WEB_ADMIN_TOKEN is not configured.' });
  }

  const token = getRequestToken(req);
  if (token !== config.WEB_ADMIN_TOKEN) {
    console.warn(`[Dashboard] Unauthorized request: ${req.method} ${req.path}`);
    if (!req.path.startsWith('/api/') && req.accepts('html')) {
      return res.redirect('/login');
    }
    return res.status(401).json({ error: 'Unauthorized dashboard access.' });
  }

  next();
}

function jsonRoute(handler) {
  return (req, res) => {
    try {
      res.json(handler(req));
    } catch (err) {
      console.error(`[Dashboard] API error: ${req.method} ${req.path}`, err);
      res.status(500).json({ error: err.message });
    }
  };
}

function loginPage(error = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard Login</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f6f8;color:#17191d;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(420px,calc(100vw - 32px));background:#fff;border:1px solid #dde2e7;border-radius:8px;padding:28px;box-shadow:0 18px 50px rgba(25,31,38,.08)}
    h1{margin:0 0 8px;font-size:26px;line-height:1.1}p{margin:0 0 22px;color:#68707b;font-size:14px;line-height:1.5}
    label{display:grid;gap:8px;font-size:12px;font-weight:800;color:#68707b;text-transform:uppercase}
    input{height:42px;border:1px solid #dde2e7;border-radius:8px;padding:0 12px;font:inherit}
    button{width:100%;height:42px;margin-top:14px;border:0;border-radius:8px;background:#147c72;color:#fff;font:inherit;font-weight:800;cursor:pointer}
    .error{margin-top:12px;color:#bd2d3a;font-size:13px}
  </style>
</head>
<body>
  <main>
    <h1>GenLayer Monitor</h1>
    <p>Enter the dashboard admin token to open the monitoring UI.</p>
    <form method="post" action="/login">
      <label>Admin Token<input name="token" type="password" autocomplete="current-password" autofocus></label>
      <button type="submit">Open Dashboard</button>
    </form>
    ${error ? `<div class="error">${error}</div>` : ''}
  </main>
</body>
</html>`;
}

function createWebDashboardApp() {
  const app = express();
  const publicDir = path.join(__dirname, 'public');

  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get('/healthz', (_req, res) => {
    try {
      getDb().prepare('SELECT 1').get();
      res.json({
        ok: true,
        service: 'genlayer-discord-monitor',
        dashboard: true,
        uptime_seconds: Math.round(process.uptime()),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        service: 'genlayer-discord-monitor',
        error: err.message,
      });
    }
  });

  app.get('/login', (_req, res) => {
    res.type('html').send(loginPage());
  });

  app.post('/login', (req, res) => {
    if (!config.WEB_ADMIN_TOKEN) {
      return res.status(503).type('html').send(loginPage('WEB_ADMIN_TOKEN is not configured.'));
    }
    if (isLoginRateLimited(req)) {
      console.warn(`[Dashboard] Rate limited login attempt from ${getClientKey(req)}`);
      return res.status(429).type('html').send(loginPage('Too many invalid attempts. Try again later.'));
    }
    if (req.body?.token !== config.WEB_ADMIN_TOKEN) {
      console.warn('[Dashboard] Failed login attempt');
      recordLoginFailure(req);
      return res.status(401).type('html').send(loginPage('Invalid dashboard token.'));
    }
    clearLoginFailures(req);
    res.cookie('dashboard_token', req.body.token, cookieOptions());
    return res.redirect('/');
  });

  app.post('/logout', (_req, res) => {
    res.clearCookie('dashboard_token', clearCookieOptions());
    return res.redirect('/login');
  });

  app.get('/logout', (_req, res) => {
    res.clearCookie('dashboard_token', clearCookieOptions());
    return res.redirect('/login');
  });

  app.use(requireDashboardToken);
  app.use(express.static(publicDir, { extensions: ['html'] }));

  app.get('/api/dashboard/summary', jsonRoute(req => (
    dashboard.getSummary(req.query.month)
  )));

  app.get('/api/dashboard/leaderboard', jsonRoute(req => (
    dashboard.getLeaderboard({ month: req.query.month, role: req.query.role || 'Brain' })
  )));

  app.get('/api/dashboard/message-logs', jsonRoute(req => (
    dashboard.getMessageLogs(req.query.limit)
  )));

  app.get('/api/dashboard/proofs', jsonRoute(req => (
    dashboard.getProofs({ month: req.query.month, status: req.query.status || 'pending' })
  )));

  app.get('/api/dashboard/role-health', jsonRoute(req => (
    dashboard.getRoleHealth({ month: req.query.month, role: req.query.role || 'Brain' })
  )));

  app.get('/api/dashboard/genlayer-evaluations', jsonRoute(req => (
    dashboard.getGenLayerEvaluations(req.query.month)
  )));

  app.get('/api/dashboard/genlayer-health', jsonRoute(req => (
    dashboard.getGenLayerHealth(req.query.month)
  )));

  app.use((_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

function startWebDashboard() {
  const app = createWebDashboardApp();
  const server = app.listen(config.WEB_PORT, config.WEB_BIND_HOST, () => {
    console.log(`Web dashboard listening on http://${config.WEB_BIND_HOST}:${config.WEB_PORT}`);
  });
  return server;
}

module.exports = { createWebDashboardApp, startWebDashboard };
