const cron = require('node-cron');
const { withLock } = require('../withLock');
const { pool } = require('../../db');
const { logError } = require('../../middleware/errorLogger');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { resendShouldRetry } = require('../../utils/retryHelpers');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function startPostJobSequenceJob() {
  // Daily at 7:00am UTC — after engagement cadence (6:00am) and dynamic audiences (6:10am)
  cron.schedule('0 7 * * *', () => {
    withLock('post_job_sequence', 20, async () => {
      console.log('[cron:post_job_sequence] Starting T+24h post-job sequence check');

      const { rows: contractors } = await pool.query(
        `SELECT DISTINCT contractor_id FROM contractor_settings`
      );

      let totalScenarioA = 0;
      let totalScenarioB = 0;

      for (const { contractor_id: contractorId } of contractors) {
        try {
          // Load contractor branding + experience flow flag
          const settingsResult = await pool.query(
            `SELECT COALESCE(email_sender_name, company_name, 'RoofMiles') AS sender_name,
                    COALESCE(company_name, 'RoofMiles') AS company_name,
                    COALESCE(email_footer_text, '') AS email_footer_text,
                    es.experience_flow_enabled
             FROM contractor_settings cs
             LEFT JOIN engagement_settings es ON es.contractor_id = cs.contractor_id
             WHERE cs.contractor_id = $1 LIMIT 1`,
            [contractorId]
          );
          const settings = settingsResult.rows[0] || {};
          const senderName           = settings.sender_name || 'RoofMiles';
          const companyName          = settings.company_name || 'RoofMiles';
          const emailFooterText      = settings.email_footer_text || '';
          const experienceFlowEnabled = !!(settings.experience_flow_enabled);

          // Find pipeline_cache rows where job completed 20–28 hours ago and sequence not yet fired
          const { rows: dueRows } = await pool.query(
            `SELECT pc.contractor_id, pc.jobber_client_id, pc.client_name,
                    c.email AS contact_email
             FROM pipeline_cache pc
             LEFT JOIN contacts c ON c.jobber_client_id = pc.jobber_client_id
               AND c.contractor_id = pc.contractor_id
             WHERE pc.contractor_id = $1
               AND pc.job_completed_at IS NOT NULL
               AND pc.job_completed_at <= NOW() - INTERVAL '20 hours'
               AND pc.job_completed_at >= NOW() - INTERVAL '28 hours'
               AND pc.t24_sequence_triggered = FALSE`,
            [contractorId]
          );

          for (const row of dueRows) {
            try {
              const clientName  = row.client_name || '';
              const contactEmail = row.contact_email || null;
              const frontendUrl  = process.env.FRONTEND_URL || '';

              // Match to an app user — priority: jobber_client_id → email → LOWER(name)
              let matchedUser = null;

              const byClientId = await pool.query(
                `SELECT id, full_name, email, referral_code FROM users
                 WHERE jobber_client_id = $1 LIMIT 1`,
                [row.jobber_client_id]
              );
              matchedUser = byClientId.rows[0] || null;

              if (!matchedUser && contactEmail) {
                const byEmail = await pool.query(
                  `SELECT id, full_name, email, referral_code FROM users
                   WHERE LOWER(email) = LOWER($1) AND contractor_id = $2 LIMIT 1`,
                  [contactEmail, contractorId]
                );
                matchedUser = byEmail.rows[0] || null;
              }

              if (!matchedUser && clientName) {
                const byName = await pool.query(
                  `SELECT id, full_name, email, referral_code FROM users
                   WHERE LOWER(full_name) = LOWER($1) LIMIT 1`,
                  [clientName]
                );
                matchedUser = byName.rows[0] || null;
              }

              if (matchedUser) {
                // ── SCENARIO A — App user matched ────────────────────────────────────────
                if (experienceFlowEnabled) {
                  // Store jobber_client_id in jobber_invoice_id column so post-job-sequence-complete
                  // endpoint can find the pipeline_cache row to mark post_job_modal_shown = TRUE
                  await pool.query(
                    `INSERT INTO experience_prompts (user_id, contractor_id, jobber_invoice_id, response_type)
                     VALUES ($1, $2, $3, 'pending')`,
                    [matchedUser.id, contractorId, row.jobber_client_id]
                  );
                  console.log(`[cron:post_job_sequence] Scenario A — experience prompt created for user ${matchedUser.id}`);
                }

                // Send pull-back email regardless of experience_flow_enabled
                if (matchedUser.email) {
                  const firstName = (matchedUser.full_name || '').split(' ')[0] || 'there';
                  await retryWithBackoff(
                    () => resend.emails.send({
                      from:    `${senderName} <noreply@roofmiles.com>`,
                      to:      matchedUser.email,
                      subject: 'Your project is wrapped up — come share your experience',
                      html: `
                        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
                          <p style="font-size:16px;color:#1a1a1a;margin:0 0 16px;">Hi ${firstName},</p>
                          <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 28px;">
                            We'd love to hear how your project went. Tap below to open the app and share your thoughts.
                          </p>
                          <div style="text-align:center;margin-bottom:28px;">
                            <a href="${frontendUrl}"
                               style="display:inline-block;background:#012854;color:#fff;text-decoration:none;
                                      border-radius:10px;padding:14px 28px;font-size:15px;font-weight:600;">
                              Open App
                            </a>
                          </div>
                          ${emailFooterText ? `<p style="font-size:12px;color:#999;margin:32px 0 0;">${emailFooterText}</p>` : ''}
                        </div>
                      `,
                    }),
                    { retries: 2, initialDelayMs: 500, shouldRetry: resendShouldRetry }
                  );
                }

                totalScenarioA++;
              } else {
                // ── SCENARIO B — No app user match ──────────────────────────────────────
                const recipientEmail = contactEmail;
                if (recipientEmail) {
                  // Look up a contractor invite link slug for the signup CTA
                  const slugResult = await pool.query(
                    `SELECT slug FROM contractor_invite_links
                     WHERE contractor_id = $1 AND link_type = 'contractor' AND active = TRUE
                     ORDER BY created_at DESC LIMIT 1`,
                    [contractorId]
                  );
                  const slug    = slugResult.rows[0]?.slug || null;
                  const ctaUrl  = slug ? `${frontendUrl}/?signup=${slug}` : frontendUrl;
                  const firstName = clientName.split(' ')[0] || 'there';

                  await retryWithBackoff(
                    () => resend.emails.send({
                      from:    `${senderName} <noreply@roofmiles.com>`,
                      to:      recipientEmail,
                      subject: 'We want to say thank you',
                      html: `
                        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
                          <p style="font-size:16px;color:#1a1a1a;margin:0 0 16px;">Hi ${firstName},</p>
                          <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 28px;">
                            We want to say thank you for trusting us with your work and introduce you to our
                            client portal app. Once you're signed up, we would love to know how you felt the
                            project went.
                          </p>
                          <div style="text-align:center;margin-bottom:28px;">
                            <a href="${ctaUrl}"
                               style="display:inline-block;background:#012854;color:#fff;text-decoration:none;
                                      border-radius:10px;padding:14px 28px;font-size:15px;font-weight:600;">
                              Sign Up
                            </a>
                          </div>
                          ${emailFooterText ? `<p style="font-size:12px;color:#999;margin:32px 0 0;">${emailFooterText}</p>` : ''}
                        </div>
                      `,
                    }),
                    { retries: 2, initialDelayMs: 500, shouldRetry: resendShouldRetry }
                  );
                  console.log(`[cron:post_job_sequence] Scenario B — warm welcome email sent to ${recipientEmail}`);
                  totalScenarioB++;
                } else {
                  console.log(`[cron:post_job_sequence] Scenario B — no email for client ${row.jobber_client_id}, skipping`);
                }
              }

              // Mark sequence as triggered — runs whether or not email sent successfully
              await pool.query(
                `UPDATE pipeline_cache SET t24_sequence_triggered = TRUE
                 WHERE contractor_id = $1 AND jobber_client_id = $2`,
                [contractorId, row.jobber_client_id]
              );
            } catch (rowErr) {
              await logError({
                error: rowErr,
                source: `cron:post_job_sequence — client ${row.jobber_client_id} (${contractorId})`,
              });
            }
          }
        } catch (contractorErr) {
          await logError({
            error: contractorErr,
            source: `cron:post_job_sequence — contractor ${contractorId}`,
          });
        }
      }

      console.log(
        `[cron:post_job_sequence] Complete — ${totalScenarioA} Scenario A, ${totalScenarioB} Scenario B`
      );
    });
  });
}

module.exports = { startPostJobSequenceJob };
