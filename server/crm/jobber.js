const axios = require('axios');
const { pool } = require('../db');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../utils/retryHelpers');
const { logError } = require('../middleware/errorLogger');

// ── TOKEN AUTO-REFRESH ────────────────────────────────────────────────────────
// force=true bypasses the expires_at freshness check and always exchanges the refresh
// token. Used by the invoice-paid webhook's 401 retry path (2c mitigation): with refresh
// token rotation enabled and multiple uncoordinated call sites sharing a contractor's
// tokens row, a concurrent refresh elsewhere can invalidate the token this caller just
// read even though expires_at still looked fresh — force lets the caller recover in place
// rather than trusting a freshness check that a sibling refresh has already invalidated.
//
// Single-flight guard — per-process only. If RoofMiles ever runs multiple server
// instances, replace/augment with a Postgres advisory lock (e.g.
// pg_advisory_xact_lock(hashtext(contractor_id))) so the guard is visible across
// instances. Railway runs a single instance today.
const inFlightRefreshes = new Map(); // contractorId -> Promise

async function refreshTokenIfNeeded(contractorId, { force = false } = {}) {
  if (!contractorId) {
    const err = new Error('refreshTokenIfNeeded: contractorId is required');
    await logError({ req: null, error: err, source: 'refreshTokenIfNeeded' });
    throw err;
  }

  // A force caller arriving while a refresh is already in flight awaits that refresh
  // (it produces a brand-new token, which is what force wants) rather than starting a
  // second exchange — force bypasses only the expiry check below, never this guard.
  if (inFlightRefreshes.has(contractorId)) {
    return inFlightRefreshes.get(contractorId);
  }

  const refreshPromise = (async () => {
    const result = await pool.query('SELECT refresh_token, expires_at FROM tokens WHERE contractor_id = $1', [contractorId]);
    if (result.rows.length === 0) {
      throw new Error(`refreshTokenIfNeeded: no access token found for contractor ${contractorId} — visit /auth/jobber`);
    }
    const { refresh_token, expires_at } = result.rows[0];
    const fiveMin = new Date(Date.now() + 5 * 60 * 1000);
    if (force || !expires_at || new Date(expires_at) < fiveMin) {
      console.log('Refreshing token...');
      const response = await retryWithBackoff(
        () => axios.post('https://api.getjobber.com/api/oauth/token', {
          grant_type: 'refresh_token', client_id: process.env.JOBBER_CLIENT_ID,
          client_secret: process.env.JOBBER_CLIENT_SECRET, refresh_token,
        }),
        { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
      );
      const newAccess = response.data.access_token;
      const newRefresh = response.data.refresh_token;
      const newExpiry = new Date(Date.now() + (parseInt(response.data.expires_in) || 3600) * 1000);
      await pool.query(
        `UPDATE tokens SET access_token=$1, refresh_token=$2, expires_at=$3, updated_at=NOW() WHERE contractor_id=$4`,
        [newAccess, newRefresh, newExpiry, contractorId]
      );
      console.log('Token refreshed, expires:', newExpiry);
    }
  })();

  inFlightRefreshes.set(contractorId, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    // Cleared on success OR failure so the next call — whether a retry after a failed
    // attempt or a genuinely new refresh cycle — starts a fresh attempt, never stuck.
    inFlightRefreshes.delete(contractorId);
  }
}

// F4 helper (TF session) — the one sanctioned way to read a contractor's access token;
// never query the tokens table ad hoc for reads.
async function getContractorAccessToken(contractorId) {
  if (!contractorId) {
    const err = new Error('getContractorAccessToken: contractorId is required');
    await logError({ req: null, error: err, source: 'getContractorAccessToken' });
    throw err;
  }
  const result = await pool.query('SELECT access_token FROM tokens WHERE contractor_id = $1', [contractorId]);
  const accessToken = result.rows[0]?.access_token;
  if (!accessToken) {
    throw new Error(`getContractorAccessToken: no access token found for contractor ${contractorId} — visit /auth/jobber`);
  }
  return accessToken;
}

// ── THE SANCTIONED TOKEN PATH (Wave 0.2 item 3) ───────────────────────────────
// The only way to obtain a USABLE Jobber access token: refresh if the stored one is
// near expiry, then read. Callers must never do these two steps themselves.
//
// ⚠ WHY THIS EXISTS RATHER THAN "just call getContractorAccessToken". That function
// is the READ half only. Nine call sites open-coded refresh-then-read, and five
// skipped the refresh entirely and read the tokens table raw. The two webhook
// handlers among those five dropped roughly 550 Jobber clients between 2026-04-17
// and 2026-08-21, and the nightly cron produced 52 logged 401s (last 2026-08-16).
//
// ⚠ AND WHY ACQUIRING LATE MATTERS. refreshTokenIfNeeded's single-flight guard
// (inFlightRefreshes, above) protects ROTATION, not READS. Jobber rotates the refresh
// token on use, so a caller holding a token it read earlier can still be rotated out
// from under by a concurrent refresh it never participated in — that is precisely the
// nightly cron's failure, which reads one token at 02:00 and holds it across a
// per-client loop while the 30-minute pipelineSync rotates underneath it. Call this
// immediately before use; never cache the result across an operation.
//
// The failure-scaling axis is INSTANCES, not contractors: the guard is per-process and
// per-contractor, so fifty contractors on one process is fifty sound guards. If
// RoofMiles ever runs more than one Railway replica, add
// pg_advisory_xact_lock(hashtext(contractor_id)) so the guard is visible across them.
//
// ⚠ THROWS when no token exists — it does not return null. Every caller must decide
// its own skip semantics in a catch, and must LOG the skip: five sites previously
// returned or continued silently, which is how a starved path stays invisible.
async function getFreshContractorAccessToken(contractorId) {
  await refreshTokenIfNeeded(contractorId);
  return getContractorAccessToken(contractorId);
}

// ── SHARED: FETCH PIPELINE FOR A REFERRER ────────────────────────────────────
// Reads from pipeline_cache (populated by the background sync worker) instead of
// calling Jobber directly. Returns the same shape as the previous Jobber-direct
// implementation so all callers (referrer.js routes, admin routes) are unaffected.
//
// Response shape:
//   { pipeline: [{ id, name, status, bonusEarned, payout, pre_start_date }], balance, paidCount }
//   plus sync_pending: true when the initial cache sync has not yet completed.
//
// Status mapping (pipeline_cache → frontend STATUS_CONFIG keys):
//   'paid'     → 'sold'   (paid invoice = closed sale in frontend terms)
//   'not_sold' → 'closed'
//   all others → unchanged ('lead', 'inspection', 'sold')
//
// Bonus eligibility: pipeline_status === 'paid' AND pre_start_date === false
async function fetchPipelineForReferrer(referrerName, contractorId = null, config = null) {
  // Resolve contractorId — config-based path provides it; legacy path defaults to accent-roofing
  const resolvedContractorId = contractorId || (config?.contractorId) || 'accent-roofing';
  // Note: config is accepted for caller compatibility with getCRMAdapter() but is not
  // used — pipeline data comes from pipeline_cache, not the CRM directly.
  // credential and effectiveStartDate in config are intentionally ignored here.

  // Read from pipeline_cache — case-insensitive match on referred_by
  const cacheResult = await pool.query(
    `SELECT jobber_client_id, client_name, pipeline_status, pre_start_date, last_synced_at
     FROM pipeline_cache
     WHERE contractor_id = $1
       AND LOWER(referred_by) = LOWER($2)
     ORDER BY jobber_created_at ASC NULLS LAST`,
    [resolvedContractorId, referrerName]
  );

  // If no cache records exist yet (initial sync not complete), signal sync pending
  if (cacheResult.rows.length === 0) {
    // MVP: issues a second query on every load for referrers with zero pipeline entries.
    // At scale, include sync_state in the initial query as a LEFT JOIN on pipeline_cache
    // so a single round-trip handles both the data and the sync status.
    const syncResult = await pool.query(
      'SELECT initial_sync_complete FROM sync_state WHERE contractor_id = $1',
      [resolvedContractorId]
    );
    const syncComplete = syncResult.rows[0]?.initial_sync_complete ?? false;
    return {
      pipeline: [],
      balance: 0,
      paidCount: 0,
      sync_pending: !syncComplete,
    };
  }

  // Fetch confirmed conversion records for this referrer — source of truth for bonus amounts.
  // pipeline_status 'paid' items that already have a conversion record (from the invoice-paid
  // webhook or a prior pipeline load) carry the confirmed bonus_amount here.
  // Items with no record yet use the speculative payout as fallback.
  const conversionMap = {};
  try {
    const convResult = await pool.query(
      `SELECT rc.jobber_client_id, rc.bonus_amount
       FROM referral_conversions rc
       JOIN users u ON u.id = rc.user_id AND LOWER(u.full_name) = LOWER($2)
       WHERE rc.contractor_id = $1`,
      [resolvedContractorId, referrerName]
    );
    for (const row of convResult.rows) {
      conversionMap[row.jobber_client_id] = parseInt(row.bonus_amount);
    }
  } catch (convErr) {
    await logError({ req: null, error: convErr });
    console.error('[fetchPipeline] conversion lookup failed:', convErr.message);
  }

  // Map pipeline_cache rows to the response shape PipelineTab expects.
  // ⚠ THE boostSchedule IMPORT IS GONE FROM THIS FILE (N4 commit 7a). It existed only to compute
  // the speculative ladder retired below; the constant itself stays for the code that genuinely
  // decides a payout. An unused import is dead code by CLAUDE.md's standard.
  // ⚠ `paidCount` NO LONGER INDEXES A LADDER. It counts bonus-eligible (post-start-date) paid
  // referrals in this result set and is returned as `paidCount`, which is what it always meant
  // to callers; it is no longer used to pick a tier here.
  let paidCount    = 0;
  let totalBalance = 0;

  const pipeline = cacheResult.rows.map(row => {
    const isPreStart = row.pre_start_date;

    // Map internal status to frontend status values
    // pipeline_status 'paid' → 'complete' (invoice paid; bonus confirmed)
    // pipeline_status 'sold' → 'sold' (job in progress; no bonus yet)
    let status;
    if (row.pipeline_status === 'paid')          status = 'complete';
    else if (row.pipeline_status === 'not_sold') status = 'closed';
    else status = row.pipeline_status; // 'lead', 'inspection', 'sold'

    // Bonus only fires when paid AND not pre-start-date
    const bonusEarned = row.pipeline_status === 'paid' && !isPreStart;

    // ── THE CARD SHOWS THE BONUS ACTUALLY CREDITED (N4 commit 7a, Danny ruling 3b) ──
    //
    // ⚠ THE SPECULATIVE `500 + boost` LADDER IS RETIRED. It computed a payout from
    // `pipeline_status = 'paid'` alone, WHETHER OR NOT a `referral_conversions` row existed, and
    // used the confirmed amount only when one happened to be there. So a referrer could be shown
    // `+$500` that no ledger row supported — and since the payout audit every BALANCE surface
    // reads one source, `SUM(referral_conversions.bonus_amount)` minus cash-outs. The card was
    // the last surface still inventing its own figure, which is the same
    // two-figures-disagreeing defect that arc spent five commits removing, one surface along.
    //
    // ⚠ AND IT HAD TO GO BEFORE THE STAGE MOVES ONTO FACTS, NOT AFTER. The next commit makes two
    // referred clients derive `'paid'` from saved facts; with the ladder still here they would
    // each have shown `+$500` against no conversion. Nobody would have seen it today — neither
    // referrer has a `users` row — but "no one can currently see it" is a coincidence, not a
    // guarantee, and ordering the commits this way means it is never true even briefly.
    //
    // ⚠ NOTHING IS SHOWN BEFORE A CONVERSION EXISTS. `payout` is the conversion's own
    // `bonus_amount` or null; `bonusEarned` still says the invoice is paid, so the card reads
    // "Complete ✓" with no figure until the ledger has one. That is the ruling, and it is also
    // the honest reading: the stage is a fact about the job, the amount is a fact about the money.
    //
    // ⚠ THE RESIDENT NON-NEGOTIABLE IS UNCHANGED AND THIS FINALLY OBEYS IT: never display a
    // bonus dollar amount at `'sold'` — the amount comes from `referral_conversions.bonus_amount`.
    // The rule always said that; the ladder was the thing contradicting it.
    const conversionBonus = bonusEarned ? (conversionMap[row.jobber_client_id] ?? null) : null;

    // ⚠ `payout` AND `conversion_bonus` ARE NOW THE SAME NUMBER, DELIBERATELY. Both keys stay on
    // the payload because `ProfileTab` and `DashboardTab` read them separately and this commit
    // changes no component; the point is that neither can be a figure the ledger does not hold.
    const payout = conversionBonus;
    if (bonusEarned) {
      // ⚠ THE BALANCE SUMS ONLY CONFIRMED CONVERSIONS. An unconverted paid referral adds nothing
      // rather than adding a guess.
      if (conversionBonus !== null) totalBalance += conversionBonus;
      paidCount++;
    }

    return {
      id:               row.jobber_client_id,
      name:             row.client_name || 'Unknown',
      status,
      bonusEarned,
      payout,
      conversion_bonus: conversionBonus,
      pre_start_date:   isPreStart,
    };
  });

  const synced_at = cacheResult.rows.reduce(
    (max, row) => (row.last_synced_at && (!max || row.last_synced_at > max) ? row.last_synced_at : max),
    null
  );
  return { pipeline, balance: totalBalance, paidCount, synced_at };
}

// ── CRM FIELD DISCOVERY ───────────────────────────────────────────────────────
// Runs GetCustomFieldConfigurations, upserts into contractor_jobber_fields,
// and returns the full field list from the DB.
// tokenOverride: pass a fresh token directly (e.g. from OAuth callback) to skip DB read.
// ── TEST SEAM FOR THE JOBBER HTTP TRANSPORT (7c-1) ────────────────────────────
// Production always uses real axios.post. ⚠ THIS EXISTS BECAUSE A GUARD-PROOF CAME BACK WITH NO
// BEHAVIOURAL RED: restoring discovery's de-duplication-by-label failed only a SOURCE fence, because
// the suite seeded `contractor_jobber_fields` rows directly and so could not observe what discovery
// does to a response. A test that injects the stored rows cannot discover that discovery discards
// them — the same shape as a test injecting a value it claims something upstream supplies.
let _jobberAxiosPost = (...args) => axios.post(...args);

// test seam — inert in production, never called outside server/test/
function _setJobberHttpForTest({ axiosPost } = {}) {
  if (axiosPost !== undefined) _jobberAxiosPost = axiosPost;
}
function _resetJobberHttp() {
  _jobberAxiosPost = (...args) => axios.post(...args);
}

async function discoverJobberFields(contractorId, tokenOverride = null) {
  let token = tokenOverride;
  if (!token) {
    await refreshTokenIfNeeded(contractorId);
    const tokenResult = await pool.query(
      'SELECT access_token FROM tokens WHERE contractor_id = $1',
      [contractorId]
    );
    if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
      throw new Error('No Jobber token found. Connect your Jobber account first.');
    }
    token = tokenResult.rows[0].access_token;
  }

  // ── 7c-1 — EVERY CONFIGURATION, WITH ITS ENTITY, PAGED ───────────────────────────────
  //
  // ⚠ THIS QUERY USED TO SELECT id/name/__typename AND NOTHING ELSE, AND THE CODE BELOW THEN
  // DE-DUPLICATED BY NAME. On Accent that discarded 10 of 27 configurations and kept whichever of
  // three "Job Type" fields Jobber happened to return first — a coin-flip deciding which field the
  // payout engine is configured against. It kept the right one.
  //
  // `appliesTo` is the entity: enum CustomFieldAppliesTo, seven values, read from the live schema at
  // the pinned 2026-05-12 rather than assumed —
  // ALL_PROPERTIES · ALL_CLIENTS · ALL_QUOTES · ALL_JOBS · ALL_INVOICES ·
  // ALL_PRODUCTS_AND_SERVICES · TEAM. ⚠ **There is no REQUEST entity.**
  //
  // ⚠ `transferable` IS SELECTED BECAUSE THE PAYOUT RESOLUTION ORDER DEPENDS ON IT (R-7c-3), and
  // `archived` because discovery has been offering dead fields as live ones — eleven of Accent's 27
  // are archived in Jobber and the mapping screen listed them indistinguishably.
  //
  // ⚠ AND `CustomFieldConfigurationArea` NOW HAS A FRAGMENT. It was in TYPE_MAP all along with no
  // fragment in the query, so an Area configuration arrived with no `id` and no `name` and was
  // dropped by the `!node.name` filter — a whole field type invisible, with the mapping table
  // carrying an entry for it. Confirmed selectable against the live schema.
  const CONFIG_FIELDS = `id name appliesTo transferable archived`;
  const query = `
    query GetCustomFieldConfigurations($after: String) {
      customFieldConfigurations(first: 100, after: $after) {
        nodes {
          __typename
          ... on CustomFieldConfigurationText      { ${CONFIG_FIELDS} }
          ... on CustomFieldConfigurationDropdown  { ${CONFIG_FIELDS} dropdownOptions }
          ... on CustomFieldConfigurationNumeric   { ${CONFIG_FIELDS} }
          ... on CustomFieldConfigurationTrueFalse { ${CONFIG_FIELDS} }
          ... on CustomFieldConfigurationLink      { ${CONFIG_FIELDS} }
          ... on CustomFieldConfigurationArea      { ${CONFIG_FIELDS} }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  // diagnostic log — intentional
  console.log('[discoverFields] Starting field discovery for contractor:', contractorId);

  // ⚠ PAGED, AND IT WAS NOT BEFORE. The old call sent this query with NO `first:` and NO cursor, so
  // it took whatever Jobber's default page happened to be and silently kept only that. Accent has
  // 27 configurations and fits in one page, which is precisely why the omission was invisible — the
  // same shape as the invoice `jobs(first: 10)` truncation this repo already paid for.
  //
  // ⚠ AND THE CAP RAISES RATHER THAN TRUNCATES. `MAX_PAGES` exists so a broken `hasNextPage` cannot
  // spin forever, and reaching it THROWS instead of returning a short list: a field discovery that
  // quietly returns nine tenths of a contractor's fields would let an admin map the wrong one and
  // give no sign. Better to fail the discovery and say so.
  const MAX_PAGES = 20;
  const nodes = [];
  let after = null;
  let pages = 0;
  for (;;) {
    const response = await retryWithBackoff(
      () => _jobberAxiosPost(
        'https://api.getjobber.com/api/graphql',
        { query, variables: { after } },
        { headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-05-12'
        } }
      ),
      { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
    );
    // ⚠ GRAPHQL ERRORS ARRIVE INSIDE A 200, so an unchecked response yields `nodes: []` and reads as
    // "this contractor has no custom fields" — which is what the DELETE below would then act on.
    const errs = response.data?.errors;
    if (Array.isArray(errs) && errs.length) {
      throw new Error(`discoverJobberFields: Jobber returned errors: ${errs.map(e => e.message).join('; ')}`);
    }
    const conn = response.data?.data?.customFieldConfigurations;
    if (!conn) {
      throw new Error('discoverJobberFields: no customFieldConfigurations in the response');
    }
    nodes.push(...(conn.nodes || []));
    pages += 1;
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
    if (!after) break;
    if (pages >= MAX_PAGES) {
      throw new Error(
        `discoverJobberFields: more than ${MAX_PAGES} pages of custom field configurations — `
        + 'refusing to store a partial set, because a short list lets an admin map the wrong field '
        + 'with no sign anything was missing'
      );
    }
  }

  const TYPE_MAP = {
    CustomFieldConfigurationText:      'text',
    CustomFieldConfigurationDropdown:  'dropdown',
    CustomFieldConfigurationNumeric:   'numeric',
    CustomFieldConfigurationTrueFalse: 'truefalse',
    CustomFieldConfigurationLink:      'link',
    CustomFieldConfigurationArea:      'area',
  };

  // ⚠ EVERY CONFIGURATION IS KEPT. The de-duplication that used to sit here filtered by `name` and
  // kept the FIRST occurrence — on Accent that discarded 10 of 27 and decided, by Jobber's response
  // order, which of three "Job Type" fields the payout engine would be configured against.
  // Uniqueness is `(contractor_id, jobber_field_id)`, which is the real key, so the table could
  // always have held them all.
  //
  // ⚠ A NODE WITH NO id OR NO name IS STILL DROPPED, and that is not the same filter. Those are
  // configurations of a type this query has no fragment for; keeping them would write rows nothing
  // can identify. If one ever appears, the count logged below will not match `nodes.length` — which
  // is why both numbers are logged rather than one.
  const usable = nodes.filter(node => node && node.id && node.name);

  // diagnostic log — intentional
  console.log('[discoverFields] configurations returned:', nodes.length,
    '· usable:', usable.length,
    '· distinct labels:', new Set(usable.map(n => n.name)).size,
    '· pages:', pages);

  // ⚠ DELETE-THEN-INSERT IS KEPT, AND IT IS WHAT MAKES A FIELD DELETED IN JOBBER DISAPPEAR HERE.
  // The upsert alone would leave a stale row behind forever, and a mapping pointing at a field that
  // no longer exists must resolve to nothing rather than to a remembered copy.
  await pool.query(
    'DELETE FROM contractor_jobber_fields WHERE contractor_id = $1',
    [contractorId]
  );

  for (const node of usable) {
    const fieldType = TYPE_MAP[node.__typename] || 'other';
    const optionsValue = (node.__typename === 'CustomFieldConfigurationDropdown' && Array.isArray(node.dropdownOptions) && node.dropdownOptions.length)
      ? JSON.stringify(node.dropdownOptions.filter(o => o && o.trim() !== ''))
      : null;
    await pool.query(
      `INSERT INTO contractor_jobber_fields
         (contractor_id, jobber_field_id, label, field_type, options, entity, transferable, archived, discovered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (contractor_id, jobber_field_id) DO UPDATE SET
         label = $3, field_type = $4, options = $5, entity = $6,
         transferable = $7, archived = $8, discovered_at = NOW()`,
      [contractorId, node.id, node.name, fieldType, optionsValue,
        // ⚠ NULL RATHER THAN A GUESS when Jobber does not report it. An invented entity is worse
        // than an absent one: the admin screen would state it with the same confidence as a real
        // value, and the whole point of 7c-1 is that the entity is knowable rather than assumed.
        typeof node.appliesTo === 'string' ? node.appliesTo : null,
        typeof node.transferable === 'boolean' ? node.transferable : null,
        typeof node.archived === 'boolean' ? node.archived : null]
    );
  }

  // diagnostic log — intentional
  console.log('[discoverFields] Upsert complete. Rows processed:', usable.length);

  const result = await pool.query(
    `SELECT jobber_field_id, label, field_type, options, entity, transferable, archived, discovered_at
     FROM contractor_jobber_fields
     WHERE contractor_id = $1
     ORDER BY label ASC, entity ASC NULLS LAST`,
    [contractorId]
  );

  return result.rows;
}

// Uses the TOP-LEVEL Query.requests field, not the nested Client.requests connection — the
// nested connection accepts no sort/filter args at our pinned version (2026-05-12): confirmed
// live via a GraphiQL argumentNotAccepted error, and confirmed in Jobber's Client type docs
// (args: after/before/first/last only; sibling connections like contacts/jobs/notes DO take
// sort, but requests and quotes are plain). The top-level Query.requests field, by contrast,
// ── THE LIVE ATTRIBUTION FETCH WAS HERE, AND IT IS DELETED (3d Phase 1a Commit 7b) ──
//
// `ATTRIBUTION_QUERY` and `fetchAttributionData(clientId, token)` fetched a client's requests
// from Jobber so runAttributionEngine could choose the rep. Every live door now reads that list
// from crm_request_facts instead (server/utils/requestFacts.js), captured in the same locked
// transaction the decision is taken in, so live and replay choose from the same rows with the
// same code (R5i).
//
// ⚠ DELETED RATHER THAN LEFT UNUSED, AND THAT IS THE POINT. An exported fetcher sitting here is
// what a future door reaches for when it needs "the requests for this client" — the name is
// right there and it looks like the sanctioned way. With it gone, reintroducing a live fetch
// into attribution takes writing a new query, which is a decision somebody makes on purpose.
//
// ⚠ AND TWO OF ITS PROPERTIES WERE DEFECTS THAT THE FACT READER DOES NOT INHERIT, RECORDED SO
// NOBODY RESTORES IT FROM GIT THINKING IT WAS MERELY REDUNDANT:
//   · it selected `assignedUsers { nodes { id } }` with NO pageInfo, so the 7a-2 truncation
//     guard could never fire on a live door — a six-person assessment was written as a
//     single-match STICKY, which is existing-wins and uncorrectable;
//   · it stable-sorted Jobber's REQUESTED_AT-descending page by createdAt, so an equal-createdAt
//     tie resolved to whatever Jobber returned first — not the ruled higher-numeric-id winner,
//     which only the replay implemented.

// ── REQUEST-DRIVEN ATTRIBUTION (Canvass-3.7, ruling R1) ──────────────────────
// ⚠ WHAT IS PROVEN AT OUR PINNED VERSION AND WHAT IS NOT — READ BEFORE WIDENING EITHER
// QUERY BELOW. The top-level `Query.requests` field, `RequestFilterAttributes`,
// `RequestsSortInput`, and the selection `id createdAt salesperson { id } assessment { id
// assignedUsers { nodes { id } } }` were ALL proven at 2026-02-17 by the live attribution query
// that stood above until 7b, which used every one of them in production and was verified live
// in GraphiQL on 2026-07-06. ⚠ THAT QUERY IS DELETED AND THE PROOF STILL STANDS — it is a fact
// about the Jobber schema at our pinned version, not about our code. The two queries below
// still rely on it.
// ⚠ THE PIN MOVED TO 2026-05-12 IN THE 2-pre BUMP, AND THAT PROOF CARRIES FORWARD: the five
// intervening versions (2026-03-10 · 04-13 · 04-16 · 04-22 · 05-12) are ADDITIVE ONLY — six
// added enum values, nothing removed and nothing retyped, per Jobber's changelog.
// THREE things these two queries add are NOT proven at our version, and each is listed
// because the 3.6b lesson is that an unknown field fails the WHOLE query, not just itself:
//   1. `Query.request(id:)`        — the singular field. ⚠ THIS LINE USED TO READ
//                                    "Siblings client(id:)/invoice(id:)/job(id:) are all
//                                    proven in this codebase", AND THE job(id:) THIRD OF
//                                    THAT WAS FALSE. Measured 2026-09-21 by Canvass-stage:
//                                    `client(id:)` is proven (many uses) and `invoice(id:)`
//                                    is proven (the invoice-paid webhook), but the ONLY
//                                    occurrence of `job(id:)` anywhere in the repository
//                                    was THIS COMMENT asserting it. `quote(id:)` likewise
//                                    had zero. **A claim of provenness with no source, in
//                                    a comment written to be careful about exactly that.**
//                                    So: this one is inferred from client(id:) and
//                                    invoice(id:), not observed — and inferring a singular
//                                    root field from two siblings is a weaker argument than
//                                    the original sentence made it sound.
//                                    ⚠ **`job(id:)` AND `quote(id:)` ARE NOW GENUINELY
//                                    PROVEN, AND THIS IS THE MEASUREMENT RATHER THAN A
//                                    CLAIM.** Run by Danny in GraphiQL against Accent's
//                                    live account on **2026-09-21**:
//                                      · `job(id:)`   returned id, createdAt
//                                        2026-09-21T03:26:59Z, jobStatus "late",
//                                        client { id }
//                                      · `quote(id:)` returned id, quoteStatus "converted",
//                                        createdAt 2026-09-21T03:25:55Z, client { id }
//                                    ⚠ **THE VERSION CAVEAT THIS BLOCK CARRIED IS CLOSED.**
//                                    It read: the explorer ran at 2026-05-12 while our client
//                                    pinned 2026-02-17, so the observation was strong evidence
//                                    and not proof. The 2-pre bump moved our pin to
//                                    **2026-05-12** — the same version the explorer ran — so
//                                    the observation now describes OUR schema. Item 3 below
//                                    closes for the same reason.
//                                    ⚠ **THE DATE AND THE ACCOUNT ARE THE POINT.** The
//                                    sentence this block replaced asserted provenness with
//                                    no source and was FALSE; a proof with no date is the
//                                    thing that got filed as false. Canvass-stage's stage
//                                    webhooks use both fields, under skip-and-log
//                                    degradation that holds regardless.
//   2. `Request.client`            — needed to get from a request id to a client id.
//   3. `Request.updatedAt`, and `RequestFilterAttributes.updatedAt` — observed by Danny in
//      the explorer at version 2026-05-12 on 2026-09-18. Since the 2-pre bump our client
//      pins 2026-05-12, so this is now PROOF for what our client receives rather than the
//      evidence it was; the degradation below is kept regardless.
// ⚠ NEITHER FUNCTION FALLS BACK TO AN UNFILTERED QUERY ON FAILURE. A request fetch that
// cannot name its field degrades to "nothing is written, the failure is recorded" — never to
// a wider query. An unfiltered `requests` sweep would be unbounded, and silently trading a
// missing filter for a full-history scan is the shape this repo files under "a plausible
// wrong answer with no error attached".

// Fetches ONE request by its Jobber id, for the REQUEST_CREATE / REQUEST_UPDATE webhooks.
// Input:  requestId (Jobber EncodedId, the webhook's itemId), token
// Output: { id, createdAt, client: { id } } — or throws.
// ⚠ DELIBERATELY MINIMAL. salesperson and assessment are NOT selected here even though the
// attribution needs them. ⚠ WHERE THEY COME FROM CHANGED IN 7b: they used to arrive through
// fetchAttributionData's live client-scoped query, and they now come from crm_request_facts,
// written by the capture this webhook performs before it decides. The reason for keeping this
// query minimal is unchanged — selecting them here would put two unproven fields beside three
// proven ones and make a failure impossible to attribute to a field.
const REQUEST_BY_ID_QUERY = `
  query GetRequestById($id: EncodedId!) {
    request(id: $id) {
      id
      createdAt
      client { id }
    }
  }
`;

async function fetchRequestById(requestId, token, _httpPost = null) {
  const post = _httpPost || axios.post;

  const response = await retryWithBackoff(
    () => post(
      'https://api.getjobber.com/api/graphql',
      { query: REQUEST_BY_ID_QUERY, variables: { id: requestId } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-JOBBER-GRAPHQL-VERSION': '2026-05-12',
          'Content-Type': 'application/json',
        },
      }
    ),
    { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );

  // ⚠ Jobber answers a GraphQL failure with HTTP 200 + an `errors` array, and
  // jobberShouldRetry reads only error.response.status — so retryWithBackoff resolves
  // happily on a schema error. This check is the only thing that sees it. (Same defect
  // shape as the Canvass-3.6 user picker's `if (!usersData) break`.)
  if (response.data?.errors?.length) {
    const err = new Error(
      `fetchRequestById: GraphQL errors for request ${requestId}: ` +
      response.data.errors.map(e => e.message).join('; ')
    );
    err.jobberSchemaError = true;
    throw err;
  }

  const request = response.data?.data?.request;
  if (!request) throw new Error(`fetchRequestById: no request returned for id ${requestId}`);
  return request;
}

// Fetches one page of requests updated since `since`, for the backfill sweep.
// Input:  since (ISO8601 string), token, cursor (String|null)
// Output: { nodes: [{ id, createdAt, updatedAt, client: { id } }], hasNextPage, endCursor }
// Sorted newest-first by REQUESTED_AT — the sort shape proven at 2026-02-17 and described in
// the block above. ⚠ This query orders the SWEEP's walk through requests; it does not order the
// engine's request list, which requestsFromFacts owns (server/utils/requestFacts.js) and which
// carries the numeric-id tie-break this sort has never implemented.
const REQUESTS_UPDATED_SINCE_QUERY = `
  query GetRequestsUpdatedSince($since: ISO8601DateTime!, $after: String) {
    requests(
      first: 50
      after: $after
      filter: { updatedAt: { after: $since } }
      sort: [{ key: REQUESTED_AT, direction: DESCENDING }]
    ) {
      nodes {
        id
        createdAt
        updatedAt
        client { id }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function fetchRequestsUpdatedSince(since, token, cursor = null, _httpPost = null) {
  const post = _httpPost || axios.post;

  const response = await retryWithBackoff(
    () => post(
      'https://api.getjobber.com/api/graphql',
      { query: REQUESTS_UPDATED_SINCE_QUERY, variables: { since, after: cursor } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-JOBBER-GRAPHQL-VERSION': '2026-05-12',
          'Content-Type': 'application/json',
        },
      }
    ),
    { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );

  if (response.data?.errors?.length) {
    const err = new Error(
      'fetchRequestsUpdatedSince: GraphQL errors: ' +
      response.data.errors.map(e => e.message).join('; ')
    );
    err.jobberSchemaError = true;
    throw err;
  }

  const connection = response.data?.data?.requests;
  if (!connection) throw new Error('fetchRequestsUpdatedSince: null requests connection');

  return {
    nodes: connection.nodes || [],
    hasNextPage: !!connection.pageInfo?.hasNextPage,
    endCursor: connection.pageInfo?.endCursor || null,
  };
}

module.exports = { refreshTokenIfNeeded, getContractorAccessToken, getFreshContractorAccessToken, fetchPipelineForReferrer, discoverJobberFields, fetchRequestById, fetchRequestsUpdatedSince, _setJobberHttpForTest, _resetJobberHttp };
