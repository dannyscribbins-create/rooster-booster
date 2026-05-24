const cron = require('node-cron');
const { withLock } = require('../withLock');
const { pool } = require('../../db');
const { logError } = require('../../middleware/errorLogger');

function startDynamicAudiencesJob() {
  // Daily at 6:10am UTC (10 min after engagement cadence)
  cron.schedule('10 6 * * *', () => {
    withLock('dynamic_audiences', 20, async () => {
      console.log('[cron:dynamic_audiences] Starting dynamic audience evaluation');

      const { rows: audiences } = await pool.query(
        `SELECT id, contractor_id, name, filter_json
         FROM dynamic_audiences
         WHERE is_active = TRUE`
      );

      if (audiences.length === 0) {
        console.log('[cron:dynamic_audiences] No active audiences — done');
        return;
      }

      let totalUpdated = 0;

      for (const audience of audiences) {
        try {
          const { filter_json: filters, id: audienceId, contractor_id: contractorId } = audience;
          const tags = filters.tags || [];
          const mode = filters.mode || 'AND';

          let contactQuery;
          let queryParams = [contractorId];

          if (tags.length === 0) {
            contactQuery = `SELECT id FROM contacts WHERE contractor_id = $1`;
          } else if (mode === 'AND') {
            const tagConditions = tags.map((tag) => {
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
            queryParams.push(tags);
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
            totalUpdated++;

            console.log(
              `[cron:dynamic_audiences] Audience "${audience.name}" → ${matchingIds.length} members`
            );
          } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
          } finally {
            client.release();
          }
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

module.exports = { startDynamicAudiencesJob };
