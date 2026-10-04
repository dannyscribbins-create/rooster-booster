'use strict';

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { retryWithBackoff } = require('./retryWithBackoff');
const { resendShouldRetry } = require('./retryHelpers');
const { logError } = require('../middleware/errorLogger');

/**
 * Resolves the recipient email for a given notification type.
 * Fallback chain:
 *   payouts:  notification_email_payouts → company_email → admin1@roofmiles.com
 *   general:  notification_email_general → company_email → admin1@roofmiles.com
 *   booking:  booking_email (contractor_about) → company_email (contractor_settings) → admin1@roofmiles.com
 *
 * @param {object} pool - DB pool
 * @param {string} type - 'payouts' | 'general' | 'booking'
 * @param {string} [contractorId='accent-roofing'] - contractor to resolve for
 * @returns {Promise<string>} resolved recipient email
 */
async function resolveNotificationRecipient(pool, type, contractorId = 'accent-roofing') {
  const PLATFORM_DEFAULT = 'admin1@roofmiles.com';

  try {
    // For booking type: check contractor_about.booking_email first
    if (type === 'booking') {
      const aboutResult = await pool.query(
        `SELECT booking_email FROM contractor_about WHERE contractor_id = $1 LIMIT 1`,
        [contractorId]
      );
      const bookingEmail = aboutResult.rows[0]?.booking_email || null;
      if (bookingEmail) return bookingEmail;
    }

    // For payouts/general: check the specific column in contractor_settings
    // Also always fetch company_email as the fallback in the same query
    const column = type === 'payouts'
      ? 'notification_email_payouts'
      : type === 'general'
        ? 'notification_email_general'
        : null; // booking type skips this block

    if (column) {
      const result = await pool.query(
        `SELECT ${column}, company_email FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
        [contractorId]
      );
      const specificEmail = result.rows[0]?.[column] || null;
      if (specificEmail) return specificEmail;

      const companyEmail = result.rows[0]?.company_email || null;
      if (companyEmail) return companyEmail;
    } else {
      // booking type: specific check done above, now check company_email fallback
      const result = await pool.query(
        `SELECT company_email FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
        [contractorId]
      );
      const companyEmail = result.rows[0]?.company_email || null;
      if (companyEmail) return companyEmail;
    }

    console.warn(
      `[notificationEmail] No ${type} notification email configured for contractor ${contractorId}. ` +
      `Falling back to platform default: ${PLATFORM_DEFAULT}`
    );
    return PLATFORM_DEFAULT;

  } catch (err) {
    console.error('[notificationEmail] Error resolving recipient:', err.message);
    return PLATFORM_DEFAULT;
  }
}

/**
 * Sends an admin notification email to the resolved recipient for this notification type.
 * @param {object} pool - DB pool
 * @param {string} type - 'payouts' | 'general' | 'booking'
 * @param {string} subject - Email subject line
 * @param {string} html - Email HTML body
 * @param {string} [contractorId='accent-roofing'] - contractor to resolve for
 */
async function sendAdminNotification(pool, type, subject, html, contractorId = 'accent-roofing') {
  try {
    const recipient = await resolveNotificationRecipient(pool, type, contractorId);

    await retryWithBackoff(
      () => resend.emails.send({
        from: 'noreply@roofmiles.com',
        to: recipient,
        subject,
        html
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
    );

    console.log(`[notificationEmail] ${type} notification sent to ${recipient}`); // diagnostic log — intentional
  } catch (err) {
    // Log but do not throw — a failed notification email must never
    // crash the cashout flow or block the referrer's experience
    //
    // ⚠ DELIBERATELY STILL UNTENANTED, AND THIS IS THE ONE SITE CLEANUP D3 LEFT OPEN ON PURPOSE.
    // Threading `contractorId` here looks correct and would make things WORSE: this function's
    // parameter DEFAULTS to the phantom `'accent-roofing'`, and **all six callers omit it**
    // (measured 2026-10-03 — `crm/pipelineSync.js`, `routes/account.js`, `routes/referrer.js` ×2,
    // `routes/resendWebhook.js` ×2; in every one the last argument is the HTML body). So the only
    // value available is a contractor id that does not exist, and filing errors under it is exactly
    // the defect cleanup D closes.
    // ⚠ `PLATFORM_TENANT` WOULD ALSO BE WRONG: these notifications belong to a real tenant — the
    // one whose `contractor_settings.notification_email_*` row decides the recipient.
    // ⚠ THE FIX IS THE SIX CALL SITES, AND THAT IS NOT A LOGGING CHANGE: passing each caller's real
    // contractor changes WHICH contractor's notification settings are read, i.e. where live email
    // goes. That is the deferred contractor-id reconciliation wave, and it is filed on
    // PRE_LAUNCH_CHECKLIST.md rather than done inside a cleanup commit.
    await logError({ req: null, error: err, source: 'sendAdminNotification' });
    console.error('[notificationEmail] Failed to send admin notification:', err.message);
  }
}

module.exports = { sendAdminNotification, resolveNotificationRecipient };
