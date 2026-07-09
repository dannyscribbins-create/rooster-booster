const cron = require('node-cron');
const { withLock } = require('../withLock');
const { pool } = require('../../db');
const { logError } = require('../../middleware/errorLogger');
const { Resend } = require('resend');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { resendShouldRetry } = require('../../utils/retryHelpers');
const { isEmailSuppressed } = require('../../utils/emailSuppression');

const resend = new Resend(process.env.RESEND_API_KEY);
// test seam — inert in production, never called outside server/test/
let _sendEmail = (...args) => resend.emails.send(...args);

const CADENCE_MONTHS = [1, 3, 6, 12];

function isInWindow(baseDate, targetMonths, today) {
  const target = new Date(baseDate);
  target.setMonth(target.getMonth() + targetMonths);
  const diffMs = today - target;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= -1 && diffDays <= 1;
}

function applyTokens(template, tokens) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => tokens[key] || match);
}

// test seam — inert in production, never called outside server/test/
function _setTestOverrides({ sendEmail: a } = {}) {
  if (a !== undefined) _sendEmail = a;
}

// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() {
  _sendEmail = (...args) => resend.emails.send(...args);
}

// Extracted inner body of the cadence cron. Accepts today so tests can control the reference date.
// Production: called from startEngagementCadenceJob with new Date().
async function _runEngagementCadencePass(today) {
  console.log('[cron:engagement_cadence] Starting M1/M3/M6/M12 cadence check');

  const { rows: contractors } = await pool.query(
    `SELECT DISTINCT contractor_id FROM contractor_settings`
  );

  let totalSent = 0;
  let totalSkipped = 0;

  for (const { contractor_id: contractorId } of contractors) {
    try {
      const { rows: settingsRows } = await pool.query(
        `SELECT COALESCE(email_sender_name, company_name, 'RoofMiles') AS sender_name,
                COALESCE(company_name, 'RoofMiles') AS company_name
         FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
        [contractorId]
      );
      const senderName = settingsRows[0]?.sender_name || 'RoofMiles';
      const companyName = settingsRows[0]?.company_name || 'RoofMiles';

      const { rows: settings } = await pool.query(
        `SELECT cadence_month, is_enabled, subject, body
         FROM engagement_cadence_settings
         WHERE contractor_id = $1 AND is_enabled = TRUE`,
        [contractorId]
      );

      if (settings.length === 0) continue;

      const enabledMonths = new Set(settings.map(s => s.cadence_month));
      const settingsByMonth = Object.fromEntries(settings.map(s => [s.cadence_month, s]));

      const { rows: paidContacts } = await pool.query(
        `SELECT
           pc.jobber_client_id,
           pc.client_name,
           pc.paid_at,
           c.id AS contact_id,
           c.email,
           u.referral_code
         FROM pipeline_cache pc
         JOIN contacts c ON c.jobber_client_id = pc.jobber_client_id
           AND c.contractor_id = pc.contractor_id
         LEFT JOIN users u ON LOWER(u.email) = LOWER(c.email) AND u.contractor_id = c.contractor_id
         WHERE pc.contractor_id = $1
           AND pc.pipeline_status = 'paid'
           AND pc.paid_at IS NOT NULL
           AND c.email IS NOT NULL
           AND c.email != ''`,
        [contractorId]
      );

      for (const contact of paidContacts) {
        for (const month of CADENCE_MONTHS) {
          if (!enabledMonths.has(month)) continue;
          if (!isInWindow(contact.paid_at, month, today)) continue;

          const { rows: logRows } = await pool.query(
            `SELECT 1 FROM engagement_cadence_log
             WHERE contact_id = $1 AND cadence_month = $2`,
            [contact.contact_id, month]
          );

          if (logRows.length > 0) {
            totalSkipped++;
            continue;
          }

          const suppressed = await isEmailSuppressed(contractorId, contact.email, 'engagement_cadence');
          if (suppressed) {
            totalSkipped++;
            continue;
          }

          const installDate = new Date(contact.paid_at);
          const installMonth = installDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          const warrantyYear = installDate.getFullYear() + 10;
          const firstName = (contact.client_name || '').split(' ')[0] || 'there';
          const referralLink = contact.referral_code
            ? `${process.env.FRONTEND_URL}/?ref=${contact.referral_code}`
            : process.env.FRONTEND_URL || '';

          const tokens = {
            first_name:    firstName,
            company_name:  companyName,
            job_type:      'roofing project',
            install_month: installMonth,
            warranty_year: warrantyYear.toString(),
            referral_link: referralLink,
          };

          const setting = settingsByMonth[month];
          const subject  = applyTokens(setting.subject, tokens);
          const bodyText = applyTokens(setting.body, tokens);
          const htmlBody = bodyText
            .split('\n\n')
            .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
            .join('');

          try {
            await retryWithBackoff(
              () => _sendEmail({
                from: `${senderName} <noreply@roofmiles.com>`,
                to:   contact.email,
                subject,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">${htmlBody}</div>`,
              }),
              { shouldRetry: resendShouldRetry }
            );

            await pool.query(
              `INSERT INTO engagement_cadence_log (contractor_id, contact_id, cadence_month)
               VALUES ($1, $2, $3)
               ON CONFLICT (contact_id, cadence_month) DO NOTHING`,
              [contractorId, contact.contact_id, month]
            );

            totalSent++;
            console.log(
              `[cron:engagement_cadence] Sent M${month} to ${contact.email} (${contractorId})`
            );
          } catch (sendErr) {
            logError({
              error: sendErr,
              source: `cron:engagement_cadence — send M${month} to ${contact.email}`,
            });
          }
        }
      }
    } catch (contractorErr) {
      logError({
        error: contractorErr,
        source: `cron:engagement_cadence — contractor ${contractorId}`,
      });
    }
  }

  console.log(
    `[cron:engagement_cadence] Complete — ${totalSent} sent, ${totalSkipped} already sent (skipped)`
  );
}

function startEngagementCadenceJob() {
  // Daily at 6:00am UTC
  cron.schedule('0 6 * * *', () => {
    withLock('engagement_cadence', 20, async () => {
      const today = new Date();
      await _runEngagementCadencePass(today);
    });
  });
}

module.exports = {
  startEngagementCadenceJob,
  _runEngagementCadencePass,
  _setTestOverrides,
  _resetTestOverrides,
};
