'use strict';

// ── THE ONE SHARED NOTIFY (7d, Danny 2026-10-01) ──────────────────────────────
//
// The bonus-earned email (#4) and the first-reward milestone (#13) live HERE, once, and are sent by
// whichever path made a NEW credit. Before 7d both templates sat inline in the invoice-paid handler,
// so a client credited by any other route — the sync, a stage webhook, the catch-up job, a re-capture
// — got no email at all, and the obvious fix (copy the templates to each site) is how one wording
// change becomes four.
//
// ⚠ CALLED AFTER THE LOCK IS RELEASED, NEVER INSIDE IT. `withClientLock` holds a pooled connection,
// and sending mail means an outbound HTTP call with two retries. Commit 6b fixed exactly this defect
// inside `withClientLock` itself — its rollback path awaited `logError`, which can send a Resend
// alert, and was safe only because that one call passed `alert: false`. **Pool safety resting on a
// flag is not pool safety**, so this function is deliberately not callable from within the
// transaction: it takes a `pool`, not a `tx`.
//
// ⚠ AND IT IS CALLED ONLY WHEN A CREDIT WAS *INSERTED*. `creditReferralFromFacts` returns
// `credited: false` for a duplicate delivery (`qualified: true`, `inserted: false`), and emailing on
// `qualified` is precisely how a referrer would be told twice about one bonus. The caller passes the
// credit result through; it does not re-derive eligibility.
//
// ⚠ IT NEVER THROWS INTO ITS CALLER. A failed email must not undo a credit that is already committed
// — the money is the record, the email is the courtesy. Each send is wrapped and logged.
//
// ⚠ NO REAL SEND IS POSSIBLE FROM A TEST. `server/test/setup.js`'s interlock (7d-0) refuses
// `Emails.prototype.send` by default and blocks any fetch to a resend.com host; a suite that
// legitimately drives a send opts in with `captureResend()` and asserts on the recorded payloads.
// That is what makes it safe to assert on these two emails at all.

const { retryWithBackoff } = require('./retryWithBackoff');
const { resendShouldRetry } = require('./retryHelpers');
const { isEmailSuppressed } = require('./emailSuppression');
const { escapeHtml } = require('./pendingReferral');
const { logError: realLogError } = require('../middleware/errorLogger');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠ ONE SEAM, MATCHING THE WEBHOOK ROUTER'S. Tests override it; production never does.
let _sendEmail = (...args) => resend.emails.send(...args);
function _setTestOverrides({ sendEmail } = {}) {
  if (sendEmail !== undefined) _sendEmail = sendEmail;
}
function _resetTestOverrides() {
  _sendEmail = (...args) => resend.emails.send(...args);
}

/** Money with thousands separators and two decimals, as the old inline templates rendered it. */
function formatDollars(amount) {
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * The shared shell both emails use. ONE set of markup, so a wording or colour change lands once.
 * Inputs: { heading, body, ctaUrl, ctaLabel }. Output: an HTML string.
 */
function shell({ heading, body, ctaUrl, ctaLabel }) {
  return `
                        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                          <h2 style="color:#012854;margin:0 0 12px;">${heading}</h2>
                          <p style="color:#444;margin:0 0 24px;line-height:1.6;">${body}</p>
                          <div style="text-align:center;margin-bottom:24px;">
                            <a href="${ctaUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">${ctaLabel}</a>
                          </div>
                        </div>
                      `;
}

/**
 * Sends the bonus-earned email, and the first-milestone email when this was the referrer's first.
 * Inputs: a pool, the credit result plus { contractorId, req, logError }.
 * Output: { sent: [...templateKeys], skipped: [...], failed: [...] }.
 *
 * ⚠ THE RETURN NAMES WHICH EMAILS WENT, because "it sent" is not assertable and "it sent #4 and not
 * #13" is. Every guard-proof for this function counts the recorded payloads.
 */
async function notifyReferralCredit(pool, {
  contractorId, userId, bonusAmount, isFirstConversion, clientName,
  req = null, logError = realLogError,
} = {}) {
  const out = { sent: [], skipped: [], failed: [] };
  if (!contractorId || !userId) {
    out.skipped.push('missing_identity');
    return out;
  }

  try {
    const { rows } = await pool.query('SELECT full_name, email FROM users WHERE id = $1', [userId]);
    const referrer = rows[0];
    if (!referrer || !referrer.email) {
      out.skipped.push('no_referrer_email');
      return out;
    }

    const { rows: csRows } = await pool.query(
      `SELECT email_sender_name, company_name FROM contractor_settings
        WHERE contractor_id = $1 LIMIT 1`,
      [contractorId]
    );
    const cs = csRows[0] || {};
    const fromName = escapeHtml(cs.email_sender_name || cs.company_name || 'RoofMiles');
    const from = `${fromName} <noreply@roofmiles.com>`;
    const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
    const firstName = escapeHtml((referrer.full_name || '').split(' ')[0] || referrer.full_name);
    const safeClientName = escapeHtml(clientName || 'your referral');
    const formattedAmount = formatDollars(bonusAmount);

    // ⚠ BOTH TEMPLATES IN ONE PLACE, AND BOTH RESPECT SUPPRESSION. The keys are the ones the
    // suppression table already uses, so moving the sends here changes no stored preference.
    const messages = [
      {
        key: 'bonus_earned',
        subject: `You just earned $${formattedAmount}`,
        html: shell({
          heading: 'Your reward is ready',
          body: `${firstName}, ${safeClientName}'s job is complete and your $${formattedAmount} reward has been added to your balance. Cash out anytime directly from the app.`,
          ctaUrl: frontendUrl,
          ctaLabel: 'Cash Out Now',
        }),
      },
    ];
    if (isFirstConversion) {
      messages.push({
        key: 'first_reward_milestone',
        subject: 'You just earned your first reward',
        html: shell({
          heading: 'First one in the books',
          body: `${firstName}, your first referral reward just posted to your balance. This is just the beginning — every referral you send is another opportunity to earn. Cash out anytime.`,
          ctaUrl: frontendUrl,
          ctaLabel: 'Cash Out Now',
        }),
      });
    }

    for (const m of messages) {
      try {
        if (await isEmailSuppressed(contractorId, referrer.email, m.key)) {
          out.skipped.push(m.key);
          continue;
        }
        await retryWithBackoff(
          () => _sendEmail({ from, to: referrer.email, subject: m.subject, html: m.html }),
          { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
        );
        out.sent.push(m.key);
      } catch (sendErr) {
        out.failed.push(m.key);
        await logError({
          req, contractorId,
          error: new Error(`[referralNotify] ${m.key} failed for user ${userId}: ${sendErr.message}`),
          source: 'notifyReferralCredit — send',
          alert: false,
        });
      }
    }
  } catch (err) {
    out.failed.push('lookup');
    await logError({
      req, contractorId,
      error: new Error(`[referralNotify] notify failed for user ${userId}: ${err.message}`),
      source: 'notifyReferralCredit',
      alert: false,
    });
  }
  return out;
}

module.exports = {
  notifyReferralCredit,
  formatDollars,
  _setTestOverrides,
  _resetTestOverrides,
};
