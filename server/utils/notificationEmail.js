'use strict';

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends an admin notification email to the contractor's configured address.
 * Falls back to platform default if no contractor email is configured.
 * @param {object} pool - DB pool for looking up contractor email
 * @param {string} type - 'payouts' or 'general'
 * @param {string} subject - Email subject line
 * @param {string} html - Email HTML body
 */
async function sendAdminNotification(pool, type, subject, html) {
  try {
    const column = type === 'payouts'
      ? 'notification_email_payouts'
      : 'notification_email_general';

    const result = await pool.query(
      `SELECT ${column} FROM contractor_settings WHERE contractor_id = 'accent-roofing'`
    );

    let recipient = result.rows[0]?.[column] || null;

    if (!recipient) {
      console.warn(
        `[notificationEmail] No ${type} notification email configured for contractor accent-roofing. ` +
        'Falling back to platform default: admin1@roofmiles.com'
      );
      recipient = 'admin1@roofmiles.com';
    }

    await resend.emails.send({
      from: 'noreply@roofmiles.com',
      to: recipient,
      subject,
      html
    });

    console.log(`[notificationEmail] ${type} notification sent to ${recipient}`);
  } catch (err) {
    // Log but do not throw — a failed notification email must never
    // crash the cashout flow or block the referrer's experience
    console.error('[notificationEmail] Failed to send admin notification:', err.message);
  }
}

module.exports = { sendAdminNotification };
