const axios = require('axios');
const { pool } = require('../db');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('./retryWithBackoff');
const { resendShouldRetry, twilioShouldRetry, jobberShouldRetry } = require('./retryHelpers');
// Safe at module scope: crm/jobber.js requires only db, retryWithBackoff, retryHelpers,
// errorLogger and constants/boostSchedule — nothing that reaches back here, so there is
// no cycle. (pipelineSync.js uses lazy requires for THIS file for the opposite reason.)
const { getFreshContractorAccessToken } = require('../crm/jobber');
// THE CANONICAL escapeHtml. CLAUDE.md names this file as its home: "import from
// there, never redefine locally."
//
// UNTIL C/DL-2 PHASE 3d-1 THAT RULE WAS UNFOLLOWABLE — this function was defined
// here and omitted from module.exports, so there was no way to import it. That is
// why six route files each carry their own copy (referrer.js, account.js,
// admin/cashouts.js, resendWebhook.js, webhooks/jobber.js, crm/pipelineSync.js).
// Removing those six is a separate change with its own blast radius across the
// email, webhook, cashout and CRM paths; it is deliberately NOT bundled here.
//
// ── THE SINGLE QUOTE IS ESCAPED, AND THAT WAS A REPAIR, NOT A PREFERENCE ────
// This copy previously escaped & < > " and stopped, making it the WEAKEST of the
// seven — every local copy already escaped the apostrophe. Exporting it unrepaired
// would have made the rule followable while handing every future caller the least
// safe implementation in the repo.
//
// It matters because the first caller is a server-rendered public page
// interpolating contractor-controlled values into markup. `<img src='...'>` and
// `<div title='...'>` are both legal HTML and both are what a template naturally
// produces when the value itself contains double quotes. In either, an unescaped
// `'` closes the attribute and everything after it parses as markup.
//
// ORDER IS LOAD-BEARING: the ampersand is replaced FIRST. Escaping `<` before `&`
// would turn a lone `<` into `&amp;lt;`, which renders to the visitor as the
// literal text "&lt;".
//
// TOTAL FUNCTION by contract — nullish and non-string input yield '' rather than
// throwing. The landing page interpolates nullable branding columns (phone, email,
// address), and a throw there is a blank page on a public marketing surface.
function escapeHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getPrimaryPhone(client) {
  const phones = client.phones || [];
  if (phones.length > 0) {
    const primary = phones.find(p =>
      p.description?.toLowerCase().includes('main') ||
      p.description?.toLowerCase().includes('mobile')
    ) || phones[0];
    return primary?.number || null;
  }
  // flat-string fallback for raw webhook payloads that use client.phone instead of client.phones[]
  return (typeof client.phone === 'string' && client.phone.trim()) ? client.phone.trim() : null;
}

function getPrimaryEmail(client) {
  const emails = client.emails || [];
  if (emails.length > 0) {
    return emails[0]?.address || null;
  }
  // flat-string fallback for raw webhook payloads that use client.email instead of client.emails[]
  return (typeof client.email === 'string' && client.email.trim()) ? client.email.trim() : null;
}

// Auth: API Key (SK...) — more secure than Auth Token, revocable without account impact
function getTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET) return null;
  return require('twilio')(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, { accountSid: TWILIO_ACCOUNT_SID });
}

// ── SEND PENDING INVITE EMAIL ─────────────────────────────────────────────────
// Sends an invite email to the referrer's email address.
// Failure is logged but never thrown — a failed invite must never crash the sync.
async function sendPendingInviteEmail(pendingRecord, contractorId) {
  try {
    const settingsResult = await pool.query(
      'SELECT company_name, company_phone, logo_url, app_logo_url FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    const settings    = settingsResult.rows[0] || {};
    const companyName = escapeHtml(settings.company_name || 'Your contractor');
    const companyPhone = escapeHtml(settings.company_phone || '');
    const logoUrl     = settings.logo_url || settings.app_logo_url || null;
    const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
    const safeLogoUrl = escapeHtml(logoUrl || '');
    const safeReferrerName = escapeHtml(pendingRecord.referred_by_name || '');

    const logoHtml = logoUrl
      ? `<img src="${safeLogoUrl}" alt="${companyName}" style="max-width:180px;height:auto;display:block;margin:0 auto 24px;" />`
      : '';

    // TODO: Update CTA link to App Store URL after Capacitor build.
    await retryWithBackoff(
      () => resend.emails.send({
        from: `${companyName} <noreply@roofmiles.com>`,
        to: pendingRecord.referred_by_email,
        subject: `Someone you referred just became a client of ${companyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
            ${logoHtml}
            <h2 style="color:#012854;margin:0 0 12px;font-size:22px;">Your referral is moving forward</h2>
            <p style="color:#444;margin:0 0 24px;line-height:1.6;font-size:15px;">
              Hi ${safeReferrerName}, someone you referred just became a client of ${companyName}.
              Create your free account to track their progress as it moves through the pipeline —
              and if the job closes, you'll earn a reward you can cash out directly from the app.
            </p>
            <div style="text-align:center;margin-bottom:24px;">
              <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;font-family:sans-serif;">
                Track Your Referral
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
            <p style="color:#999;font-size:12px;margin:0;line-height:1.6;">
              ${companyName}${companyPhone ? ' · ' + companyPhone : ''}<br/>
              You're receiving this because someone listed you as a referral source.
            </p>
          </div>
        `,
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
    );
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] invite email failed:', err.message);
  }
}

// ── SEND PENDING INVITE SMS ───────────────────────────────────────────────────
// Sends an invite SMS to the referrer's phone number.
// Failure is logged but never thrown — a failed invite must never crash the sync.
// Gated on TWILIO_10DLC_ACTIVE=true — flip this in Railway after 10DLC approval.
async function sendPendingInviteSMS(pendingRecord, contractorId) {
  if (process.env.NODE_ENV !== 'production' || process.env.TWILIO_10DLC_ACTIVE !== 'true') {
    console.warn('[pendingReferral] SMS invite skipped — 10DLC not yet active');
    return;
  }
  try {
    const settingsResult = await pool.query(
      'SELECT company_name FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    const companyName = settingsResult.rows[0]?.company_name || 'Your contractor';
    const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';

    const twilio = getTwilioClient();
    if (!twilio) {
      console.warn('[pendingReferral] Twilio not configured — skipping SMS invite');
      return;
    }

    await retryWithBackoff(
      () => twilio.messages.create({
        body: `Hi, ${pendingRecord.referred_by_name} — someone you referred just became a client of ${companyName}. Create an account to track their progress and earn a reward if the job closes: ${frontendUrl}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: pendingRecord.referred_by_phone,
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: twilioShouldRetry }
    );
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] invite SMS failed:', err.message);
  }
}

// ── SEND CREDIT ATTRIBUTION EMAIL ────────────────────────────────────────────
// Sent to the REFERRED PERSON when the referrer cannot be uniquely identified.
// Asks them to forward to the referrer so they can claim their reward.
async function sendCreditAttributionEmail(referredRecord, contractorId) {
  try {
    if (!referredRecord.referred_email) return;

    const settingsResult = await pool.query(
      'SELECT company_name, company_phone, logo_url, app_logo_url FROM contractor_settings WHERE contractor_id=$1',
      [contractorId]
    );
    const settings = settingsResult.rows[0] || {};
    const companyName = escapeHtml(settings.company_name || 'Your contractor');
    const companyPhone = escapeHtml(settings.company_phone || '');
    const logoUrl = settings.logo_url || settings.app_logo_url || null;
    const safeLogoUrl = escapeHtml(logoUrl || '');
    const appUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
    const safeReferredName = escapeHtml(referredRecord.referred_name || '');
    const safeReferrerName = escapeHtml(referredRecord.referred_by_name || '');

    const logoHtml = logoUrl
      ? `<img src="${safeLogoUrl}" alt="${companyName}" style="max-width:180px;height:auto;display:block;margin:0 auto 24px;" />`
      : '';

    await retryWithBackoff(
      () => resend.emails.send({
        from: `${companyName} <noreply@roofmiles.com>`,
        to: referredRecord.referred_email,
        subject: `Help us give credit where it's due — ${companyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
            ${logoHtml}
            <h2 style="color:#012854;margin:0 0 16px;font-size:22px;">Help us give credit where it's due</h2>
            <p style="color:#444;margin:0 0 16px;line-height:1.6;">
              Hi ${safeReferredName}, someone referred you to ${companyName} —
              and we want to make sure they get the credit (and reward) they deserve.
            </p>
            <p style="color:#444;margin:0 0 24px;line-height:1.6;">
              We believe the person who referred you is <strong>${safeReferrerName}</strong>.
              Forward this email to them so they can log in and claim their reward, or simply
              reply to this email with their name and best contact info and we'll take it from there.
            </p>
            <div style="text-align:center;margin:0 0 32px;">
              <a href="${appUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
                Forward to ${safeReferrerName}
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px;" />
            <p style="color:#666;margin:0 0 12px;line-height:1.6;font-size:14px;">
              <strong>While you're at it —</strong> did you know you can earn rewards
              for referring friends and neighbors to ${companyName} too?
            </p>
            <div style="text-align:center;margin:0 0 24px;">
              <a href="${appUrl}" style="display:inline-block;background:#fff;color:#012854;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;border:2px solid #012854;">
                Check Out the Rewards App
              </a>
            </div>
            <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">
              ${companyName}${companyPhone ? ' · ' + companyPhone : ''}
              <br/>You're receiving this because you were recently referred to us.
              Reply to this email at any time.
            </p>
          </div>
        `,
        // TODO: Update CTA links to App Store URLs after Capacitor build.
        // TODO: Update email copy after brand review session.
        // TODO: Embed contractor logo for improved brand trust when logo_url is available.
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
    );

    await pool.query(
      `UPDATE pending_referrals SET credit_email_sent_at=NOW()
       WHERE contractor_id=$1 AND jobber_client_id=$2`,
      [contractorId, referredRecord.jobber_client_id]
    );

    console.log(`[pendingReferral] Credit attribution email sent to ${referredRecord.referred_email}`);
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] sendCreditAttributionEmail failed:', err.message);
  }
}

// ── FETCH REFERRER CONTACT ────────────────────────────────────────────────────
// Targeted single-client Jobber query to get phones and emails for a known client ID.
// Called only after a single name match — one API call, not a bulk fetch.
async function fetchReferrerContact(jobberId, contractorId) {
  // ── SANCTIONED TOKEN PATH (Wave 0.2 item 3) ─────────────────────────────────
  // ⚠ THIS IS THE WAVE 0.4 SITE, AND IT FAILED SILENTLY. The two nulls returned
  // below are written straight onto pending_referrals.referred_by_email and
  // .referred_by_phone by the caller — the exact column pair matchPendingReferral()
  // keys on. A token problem here therefore produces a referral that can NEVER be
  // matched, and until now left no record anywhere of why.
  //
  // BEHAVIOUR CHANGE: the raw SELECT is gone and the token is refreshed before use.
  // The SKIP is preserved exactly — { phone: null, email: null }, so the caller's
  // needs_admin_verification path is unaffected — but it is now recorded.
  let token;
  try {
    token = await getFreshContractorAccessToken(contractorId);
  } catch (tokenErr) {
    await logError({
      req: null,
      contractorId,
      error: new Error(`fetchReferrerContact: no usable Jobber token for contractor ${contractorId} — referrer ${jobberId} left without contact info: ${tokenErr.message}`),
      source: 'pendingReferral — fetchReferrerContact token',
    });
    return { phone: null, email: null };
  }

  try {
    const response = await retryWithBackoff(
      () => axios.post(
        'https://api.getjobber.com/api/graphql',
        {
          query: `query GetReferrerContact($id: EncodedId!) {
            client(id: $id) {
              phones { number description }
              emails { address description }
            }
          }`,
          variables: { id: jobberId },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
          },
        }
      ),
      { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
    );
    const c = response.data?.data?.client;
    if (!c) return { phone: null, email: null };
    return { phone: getPrimaryPhone(c), email: getPrimaryEmail(c) };
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] fetchReferrerContact failed:', err.message);
    return { phone: null, email: null };
  }
}

// ── REFERRAL MATCH OUTREACH GATE ──────────────────────────────────────────────
// One contractor-level switch over EVERY message this file sends when a referral
// is matched: the invite to the REFERRER and the credit-attribution email to the
// REFERRED person, over email AND SMS. Zero outbound means zero.
//
// ⚠ DEFAULT OFF, AND IT IS THE ONLY DEFAULT-OFF TRIGGER IN THE TABLE.
// The other fifteen notification_preferences triggers ship ON, and both the
// server helper and the UI control encode that: isEmailSuppressed() treats an
// ABSENT row as "not suppressed" (emailSuppression.js — send), and NotifToggle
// computes `checked !== false` so an unknown key renders as ON. Both are correct
// for their fifteen and exactly wrong here.
//
// ⚠ SO THIS DOES NOT — AND MUST NOT — REUSE isEmailSuppressed(). Two independent
// reasons, either one disqualifying:
//   1. An absent row must mean OFF here, and it means SEND there.
//   2. It fails OPEN on a DB error, which is right when the consequence of a
//      wrong answer is a missed notification. Here the consequence is mailing
//      every referrer in the backlog, so this one FAILS CLOSED.
// CLAUDE.md: write the guard the value needs, and say why it differs from the
// ones beside it. This is that comment.
//
// Returns true ONLY on an explicit `email_enabled = true` row. Absent row,
// NULL, false, or any error → false.
const REFERRAL_MATCH_OUTREACH_KEY = 'referral_match_outreach';

async function isMatchOutreachEnabled(contractorId) {
  try {
    const { rows } = await pool.query(
      `SELECT email_enabled FROM notification_preferences
        WHERE contractor_id = $1 AND trigger_key = $2`,
      [contractorId, REFERRAL_MATCH_OUTREACH_KEY]
    );
    // Strict === true. `rows[0]?.email_enabled` is undefined for an absent row
    // and a truthiness check would be fine today, but the column is nullable in
    // principle and this is the one predicate in the file where a wrong answer
    // is outbound mail to real people.
    return rows[0]?.email_enabled === true;
  } catch (err) {
    await logError({
      req: null,
      contractorId,
      error: new Error(`isMatchOutreachEnabled: could not read the referral match outreach gate for ${contractorId} — failing CLOSED, no outreach sent: ${err.message}`),
      source: 'pendingReferral — match outreach gate',
    });
    return false;
  }
}

// ── REFERRER NAME MATCH THRESHOLD ─────────────────────────────────────────────
// ⚠ 0.6, AND IT IS DELIBERATELY NOT THE CONTACT MATCHING STANDARD'S 0.4.
// DO NOT "CORRECT" THIS INTO LINE WITH THE STANDARD. The Standard's 0.4 is a
// CONFIRMATION signal sitting behind an email-or-phone primary key — it only
// ever has to reject a false positive that already matched on contact details.
// Here the name IS the primary key, with no second signal behind it, and 0.4 is
// far too loose for that job: measured against the 13 production rows, "Bobby"
// returned 16 candidates at 0.4 and "Phyllis Davis" returned 11. At 0.6, twelve
// of the thirteen return exactly one, and "Allstate" correctly returns none.
// Measured 2026-08-25 — the server suite brackets this to (0.5882, 0.6250] with
// a fixture pair whose real similarity it asserts before relying on it.
const REFERRER_MATCH_THRESHOLD = 0.6;

// ── NORMALISED NAME EXPRESSION ────────────────────────────────────────────────
// ⚠ [[:space:]]+ AND NOT \s+, AND THIS PRODUCES NO ERROR IF YOU GET IT WRONG.
// On this path a '\s+' pattern does not reach the regex engine as a whitespace
// class — it matches the literal letter "s". regexp_replace('tommy  mills',
// '\s+', ' ', 'g') returns 'tommy  mill ': the doubled space SURVIVES and the
// "s" of "mills" is eaten. Two equally-corrupted strings still compare equal, so
// the damage is invisible until a corrupted name is displayed. Measured
// 2026-08-25. [[:space:]] also strips NBSP, which btrim() alone does not.
//
// ⚠ WHY NORMALISE AT ALL, BECAUSE THE OBVIOUS REASON IS WRONG AND WAS RECORDED.
// Wave 0.4's scope ruling originally read "0.4 MUST NORMALISE — Tommy Mills is
// the proof." That is FALSE and correcting it is the point of this comment.
// pg_trgm builds trigrams over collapsed whitespace and folded case, so
// similarity('tommy  mills','tommy mills') is exactly 1.0000 — as are the NBSP,
// tab, leading-space and mixed-case variants. The trigram query resolves the
// specimen with no normalisation whatsoever.
// Normalisation stays for two reasons that ARE true:
//   1. DETERMINISM — two rows differing only in whitespace must score
//      IDENTICALLY, so ranking is stable and a tie is a real tie.
//   2. Consistency with the six other name-matching implementations in this
//      codebase, which is the only thing preventing a seventh divergence.
// ⚠ If you test this, find that trigram absorbs whitespace anyway, and conclude
// the normalisation is dead code — you are reasoning correctly from a premise
// this comment exists to remove. Leave it.
const NORM_SQL = (expr) =>
  `btrim(regexp_replace(lower(${expr}), '[[:space:]]+', ' ', 'g'))`;

// ── FIND REFERRER CANDIDATES ──────────────────────────────────────────────────
// Ranks jobber_clients rows for this contractor against a free-text "Referred
// by" name, forward and reversed, and returns those at or above the threshold,
// best first.
//
// Input:  contractorId, referredByName (raw CRM string, may be untrimmed/empty)
// Output: [{ jobber_client_id, display_name, email, phone, score }], best first.
//         Empty array when the name is blank or nothing clears the threshold.
//
// ⚠ REPLACED AN IN-MEMORY allClients.filter() THAT WAS EMPTY ON EVERY WEBHOOK
// CALL. Both webhook handlers pass [] literally, and the incremental sync passes
// only the current chunk window — so across 13 production pending referrals the
// name match had never once succeeded. The table holds 18,651 rows for this
// tenant and is not subject to Jobber's filter limitations at all.
//
// ⚠ NO INDEX IS USED HERE, AND ADDING ONE WITHOUT CHANGING THE PREDICATE DOES
// NOTHING. A gin_trgm_ops index cannot serve `similarity(a,b) >= x` — only the
// `%` operator can, which additionally requires SET pg_trgm.similarity_threshold.
// Measured on 18,651 rows: the function form plans a Seq Scan whether or not the
// index exists (~40 ms), and only the operator form plans an index scan. An
// index added on its own is therefore inert while looking like a fix. Not built
// in Wave 0.4 because ~40 ms is not a problem at this scale; when it becomes
// one, change BOTH the index and this predicate together.
//
// is_archived is deliberately NOT filtered: uniform non-filtering across every
// outbound surface was ruled 2026-08-23 and belongs to the Client Lifecycle
// Protocol, not here.
async function findReferrerCandidates(contractorId, referredByName) {
  if (!referredByName || typeof referredByName !== 'string' || !referredByName.trim()) return [];

  const fwd  = NORM_SQL(`coalesce(jc.first_name,'') || ' ' || coalesce(jc.last_name,'')`);
  const rev  = NORM_SQL(`coalesce(jc.last_name,'')  || ' ' || coalesce(jc.first_name,'')`);
  const best = `GREATEST(similarity(${fwd}, n.needle), similarity(${rev}, n.needle))`;

  const { rows } = await pool.query(
    `WITH n AS (SELECT ${NORM_SQL('$2::text')} AS needle)
     SELECT jc.jobber_client_id,
            btrim(regexp_replace(
              coalesce(jc.first_name,'') || ' ' || coalesce(jc.last_name,''),
              '[[:space:]]+', ' ', 'g')) AS display_name,
            jc.email,
            jc.phone,
            ${best} AS score
       FROM jobber_clients jc, n
      WHERE jc.contractor_id = $1
        AND ${best} >= $3
      ORDER BY score DESC, jc.jobber_client_id`,
    [contractorId, referredByName, REFERRER_MATCH_THRESHOLD]
  );
  return rows;
}

// ── CHECK AND CREATE PENDING REFERRAL ─────────────────────────────────────────
// Called from syncSingleClient for every referred client.
// If the referrer has no app account, creates a pending_referrals record then
// looks them up in Jobber by name to find their contact info for the auto-invite.
// No-op if user account already exists or record already processed.
//
// ⚠ THE MVP NOTE THAT STOOD HERE IS RETIRED, NOT EDITED — IT IS NOW INVERTED.
// It read: "webhook path calls this with allClients=[] ... When allClients=[] the
// name match always fails". That was true and is now false: Wave 0.4 moved the
// candidate source to the jobber_clients table, so an empty allClients no longer
// affects the match at all. Both webhook handlers still pass [] literally
// (webhooks/jobber.js, the two syncSingleClient calls) and that is now harmless.
//
// ⚠ allClients SURVIVES FOR ONE PURPOSE ONLY: the isRetry gate below still uses
// `allClients.length > 0` as a proxy for "a scheduled sync is running", which
// keeps webhook-triggered re-processing off. That proxy no longer means what its
// name suggests and is a candidate for retirement — but changing retry frequency
// is a behaviour change with its own blast radius and is deliberately NOT bundled
// into the matcher rebuild. Flagged, not fixed.
async function checkAndCreatePendingReferral(contractorId, client, referredByName, allClients = []) {
  // Check if referrer already has an account WITH THIS CONTRACTOR (Wave 0.3 F8).
  // ⚠ THIS ONE FAILS BY NOT ACTING, which is why it is the hardest of the twelve to
  // notice. Unscoped, the question was answered from every tenant at once: a name
  // held under another contractor tripped the early return below and this
  // contractor's pending referral was silently never created. No row, no error,
  // nothing to find afterwards — the referral simply did not exist.
  const userResult = await pool.query(
    'SELECT id FROM users WHERE contractor_id = $2 AND LOWER(full_name) = LOWER($1) AND deleted_at IS NULL LIMIT 1',
    [referredByName, contractorId]
  );
  if (userResult.rows.length > 0) return;

  const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim();

  // Check if a pending record already exists for this client
  const existingResult = await pool.query(
    `SELECT id, needs_admin_verification, invite_channel, status
     FROM pending_referrals WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, client.id]
  );

  // Allow re-processing only if the record was flagged for admin verification with no
  // invite sent and we now have a real client list. This repairs webhook-created records
  // on the next scheduled full sync.
  let isRetry = false;
  if (existingResult.rows.length > 0) {
    const rec = existingResult.rows[0];
    if (
      rec.needs_admin_verification &&
      rec.invite_channel === 'none' &&
      rec.status === 'pending' &&
      allClients.length > 0
    ) {
      isRetry = true;
    } else {
      return;
    }
  }

  if (!isRetry) {
    // Insert with null contact info — populated after Jobber lookup below
    const insertResult = await pool.query(
      `INSERT INTO pending_referrals
         (contractor_id, jobber_client_id, client_name, referred_by_name,
          referred_by_phone, referred_by_email, invite_channel,
          invite_sent_at, status)
       VALUES ($1, $2, $3, $4, NULL, NULL, 'none', NULL, 'pending')
       ON CONFLICT (contractor_id, jobber_client_id) DO NOTHING
       RETURNING id`,
      [contractorId, client.id, clientName, referredByName]
    );

    if (insertResult.rows.length === 0) return; // conflict — already existed
  }

  // ── REFERRER JOBBER LOOKUP ────────────────────────────────────────────────────
  // The referrer is named in the "Referred by" field but their contact info is in
  // their own Jobber client record — not in the referred person's record.
  // Look them up by name to find their phone/email for the auto-invite.
  //
  // Jobber ClientFilterAttributes does not support name filtering — confirmed in
  // GraphiQL — so the lookup cannot happen remotely. It now happens against the
  // persisted jobber_clients table (Wave 0.4). See findReferrerCandidates.
  let inviteChannel = 'none';
  let inviteSentAt = null;

  try {
    const matches = await findReferrerCandidates(contractorId, referredByName);

    await pool.query(
      'UPDATE pending_referrals SET referrer_lookup_attempted=true WHERE contractor_id=$1 AND jobber_client_id=$2',
      [contractorId, client.id]
    );

    // ⚠ A LONE CANDIDATE WITH NO WAY TO CONTACT THEM IS NOT A MATCH.
    // referred_by_email / referred_by_phone are the exact column pair
    // matchPendingReferral() keys on. Writing NULL into both while clearing
    // needs_admin_verification produces a row that can never match and that
    // nothing flags — which is the precise defect this wave exists to remove.
    // So a single candidate carrying neither falls through to the admin branch
    // below, where it is offered as a candidate rather than silently accepted.
    const soleMatch = matches.length === 1 && (matches[0].email || matches[0].phone)
      ? matches[0]
      : null;

    if (soleMatch) {
      // ⚠ NO JOBBER ROUND-TRIP HERE, AND THAT IS THE POINT (Wave 0.4).
      // This branch used to call fetchReferrerContact() for exactly these two
      // values. All three jobber_clients write sites already persist them
      // (fullJobberImport Step H, jobberIncrementalSync, upsertAndTagClient), so
      // the round-trip bought nothing and cost one external call, one retry
      // wrapper, and one silent-null failure mode on the critical path — a token
      // problem there left the referral permanently unmatchable.
      // fetchReferrerContact is still used by the ADMIN confirm-referrer route,
      // which resolves an id a human picked and has no local row to read.
      const referrerPhone = soleMatch.phone;
      const referrerEmail = soleMatch.email;

      await pool.query(
        `UPDATE pending_referrals
         SET referred_by_phone=$1, referred_by_email=$2, needs_admin_verification=false
         WHERE contractor_id=$3 AND jobber_client_id=$4`,
        [referrerPhone, referrerEmail, contractorId, client.id]
      );

      const pendingResult = await pool.query(
        `SELECT id, referred_by_name, referred_by_email, referred_by_phone, invite_sent_at
         FROM pending_referrals WHERE contractor_id=$1 AND jobber_client_id=$2`,
        [contractorId, client.id]
      );
      const pendingRecord = pendingResult.rows[0];

      // ── IDEMPOTENCY GUARD — AND IT ANSWERS EXACTLY ONE QUESTION ──────────────
      // ⚠ THIS ANSWERS "HAS THIS ALREADY BEEN SENT". IT DOES NOT ANSWER "WAS THIS
      // DELIBERATELY WITHHELD", AND ON A HELD ROW IT RETURNS THE PERMISSIVE ANSWER.
      // A row held by a closed gate has invite_sent_at = NULL, so this guard lets
      // it through. It is NOT forward-only protection and must never be mistaken
      // for it — see the block below the send for what actually holds that line.
      //
      // Why it exists at all: nothing at this send site prevented a second invite.
      // The property was real but incidental — provided by the existing-row early
      // return above, whose actual purpose is avoiding duplicate row processing.
      // Q7 measured retries firing at roughly 1:1 with creations, so the moment
      // matching started succeeding this was one reachability change away from
      // mailing already-invited referrers again.
      const alreadyInvited = !!pendingRecord.invite_sent_at;

      // ⚠ THE GATE SITS ABOVE BOTH CHANNELS RATHER THAN INSIDE EITHER.
      // Twilio is dark today (sendPendingInviteSMS returns early unless
      // TWILIO_10DLC_ACTIVE), so gating only the email would look complete and
      // would deliver the same surprise through the other door on the day 10DLC
      // clears. One switch, both channels — and the idempotency guard above it,
      // so an already-invited row is not even asked about the gate.
      if (!alreadyInvited && await isMatchOutreachEnabled(contractorId)) {
        if (referrerEmail) {
          await sendPendingInviteEmail(pendingRecord, contractorId);
          inviteChannel = referrerPhone ? 'email_and_sms' : 'email';
        }
        if (referrerPhone) {
          await sendPendingInviteSMS(pendingRecord, contractorId);
          if (inviteChannel === 'email') inviteChannel = 'email_and_sms';
          else if (inviteChannel === 'none') inviteChannel = 'sms';
        }
        if (inviteChannel !== 'none') inviteSentAt = new Date();
      }
      // ⚠ WHEN THE GATE IS CLOSED, inviteChannel STAYS 'none' AND inviteSentAt
      // STAYS NULL, AND THAT IS LOAD-BEARING IN TWO PLACES.
      //
      // 1. FORWARD-ONLY LIVES HERE, IN THE ROW, NOT IN A RUNTIME READ OF THE
      //    TOGGLE. The match above has already set needs_admin_verification =
      //    false. The isRetry gate requires needs_admin_verification === true,
      //    so this row can never re-enter the send path on a later sync — which
      //    is exactly what must remain true after an admin flips the toggle ON.
      //    A runtime "is the gate open?" check at send time would release the
      //    entire backlog the moment it flipped. It does not, because by then
      //    the row's own state has taken it out of contention permanently.
      //    ⚠ Consequence, and it is deliberate: a held row has NO automatic
      //    release. Releasing one is the manual-send action deferred to the
      //    Missing Referrals resolution workflow.
      //
      // 2. This trio — contact populated, invite_channel 'none', invite_sent_at
      //    NULL — IS the held state the admin card derives from (item 3). No new
      //    column: the fact is derived from the facts rather than duplicated
      //    beside them.

    } else {
      // No match, multiple matches, or a lone candidate with no contact info —
      // flag for admin verification and offer whatever candidates were found.
      //
      // ⚠ display_name IS ALREADY NORMALISED BY THE QUERY, not here. This string
      // is rendered verbatim to an admin (AdminPendingReferrals.jsx candidate
      // list), and 22% of jobber_clients name fields are stored untrimmed — the
      // old `${first} ${last}`.trim() left an interior double space intact
      // because trimming a joined string only strips its ends.
      const matchData = matches.map(m => ({
        id: m.jobber_client_id,
        name: m.display_name,
        email: m.email,
        phone: m.phone,
      }));

      await pool.query(
        `UPDATE pending_referrals
         SET needs_admin_verification=true, jobber_name_matches=$1
         WHERE contractor_id=$2 AND jobber_client_id=$3`,
        [JSON.stringify(matchData), contractorId, client.id]
      );

      // Send "help us give credit" email to the REFERRED PERSON only on first creation.
      // On retry, the referred client already received this email — do not resend.
      //
      // ⚠ THE SAME GATE COVERS THIS MESSAGE, AND THAT IS THE POINT OF ONE TOGGLE.
      // It goes to a different person (the referred client, not the referrer) on
      // a different branch, which is precisely why it would be missed. The card's
      // sub-copy promises "both referrer and referred"; two switches could not
      // honour that, and a contractor who turns outreach off means off.
      if (!isRetry && await isMatchOutreachEnabled(contractorId)) {
        const referredEmail = getPrimaryEmail(client);
        const referredPhone = getPrimaryPhone(client);
        // diagnostic log — intentional
        console.log('[pendingReferral] referred client contact extraction — email:', referredEmail, 'phone:', referredPhone, 'client id:', client.id);
        if (referredEmail || referredPhone) {
          await sendCreditAttributionEmail(
            {
              referred_name: clientName,
              referred_email: referredEmail,
              referred_phone: referredPhone,
              referred_by_name: referredByName,
              client_name: clientName,
              jobber_client_id: client.id,
            },
            contractorId
          );
          // diagnostic log — intentional
          console.log('[pendingReferral] credit attribution email sent to:', referredEmail);
        } else {
          // diagnostic log — intentional
          console.warn('[pendingReferral] credit attribution skipped — no contact info found for referred client:', clientName);
        }
      }

      const reason = matches.length === 0 ? 'no_jobber_match' : 'multiple_jobber_matches';
      console.warn(`[pendingReferral] Admin verification required for ${referredByName} — ${reason}`);
    }

    await pool.query(
      `UPDATE pending_referrals
       SET invite_channel=$1, invite_sent_at=$2
       WHERE contractor_id=$3 AND jobber_client_id=$4`,
      [inviteChannel, inviteSentAt, contractorId, client.id]
    );

  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] referrer lookup failed:', err.message);
  }

  try {
    await pool.query(
      `INSERT INTO activity_log (event_type, detail) VALUES ('pending_referral_created', $1)`,
      [`Pending referral ${isRetry ? 'retry' : 'created'} for referrer "${referredByName}" (client: "${clientName}"). Channel: ${inviteChannel}`]
    );
  } catch (logErr) {
    await logError({ req: null, error: logErr });
    console.warn('[pendingReferral] activity_log insert failed:', logErr.message);
  }
}

// ── SEND PENDING REWARD EMAIL ─────────────────────────────────────────────────
// Sent to a pending referrer (no app account) when their referred client reaches
// paid status. Money is waiting — CTA drives account creation to claim it.
// Failure is logged but never thrown — must not crash the sync.
async function sendPendingRewardEmail(pendingReferrerEmail, pendingReferrerName, clientName, bonusAmount, contractorId) {
  try {
    if (!pendingReferrerEmail) return;

    const settingsResult = await pool.query(
      'SELECT email_sender_name, company_name, logo_url, app_logo_url FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    const settings = settingsResult.rows[0] || {};
    const fromName = escapeHtml(settings.email_sender_name || settings.company_name || 'RoofMiles');
    const companyName = escapeHtml(settings.company_name || 'your contractor');
    const logoUrl = settings.logo_url || settings.app_logo_url || null;
    const safeLogoUrl = escapeHtml(logoUrl || '');
    const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
    const safeReferrerName = escapeHtml(pendingReferrerName || '');
    const safeClientName = escapeHtml(clientName || '');
    const formattedAmount = parseFloat(bonusAmount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    const logoHtml = logoUrl
      ? `<img src="${safeLogoUrl}" alt="${companyName}" style="max-width:180px;height:auto;display:block;margin:0 auto 24px;" />`
      : '';

    await retryWithBackoff(
      () => resend.emails.send({
        from: `${fromName} <noreply@roofmiles.com>`,
        to: pendingReferrerEmail,
        subject: `You've earned a $${formattedAmount} reward from ${companyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
            ${logoHtml}
            <h2 style="color:#012854;margin:0 0 12px;font-size:22px;">Your reward is waiting</h2>
            <p style="color:#444;margin:0 0 24px;line-height:1.6;font-size:15px;">
              A referral you sent to ${companyName} just closed. You've earned $${formattedAmount} — but you need an account to claim it. Create one now and it'll be waiting in your balance.
            </p>
            <div style="text-align:center;margin-bottom:24px;">
              <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;font-family:sans-serif;">
                Claim Your Reward
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
            <p style="color:#999;font-size:12px;margin:0;line-height:1.6;">
              ${companyName}<br/>
              You're receiving this because someone listed you as a referral source.
            </p>
          </div>
        `,
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
    );
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] sendPendingRewardEmail failed:', err.message);
  }
}

// ── MATCH PENDING REFERRAL ────────────────────────────────────────────────────
// Called after email verification to link a new user to any pending referral record.
// Matches on email (case-insensitive) or phone. Returns matched record or null.
async function matchPendingReferral(userId, email, phone) {
  // ── TENANT SCOPE IS DERIVED, NEVER SUPPLIED (Wave 0.3 F8) ────────────────────
  // ⚠ THIS IS THE ONE F8 SITE THAT WAS NOT A ONE-LINE FILTER. Both queries below
  // matched pending_referrals on identity alone, and NEITHER END of the call had a
  // tenant: the signature took none, and the only caller (referrer.js:718) selected
  // just email and phone from the user row. A newly verified signup under one
  // contractor could therefore claim a pending referral belonging to another —
  // proven, not theorised: the F8-3/F8-4 tests observed matched_user_id being set
  // cross-tenant.
  //
  // ⚠ DERIVED FROM userId, NOT ACCEPTED AS A PARAMETER, and that is deliberate.
  // users.contractor_id is NOT NULL with an FK to contractors (db.js:1201-1240), so
  // the user's own row is authoritative and cannot disagree with itself. A
  // caller-supplied contractorId CAN disagree with the user's real tenant — and a
  // mismatch there is the same class of defect F8 exists to fix, arriving through
  // the parameter list instead of through a missing WHERE clause. There is no
  // argument to prefer, so there is no wrong argument to pass.
  //
  // FAILS CLOSED. A user id that resolves to no row matches nothing rather than
  // falling back to an unscoped search — the unscoped search is the bug.
  const ownerResult = await pool.query(
    'SELECT contractor_id FROM users WHERE id = $1',
    [userId]
  );
  const contractorId = ownerResult.rows[0]?.contractor_id || null;
  if (!contractorId) {
    await logError({
      req: null,
      error: new Error(`matchPendingReferral: no contractor for user ${userId} — refusing to match a pending referral without a tenant`),
      source: 'pendingReferral — matchPendingReferral tenant',
    });
    return null;
  }

  let match = null;

  if (email) {
    const result = await pool.query(
      `SELECT id FROM pending_referrals
       WHERE contractor_id = $2 AND status = 'pending' AND LOWER(referred_by_email) = LOWER($1)
       LIMIT 1`,
      [email, contractorId]
    );
    if (result.rows.length > 0) match = result.rows[0];
  }

  if (!match && phone) {
    // Normalize both sides to digits-only to handle format differences between
    // Jobber-stored numbers (e.g. "+1 (555) 999-5555") and signup-entered numbers.
    const result = await pool.query(
      `SELECT id FROM pending_referrals
       WHERE contractor_id = $2 AND status = 'pending'
         AND REGEXP_REPLACE(referred_by_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE($1, '[^0-9]', '', 'g')
       LIMIT 1`,
      [phone, contractorId]
    );
    if (result.rows.length > 0) match = result.rows[0];
  }

  if (!match) return null;

  await pool.query(
    `UPDATE pending_referrals
     SET matched_user_id = $1, matched_at = NOW(), status = 'matched'
     WHERE id = $2`,
    [userId, match.id]
  );

  return match;
}

module.exports = {
  checkAndCreatePendingReferral,
  matchPendingReferral,
  sendPendingInviteEmail,
  sendPendingInviteSMS,
  sendCreditAttributionEmail,
  sendPendingRewardEmail,
  // Exported as of C/DL-2 Phase 3d-1. CLAUDE.md has always named this file as
  // escapeHtml's home; until now it was not actually importable from here.
  escapeHtml,
  // ⚠ EXPORTED IN WAVE 0.4, AND THIS WAS A LIVE 500, NOT A TEST CONVENIENCE.
  // admin/index.js's POST /api/admin/pending-referrals/:id/confirm-referrer has
  // destructured this name since it was written. It was never exported, so the
  // binding was `undefined` and calling it raised
  // "TypeError: fetchReferrerContact is not a function" — caught by the route's
  // own catch and returned to the admin as a generic 500.
  //
  // ⚠ IT WAS UNREACHABLE UNTIL NOW, WHICH IS WHY NOBODY FOUND IT. That route
  // only runs when an admin clicks "Confirm This Referrer", and that button only
  // renders when jobber_name_matches is non-empty (AdminPendingReferrals.jsx).
  // The old in-memory matcher wrote `[]` on every single call, so the candidate
  // list was always empty and the button never appeared. Wave 0.4's matcher
  // writes real candidates for the first time — which ACTIVATES this path. A
  // latent defect made live by a change in a different file.
  fetchReferrerContact,
};
