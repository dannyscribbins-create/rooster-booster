'use strict';

// Phase 1 (RED) of the tenant-resolution rebuild's createApp() refactor
// (TENANT_RESOLUTION_REBUILD_SPEC.md Section 7.4). server/app.js does not exist yet —
// this file is written first and is expected to fail on `require('../app')` until
// Phase 2 extracts createApp() out of server.js. Each test below proves one router
// is mounted (by hitting one known route on it), not that its business logic works.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { startTestServer, stopTestServer } = require('./helpers');
const { createApp } = require('../app');

// Minimal GET/POST helper supporting a JSON body and custom headers.
function httpRequest(port, method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? Buffer.from(JSON.stringify(body)) : null;
    const options = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': payload.length, ...headers }
        : { ...headers },
    };
    const req = _httpRequest(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('createApp() parity — all server.js mounts reachable', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    if (pool) await pool.end();
  });

  it('GET /health boots the app and responds first', async () => {
    const resp = await httpRequest(port, 'GET', '/health');
    assert.equal(resp.status, 200);
    assert.equal(resp.body.status, 'ok');
  });

  it('GET /auth/jobber is mounted (oauth router)', async () => {
    const resp = await httpRequest(port, 'GET', '/auth/jobber');
    assert.notEqual(resp.status, 404);
  });

  it('POST /api/login is mounted (referrer router)', async () => {
    const resp = await httpRequest(port, 'POST', '/api/login', { body: {} });
    assert.notEqual(resp.status, 404);
  });

  it('POST /api/admin/login is mounted (admin router)', async () => {
    const resp = await httpRequest(port, 'POST', '/api/admin/login', { body: {} });
    assert.notEqual(resp.status, 404);
  });

  it('POST /api/rm-control/login is mounted (superAdmin router)', async () => {
    const resp = await httpRequest(port, 'POST', '/api/rm-control/login', { body: {} });
    assert.notEqual(resp.status, 404);
  });

  it('POST /webhooks/jobber/client-create is mounted, with express.raw ahead of express.json', async () => {
    const resp = await httpRequest(port, 'POST', '/webhooks/jobber/client-create', { body: { test: true } });
    // No x-jobber-hmac-sha256 header supplied — signature verification rejects with 401,
    // never 404. A 404 here would mean either the router isn't mounted or express.raw()
    // isn't ahead of express.json() on this path.
    assert.notEqual(resp.status, 404);
  });

  it('createApp() is re-invocable — a second instance boots independently', async () => {
    const { server: server2, port: port2 } = await startTestServer(createApp());
    try {
      const resp = await httpRequest(port2, 'GET', '/health');
      assert.equal(resp.status, 200);
    } finally {
      await stopTestServer(server2);
    }
  });
});
