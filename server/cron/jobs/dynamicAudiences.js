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
// filter SQL, atomically replaces dynamic_audience_members, and updates
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

  let contactQuery;
  let queryParams = [contractorId];

  if (resolvedTags.length === 0) {
    contactQuery = `SELECT id FROM contacts WHERE contractor_id = $1`;
  } else if (mode === 'AND') {
    const tagConditions = resolvedTags.map((tag) => {
      queryParams.push(tag);
      return `EXISTS (
        SELECT 1 FROM contact_tags ct
        WHERE ct.contact_id = contacts.id AND ct.tag = $${queryParams.length}
      )`;
    });
    contactQuery = `
      SELECT id FROM contacts
      WHERE contractor_id = $1
        AND ${tagConditions.join(' AND ')}
    `;
  } else {
    queryParams.push(resolvedTags);
    contactQuery = `
      SELECT DISTINCT contacts.id FROM contacts
      JOIN contact_tags ct ON ct.contact_id = contacts.id
      WHERE contacts.contractor_id = $1
        AND ct.tag = ANY($${queryParams.length})
    `;
  }

  const { rows: matchingContacts } = await pool.query(contactQuery, queryParams);
  const matchingIds = matchingContacts.map(r => r.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM dynamic_audience_members WHERE audience_id = $1`,
      [audienceId]
    );

    if (matchingIds.length > 0) {
      const insertValues = matchingIds
        .map((id, i) => `($1, $${i + 2})`)
        .join(',');
      await client.query(
        `INSERT INTO dynamic_audience_members (audience_id, contact_id)
         VALUES ${insertValues}`,
        [audienceId, ...matchingIds]
      );
    }

    await client.query(
      `UPDATE dynamic_audiences
       SET member_count = $1, last_evaluated_at = NOW()
       WHERE id = $2`,
      [matchingIds.length, audienceId]
    );

    await client.query('COMMIT');
  } catch (txErr) {
    await client.query('ROLLBACK');
    throw txErr;
  } finally {
    client.release();
  }

  return { memberCount: matchingIds.length };
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
