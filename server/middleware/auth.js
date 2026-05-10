'use strict';

const { pool } = require('../db');

async function verifyAdminSession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authorized' }); return false; }
  try {
    const result = await pool.query(
      'SELECT id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'admin']
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return false;
    }
    return true;
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
    return false;
  }
}

/**
 * Verifies a referrer session token.
 * Checks sessions table for a valid non-expired referrer session,
 * and confirms the user account has not been soft-deleted.
 * @returns {{ userId: number }} on success
 * @returns {null} on failure (also sends 401 response)
 */
async function verifyReferrerSession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authorized' }); return null; }
  try {
    const result = await pool.query(
      `SELECT s.id AS session_id, s.user_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1
         AND s.role = $2
         AND s.expires_at > NOW()
         AND u.deleted_at IS NULL`,
      [token, 'referrer']
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return null;
    }
    return { userId: result.rows[0].user_id, sessionId: result.rows[0].session_id };
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
    return null;
  }
}

module.exports = { verifyAdminSession, verifyReferrerSession };
