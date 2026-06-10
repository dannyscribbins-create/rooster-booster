const cron = require('node-cron');
const { withLock } = require('../withLock');
const { pool } = require('../../db');
const { logError } = require('../../middleware/errorLogger');

// Explicit overrides for system tag values that don't round-trip cleanly through title-case.
// 'sms_opted_out' title-cases to 'Sms Opted Out' — must map to the stored value 'SMS Opted Out'.
const ROOFMILES_TAG_OVERRIDES = {
  'sms_opted_out': 'SMS Opted Out',
};

// Converts a roofmiles: prefixed tag to the stored contact_tags.tag value.
// Non-prefixed tags (Jobber CRM tags) pass through unchanged.
function resolveTagValue(tag) {
  if (!tag.startsWith('roofmiles:')) return tag;
  const value = tag.slice('roofmiles:'.length);
  if (ROOFMILES_TAG_OVERRIDES[value]) return ROOFMILES_TAG_OVERRIDES[value];
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Evaluates a single audience by id. Fetches the audience row, runs the tag
// filter SQL across both contacts (Tier 2) and jobber_clients (Tier 1) pools
// via UNION ALL, atomically replaces dynamic_audience_members, and updates
// member_count + last_evaluated_at. Returns { memberCount }.
// Returns { memberCount: 0 } if the audience is not found or is inactive.
async function evaluateAudience(pool, audienceId) {
  const { rows: audRows } = await pool.query(
    `SELECT id, contractor_id, name, filter_json
     FROM dynamic_audiences
     WHERE id = $1 AND is_active = TRUE`,
    [audienceId]
  );
  if (audRows.length === 0) return { memberCount: 0 };

  const { filter_json: filters, contractor_id: contractorId } = audRows[0];
  const tags = filters.tags || [];
  const mode = filters.mode || 'AND';
  const resolvedTags = tags.map(resolveTagValue);

  let unionQuery;
  let queryParams = [contractorId];

  if (resolvedTags.length === 0) {
    // No tag filter — all contacts and all jobber_clients
    unionQuery = `
      SELECT id AS contact_id, NULL::text AS jobber_client_id
      FROM contacts
      WHERE contractor_id = $1
      UNION ALL
      SELECT NULL::uuid AS contact_id, jobber_client_id
      FROM jobber_clients
      WHERE contractor_id = $1
    `;
  } else if (mode === 'AND') {
    // Each tag must match — one correlated EXISTS per tag per pool.
    // Tags are pushed once into queryParams; jobber conditions reuse the same $n indices.
    const contactConditions = resolvedTags.map((tag) => {
      queryParams.push(tag);
      return `EXISTS (
        SELECT 1 FROM contact_tags ct
        WHERE ct.contact_id = c.id
          AND ct.tag = $${queryParams.length}
          AND ct.contractor_id = $1
      )`;
    });
    const jobberConditions = resolvedTags.map((_, i) => `EXISTS (
      SELECT 1 FROM contact_tags ct
      WHERE ct.jobber_client_id = jc.jobber_client_id
        AND ct.tag = $${i + 2}
        AND ct.contractor_id = $1
    )`);
    unionQuery = `
      SELECT c.id AS contact_id, NULL::text AS jobber_client_id
      FROM contacts c
      WHERE c.contractor_id = $1
        AND ${contactConditions.join('\n        AND ')}
      UNION ALL
      SELECT NULL::uuid AS contact_id, jc.jobber_client_id AS jobber_client_id
      FROM jobber_clients jc
      WHERE jc.contractor_id = $1
        AND ${jobberConditions.join('\n        AND ')}
    `;
  } else {
    // OR mode — any matching tag qualifies; single EXISTS with ANY($2)
    queryParams.push(resolvedTags);
    unionQuery = `
      SELECT c.id AS contact_id, NULL::text AS jobber_client_id
      FROM contacts c
      WHERE c.contractor_id = $1
        AND EXISTS (
          SELECT 1 FROM contact_tags ct
          WHERE ct.contact_id = c.id
            AND ct.tag = ANY($2)
        )
      UNION ALL
      SELECT NULL::uuid AS contact_id, jc.jobber_client_id AS jobber_client_id
      FROM jobber_clients jc
      WHERE jc.contractor_id = $1
        AND EXISTS (
          SELECT 1 FROM contact_tags ct
          WHERE ct.jobber_client_id = jc.jobber_client_id
            AND ct.tag = ANY($2)
        )
    `;
  }

  const { rows: matchingRows } = await pool.query(unionQuery, queryParams);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM dynamic_audience_members WHERE audience_id = $1`,
      [audienceId]
    );

    if (matchingRows.length > 0) {
      const params = [audienceId];
      const valueClauses = matchingRows.map((row) => {
        params.push(row.contact_id);
        params.push(row.jobber_client_id);
        return `($1, $${params.length - 1}, $${params.length})`;
      });
      await client.query(
        `INSERT INTO dynamic_audience_members (audience_id, contact_id, jobber_client_id)
         VALUES ${valueClauses.join(', ')}`,
        params
      );
    }

    await client.query(
      `UPDATE dynamic_audiences
       SET member_count = $1, last_evaluated_at = NOW()
       WHERE id = $2`,
      [matchingRows.length, audienceId]
    );

    await client.query('COMMIT');
  } catch (txErr) {
    await client.query('ROLLBACK');
    throw txErr;
  } finally {
    client.release();
  }

  return { memberCount: matchingRows.length };
}

function startDynamicAudiencesJob() {
  // Daily at 6:10am UTC (10 min after engagement cadence)
  cron.schedule('10 6 * * *', () => {
    withLock('dynamic_audiences', 20, async () => {
      console.log('[cron:dynamic_audiences] Starting dynamic audience evaluation');

      const { rows: audiences } = await pool.query(
        `SELECT id, name FROM dynamic_audiences WHERE is_active = TRUE`
      );

      if (audiences.length === 0) {
        console.log('[cron:dynamic_audiences] No active audiences — done');
        return;
      }

      let totalUpdated = 0;

      for (const audience of audiences) {
        try {
          const { memberCount } = await evaluateAudience(pool, audience.id);
          totalUpdated++;
          console.log(
            `[cron:dynamic_audiences] Audience "${audience.name}" → ${memberCount} members`
          );
        } catch (audienceErr) {
          logError({
            error: audienceErr,
            source: `cron:dynamic_audiences — audience id ${audience.id}`,
          });
          console.error(
            `[cron:dynamic_audiences] Error evaluating audience ${audience.id}:`,
            audienceErr.message
          );
        }
      }

      console.log(
        `[cron:dynamic_audiences] Complete — ${totalUpdated}/${audiences.length} audiences updated`
      );
    });
  });
}

module.exports = { startDynamicAudiencesJob, evaluateAudience };
