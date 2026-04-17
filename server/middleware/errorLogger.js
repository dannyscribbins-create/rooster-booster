const { pool } = require('../db');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ── SECTION A — SEVERITY CLASSIFICATION ──────────────────────────────────────
function classifySeverity(route) {
  const r = route || '';
  if (['/cashout', '/payout', '/stripe', '/webhook', '/auth', '/token'].some(s => r.includes(s))) {
    return 'CRITICAL';
  }
  if (['/login', '/pin', '/reset', '/admin'].some(s => r.includes(s))) {
    return 'WARNING';
  }
  return 'INFO';
}

// ── SECTION B — EMAIL ALERT WITH THROTTLING ───────────────────────────────────
async function sendErrorAlert(errorRow) {
  // Only send on first occurrence or every 10th recurrence
  if (errorRow.count !== 1 && errorRow.count % 10 !== 0) return;

  const subject = `[RoofMiles] ${errorRow.severity} Error — ${errorRow.route} — ${
    (errorRow.error_message || '').slice(0, 80)
  }`;

  const body = [
    `Severity: ${errorRow.severity}`,
    `Route: ${errorRow.method} ${errorRow.route}`,
    `Contractor: ${errorRow.contractor_id}`,
    `Version: ${errorRow.app_version}`,
    `First seen: ${errorRow.first_seen_at}`,
    `Last seen: ${errorRow.last_seen_at}`,
    `Total occurrences: ${errorRow.count}`,
    '',
    'Stack trace:',
    errorRow.stack_trace || '(none)',
  ].join('\n');

  await resend.emails.send({
    from: 'noreply@roofmiles.com',
    to: 'admin1@roofmiles.com',
    subject,
    text: body,
  });
}

// ── SECTION C — logError() ────────────────────────────────────────────────────
async function logError({ req, error, contractorId }) {
  try {
    const route         = req?.path || 'unknown';
    const method        = req?.method || 'UNKNOWN';
    const error_message = (error?.message || String(error)).slice(0, 500);
    const stack_trace   = (error?.stack || null)?.slice(0, 5000) ?? null;
    const severity      = classifySeverity(route);
    const app_version   = process.env.APP_VERSION || 'unknown';
    const contractor_id = contractorId || req?.session?.contractorId || 'accent-roofing';

    const result = await pool.query(
      `INSERT INTO error_log
         (contractor_id, route, method, error_message, stack_trace, severity, app_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (contractor_id, route, method, error_message)
       DO UPDATE SET
         count        = error_log.count + 1,
         last_seen_at = NOW(),
         stack_trace  = EXCLUDED.stack_trace
       RETURNING *`,
      [contractor_id, route, method, error_message, stack_trace, severity, app_version]
    );

    const errorRow = result.rows[0];

    try {
      await sendErrorAlert(errorRow);
    } catch (emailErr) {
      console.error('[errorLogger] Email alert failed:', emailErr.message);
    }
  } catch (loggerErr) {
    console.error('[errorLogger] logError failed:', loggerErr.message);
  }
}

// ── SECTION D — EXPRESS ERROR HANDLER MIDDLEWARE ──────────────────────────────
async function expressErrorHandler(err, req, res, next) {
  await logError({ req, error: err });
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: 'Something went wrong. The team has been notified.'
  });
}

module.exports = { logError, expressErrorHandler };
