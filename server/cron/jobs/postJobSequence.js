const cron = require('node-cron');
const { withLock } = require('../withLock');
const { pool } = require('../../db');
const { logError } = require('../../middleware/errorLogger');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { resendShouldRetry } = require('../../utils/retryHelpers');
const { buildInviteUrl } = require('../../utils/inviteTokens');
const { getInviteHostSlug } = require('../../utils/contractorSlug');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Extracted inner body of the post-job cron, mirroring engagementCadence.js's
// _runEngagementCadencePass. Production calls it from startPostJobSequenceJob
// below, inside the same withLock it always ran inside — the extraction moves no
// behaviour, it only gives the pass a name that can be called.
//
// WHY IT EXISTS: until C/DL-2 Phase 2b this job's entire body was a closure inside
// cron.schedule(() => withLock(...)), reachable only by waiting for 7am UTC. It was
// therefore the one invite-URL generator no test could observe, which is how it came
// to be the last one still emitting an unbranded host. tenantIsolation.test.js
// documents the same gap forcing it to assert against a verbatim-copied query
// instead of the real code path.
async function _runPostJobSequencePass() {
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

      // The PUBLIC subdomain label for this contractor's invite links — never
      // contractorId, which is in scope here and is the wrong value. Resolved once
      // per contractor rather than once per due row.
      const inviteHostSlug = await getInviteHostSlug(pool, contractorId);

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

          // ⚠ THIS CHAIN'S MIDDLE STEP WAS ALREADY SCOPED AND THE OUTER TWO WERE NOT,
          // which is exactly what made it read as tenant-safe (Wave 0.3 F8). Anyone
          // checking the email step below concluded the whole fallback was filtered.
          // All three now carry contractor_id.
          const byClientId = await pool.query(
            `SELECT id, full_name, email, referral_code FROM users
             WHERE contractor_id = $2 AND jobber_client_id = $1 LIMIT 1`,
            [row.jobber_client_id, contractorId]
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
               WHERE contractor_id = $2 AND LOWER(full_name) = LOWER($1) LIMIT 1`,
              [clientName, contractorId]
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
              // NO-TOKEN fallback is unchanged: bare frontendUrl, exactly as before.
              // Distinct from the no-CONTRACTOR-SLUG fallback, which is handled inside
              // getInviteHostSlug and lands on the neutral host — this branch is the
              // case where the contractor has minted no marketing link at all, so
              // there is no token to point at.
              const ctaUrl  = slug
                ? buildInviteUrl(slug, { contractorSlug: inviteHostSlug })
                : frontendUrl;
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
}

function startPostJobSequenceJob() {
  // Daily at 7:00am UTC — after engagement cadence (6:00am) and dynamic audiences (6:10am)
  cron.schedule('0 7 * * *', () => {
    withLock('post_job_sequence', 20, async () => {
      await _runPostJobSequencePass();
    });
  });
}

module.exports = { startPostJobSequenceJob, _runPostJobSequencePass };
