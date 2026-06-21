'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const superAdminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// Hash of a throwaway sentinel — ensures bcrypt.compare always runs even when
// the email is not found, preventing email enumeration via response-time differences.
const DUMMY_BCRYPT_HASH = '$2b$12$zx3jp3cwKJyBjvkjLrxpC.tFQcGrtob.60TLBryMPGb8IZQvlLF32';

// POST /api/rm-control/login
// Unadvertised — not linked from any nav or UI. Reachable by direct URL only.
router.post('/api/rm-control/login', superAdminLoginLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().isString().isLength({ max: 200 }).withMessage('Password required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT id, password_hash FROM super_admins WHERE email = $1',
      [email]
    );
    // Always call bcrypt.compare regardless of whether the email exists.
    const storedHash = result.rows.length ? result.rows[0].password_hash : DUMMY_BCRYPT_HASH;
    const match = await bcrypt.compare(password, storedHash);
    if (!result.rows.length || !match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at, role) VALUES (NULL, $1, $2, $3)',
      [token, expiresAt, 'super_admin']
    );
    res.json({ success: true, token });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/rm-control/login' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
