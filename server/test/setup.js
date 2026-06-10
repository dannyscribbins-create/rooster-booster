'use strict';

const { Pool } = require('pg');

// STEP A — Load .env.test at module-load time, BEFORE any module that opens a pool
// is required. override: true ensures test values win over any already-set process.env.
require('dotenv').config({ path: '.env.test', override: true });

// STEP B — SAFETY INTERLOCK (runs at module-load time, not deferred to initTestDb).
// Tests must only connect to localhost/127.0.0.1. Any other host aborts the process
// before a single query can reach a non-local database.
const _rawUrl = process.env.DATABASE_URL;
if (!_rawUrl) {
  throw new Error(
    'TEST SAFETY INTERLOCK: DATABASE_URL is not set.\n' +
    'Add .env.test to the project root with DATABASE_URL pointing to localhost.'
  );
}

let _hostname;
try {
  _hostname = new URL(_rawUrl).hostname;
} catch {
  throw new Error(`TEST SAFETY INTERLOCK: Cannot parse DATABASE_URL: ${_rawUrl}`);
}

if (_hostname !== 'localhost' && _hostname !== '127.0.0.1') {
  throw new Error(
    '\n\n*** TEST SAFETY INTERLOCK ***\n' +
    `DATABASE_URL points to '${_hostname}' — tests may only run against localhost or 127.0.0.1.\n` +
    'ABORTING to prevent data loss on production or staging.\n'
  );
}

// initTestDb() — call once in a before() hook before any tests run.
// Returns the pool backed by roofmiles_test so tests can pass it to helpers and
// to evaluateAudience(), evaluateReferral(), etc.
async function initTestDb() {
  const dbUrl = process.env.DATABASE_URL;

  // STEP C — Create roofmiles_test if it does not exist.
  // Connect to the system 'postgres' database to issue CREATE DATABASE.
  const adminUrl = dbUrl.replace(/\/[^/?]*(\?.*)?$/, '/postgres');
  const adminPool = new Pool({ connectionString: adminUrl });
  try {
    await adminPool.query('CREATE DATABASE roofmiles_test');
  } catch (err) {
    if (err.code !== '42P04') throw err; // 42P04 = duplicate_database — already exists, fine
  } finally {
    await adminPool.end();
  }

  // STEP D — Wipe public schema so every run starts from a truly empty database.
  const wipePool = new Pool({ connectionString: dbUrl });
  try {
    await wipePool.query('DROP SCHEMA public CASCADE');
    await wipePool.query('CREATE SCHEMA public');
  } finally {
    await wipePool.end();
  }

  // STEP E — Create pg_trgm extension.
  // db.js does not create it; contacts.js does at module load but is not required here.
  const extPool = new Pool({ connectionString: dbUrl });
  try {
    await extPool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  } finally {
    await extPool.end();
  }

  // STEP F — Now require db.js (pool already points to roofmiles_test via DATABASE_URL set above)
  // and run initDB() to create the full schema via the idempotent migrations.
  const { pool, initDB } = require('../db');
  await initDB();

  return pool;
}

module.exports = { initTestDb };
