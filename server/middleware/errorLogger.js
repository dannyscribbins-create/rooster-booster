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

// ── SECTION B — ERROR EXPLANATION ────────────────────────────────────────────
const explainError = (errorMessage, route, severity) => {
  const msg = (errorMessage || '').toLowerCase()
  const r = (route || '').toLowerCase()

  // Database errors
  if (msg.includes('duplicate key') || msg.includes('unique constraint'))
    return 'A duplicate record was attempted on a field that requires unique values. This usually means the same data was submitted twice.'
  if (msg.includes('violates foreign key'))
    return 'A database operation referenced a record that does not exist. A related record may have been deleted.'
  if (msg.includes('econnrefused') || msg.includes('connection refused'))
    return 'The server could not connect to the database. This may be a temporary Railway outage or a misconfigured connection string.'
  if (msg.includes('connection timeout') || msg.includes('etimedout'))
    return 'A database or network connection timed out. This is usually temporary — check Railway status if it persists.'
  if (msg.includes('too many connections'))
    return 'The database connection pool is exhausted. Too many simultaneous requests are hitting the server.'

  // JavaScript errors
  if (msg.includes('cannot read propert') || msg.includes('cannot read prop'))
    return 'A variable or object was accessed before it had a value. Something that was expected to exist was null or undefined.'
  if (msg.includes('is not a function'))
    return 'The code tried to call something as a function that is not a function. This is usually a missing import or a typo in a method name.'
  if (msg.includes('is not defined'))
    return 'A variable or function was used before it was declared or imported.'
  if (msg.includes('unexpected token') || msg.includes('syntaxerror'))
    return 'The server received malformed data — likely invalid JSON in a request body.'
  if (msg.includes('cannot set propert'))
    return 'The code tried to write to a null or undefined object. Something upstream returned empty when a value was expected.'

  // Auth and session errors
  if (msg.includes('invalid token') || msg.includes('jwt') || msg.includes('unauthorized'))
    return 'An authentication token was missing, expired, or invalid. The user may need to log in again.'
  if (msg.includes('session'))
    return 'A user session could not be found or has expired.'

  // Network and API errors
  if (msg.includes('fetch failed') || msg.includes('network'))
    return 'An outbound API call failed. Check whether Jobber, Resend, or Stripe is experiencing an outage.'
  if (msg.includes('rate limit') || msg.includes('429'))
    return 'An external API rate limit was hit. The app is making too many requests in a short period.'
  if (msg.includes('500') || msg.includes('internal server'))
    return 'An external service returned a 500 error. This is on their end, not yours.'
  if (msg.includes('404') || msg.includes('not found'))
    return 'The app tried to reach a resource or endpoint that does not exist. This may be a stale reference or a deleted record.'

  // Stripe and payout errors
  if (r.includes('stripe') || r.includes('payout') || r.includes('cashout'))
    return 'An error occurred in the payout or payment flow. Review this immediately — real money may be affected.'

  // Jobber and CRM errors
  if (r.includes('jobber') || r.includes('webhook') || r.includes('sync'))
    return 'An error occurred during a Jobber sync or webhook operation. Pipeline data may be temporarily out of date.'

  // Validation errors
  if (msg.includes('validation') || msg.includes('invalid input'))
    return 'A request failed input validation. Unexpected or malformed data was submitted to this endpoint.'

  // Fallback
  if (severity === 'CRITICAL')
    return 'A critical error occurred in a sensitive part of the application. Review the stack trace immediately.'
  if (severity === 'WARNING')
    return 'A warning-level error occurred. This may not affect users immediately but should be reviewed soon.'

  return 'An unexpected error occurred. Review the route and stack trace below for details.'
}

// ── SECTION C — EMAIL ALERT WITH THROTTLING ───────────────────────────────────
async function sendErrorAlert(errorRow) {
  // Only send on first occurrence or every 10th recurrence
  if (errorRow.count !== 1 && errorRow.count % 10 !== 0) return;

  const explanation = explainError(errorRow.error_message, errorRow.route, errorRow.severity)

  const subject = `[RoofMiles] ${errorRow.source === 'frontend' ? '[Frontend]' : '[Backend]'} ${errorRow.severity} Error — ${errorRow.route} — ${
    (errorRow.error_message || '').slice(0, 80)
  }`;

  const body = [
    `What this means:`,
    explanation,
    '',
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

// ── SECTION D — logError() ────────────────────────────────────────────────────
async function logError({ req, error, contractorId, source = 'backend' }) {
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
         (contractor_id, route, method, error_message, stack_trace, severity, app_version, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (contractor_id, route, method, error_message)
       DO UPDATE SET
         count        = error_log.count + 1,
         last_seen_at = NOW(),
         stack_trace  = EXCLUDED.stack_trace
       RETURNING *`,
      [contractor_id, route, method, error_message, stack_trace, severity, app_version, source]
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

// ── SECTION E — EXPRESS ERROR HANDLER MIDDLEWARE ─────────────────────────────
async function expressErrorHandler(err, req, res, next) {
  await logError({ req, error: err });
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: 'Something went wrong. The team has been notified.'
  });
}

module.exports = { logError, expressErrorHandler };
