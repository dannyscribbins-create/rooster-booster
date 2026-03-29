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

module.exports = { verifyAdminSession };
