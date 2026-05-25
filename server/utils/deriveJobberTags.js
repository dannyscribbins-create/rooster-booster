const { removeTagsByPrefix, upsertTag, replaceTagGroup } = require('./tags');
const { logError } = require('../middleware/errorLogger');

// Normalize a string for use as a tag suffix: lowercase, non-alphanumeric → underscore.
function normalizeTagValue(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Returns true if a custom-field value should be skipped.
function isBlankFieldValue(val) {
  if (!val) return true;
  const trimmed = val.trim();
  return trimmed === '' || trimmed === '---' || trimmed === '*Blank*';
}

// Pick the primary address/number from Jobber array shapes; fall back to first.
function primaryOrFirst(arr, addressKey) {
  if (!arr || arr.length === 0) return null;
  const primary = arr.find(x => x.isPrimary);
  return (primary || arr[0])[addressKey] || null;
}

// Sort an array by createdAt desc; returns a new array.
function sortByCreatedAtDesc(arr) {
  return [...arr].sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db - da;
  });
}

// Find a custom field by label (case-insensitive), return valueDropdown or valueText.
function getCustomFieldValue(fields, label) {
  if (!Array.isArray(fields)) return null;
  const field = fields.find(f => f.label && f.label.toLowerCase() === label.toLowerCase());
  if (!field) return null;
  return field.valueDropdown || field.valueText || null;
}

/**
 * Derive all CRM tags from a fully-assembled client object and persist them to contact_tags.
 *
 * @param {object} pool - pg pool
 * @param {string} contractorId
 * @param {string} jobberClientId - raw Jobber client ID (encoded)
 * @param {object} clientData - assembled client object with jobs, invoices, quotes, requests
 */
async function deriveAndSaveTags(pool, contractorId, jobberClientId, clientData) {
  try {
    const identifier = { jobber_client_id: jobberClientId };

    const jobs     = clientData.jobs     || [];
    const invoices = clientData.invoices || [];
    const quotes   = clientData.quotes   || [];
    const requests = clientData.requests || [];

    // ── CLIENT TYPE ───────────────────────────────────────────────────────────
    if (clientData.isCompany === true) {
      await replaceTagGroup(pool, identifier, contractorId, 'client_type:', 'client_type:commercial');
    } else {
      await replaceTagGroup(pool, identifier, contractorId, 'client_type:', 'client_type:residential');
    }

    // ── LEAD STATUS ───────────────────────────────────────────────────────────
    if (clientData.isLead === true) {
      await upsertTag(pool, identifier, contractorId, 'status:lead');
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'status:lead');
    }

    // ── JOBBER NATIVE TAGS (full replace) ─────────────────────────────────────
    const nativeTagNodes = clientData.tags?.nodes || [];
    // Remove all existing jobber_tag:* written by jobber_crm source
    await pool.query(
      `DELETE FROM contact_tags
       WHERE jobber_client_id = $1
         AND contractor_id = $2
         AND tag LIKE 'jobber_tag:%'
         AND source = 'jobber_crm'`,
      [jobberClientId, contractorId]
    );
    for (const node of nativeTagNodes) {
      if (!node.label || !node.label.trim()) continue;
      const tagVal = `jobber_tag:${normalizeTagValue(node.label)}`;
      await upsertTag(pool, identifier, contractorId, tagVal);
    }

    // ── LEAD SOURCE (from client custom fields) ───────────────────────────────
    const rawSource = getCustomFieldValue(clientData.customFields, 'Source');
    if (!isBlankFieldValue(rawSource)) {
      await replaceTagGroup(pool, identifier, contractorId, 'source:', `source:${normalizeTagValue(rawSource)}`);
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'source:');
    }

    // ── REQUEST PIPELINE ──────────────────────────────────────────────────────
    const REQUEST_STATUS_MAP = {
      new:                   'request:new',
      upcoming:              'request:upcoming',
      assessment_completed:  'request:assessment_completed',
      converted:             'request:converted',
      overdue:               'request:overdue',
      archived:              'request:archived',
    };
    const REQUEST_SKIP = new Set(['today', 'unscheduled', 'completed']);

    if (requests.length > 0) {
      const sortedRequests = sortByCreatedAtDesc(requests);
      const latestRequest = sortedRequests.find(r => {
        const s = (r.requestStatus || '').toLowerCase();
        return !REQUEST_SKIP.has(s);
      });
      if (latestRequest) {
        const mappedReq = REQUEST_STATUS_MAP[(latestRequest.requestStatus || '').toLowerCase()];
        if (mappedReq) {
          await replaceTagGroup(pool, identifier, contractorId, 'request:', mappedReq);
        } else {
          await removeTagsByPrefix(pool, identifier, contractorId, 'request:');
        }
      } else {
        await removeTagsByPrefix(pool, identifier, contractorId, 'request:');
      }
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'request:');
    }

    // ── QUOTE PIPELINE ────────────────────────────────────────────────────────
    const QUOTE_STATUS_MAP = {
      awaiting_response:  'quote:awaiting_response',
      changes_requested:  'quote:changes_requested',
      approved:           'quote:approved',
      converted:          'quote:converted',
      archived:           'quote:archived',
    };

    const validQuotes = quotes.filter(q => {
      const s = (q.quoteStatus || '').toLowerCase();
      return s !== 'draft';
    });
    if (validQuotes.length > 0) {
      const sortedQuotes = sortByCreatedAtDesc(validQuotes);
      const latestQuote = sortedQuotes[0];
      const mappedQuote = QUOTE_STATUS_MAP[(latestQuote.quoteStatus || '').toLowerCase()];
      if (mappedQuote) {
        await replaceTagGroup(pool, identifier, contractorId, 'quote:', mappedQuote);
      } else {
        await removeTagsByPrefix(pool, identifier, contractorId, 'quote:');
      }
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'quote:');
    }

    // ── JOB STATUS (most recent non-archived job) ──────────────────────────────
    const JOB_STATUS_MAP = {
      upcoming:            'job:upcoming',
      active:              'job:active',
      requires_invoicing:  'job:requires_invoicing',
      archived:            'job:archived',
    };

    const nonArchivedJobs = jobs.filter(j => (j.jobStatus || '').toLowerCase() !== 'archived');
    if (nonArchivedJobs.length > 0) {
      const sortedJobs = sortByCreatedAtDesc(nonArchivedJobs);
      const latestJob = sortedJobs[0];
      const mappedJob = JOB_STATUS_MAP[(latestJob.jobStatus || '').toLowerCase()];
      if (mappedJob) {
        await replaceTagGroup(pool, identifier, contractorId, 'job:', mappedJob);
      } else {
        await removeTagsByPrefix(pool, identifier, contractorId, 'job:');
      }
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'job:');
    }

    // ── JOB TYPE (most recent job) ────────────────────────────────────────────
    const JOB_TYPE_MAP = {
      one_off:   'job_type:one_off',
      recurring: 'job_type:recurring',
    };

    if (jobs.length > 0) {
      const sortedAllJobs = sortByCreatedAtDesc(jobs);
      const latestJobForType = sortedAllJobs[0];
      const mappedType = JOB_TYPE_MAP[(latestJobForType.jobType || '').toLowerCase()];
      if (mappedType) {
        await replaceTagGroup(pool, identifier, contractorId, 'job_type:', mappedType);
      } else {
        await removeTagsByPrefix(pool, identifier, contractorId, 'job_type:');
      }
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'job_type:');
    }

    // ── JOB COUNT ─────────────────────────────────────────────────────────────
    if (jobs.length === 0) {
      await removeTagsByPrefix(pool, identifier, contractorId, 'job_count:');
    } else if (jobs.length === 1) {
      await replaceTagGroup(pool, identifier, contractorId, 'job_count:', 'job_count:first_time');
    } else if (jobs.length === 2) {
      await replaceTagGroup(pool, identifier, contractorId, 'job_count:', 'job_count:repeat');
    } else {
      await replaceTagGroup(pool, identifier, contractorId, 'job_count:', 'job_count:3_plus');
    }

    // ── RECENCY (most recent completedAt across all jobs) ─────────────────────
    const completedDates = jobs
      .filter(j => j.completedAt)
      .map(j => new Date(j.completedAt).getTime())
      .filter(t => !isNaN(t));

    if (completedDates.length > 0) {
      const mostRecent = Math.max(...completedDates);
      const now = Date.now();
      const daysSince = (now - mostRecent) / (1000 * 60 * 60 * 24);

      if (daysSince <= 90) {
        await replaceTagGroup(pool, identifier, contractorId, 'recency:', 'recency:active_90d');
      } else if (daysSince > 180 && daysSince <= 365) {
        await replaceTagGroup(pool, identifier, contractorId, 'recency:', 'recency:dormant_6mo');
      } else if (daysSince > 365) {
        await replaceTagGroup(pool, identifier, contractorId, 'recency:', 'recency:dormant_1yr');
      } else {
        // 90–180 days: no tag
        await removeTagsByPrefix(pool, identifier, contractorId, 'recency:');
      }
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'recency:');
    }

    // ── INVOICE STATUS (most recent invoice across all jobs) ──────────────────
    const INVOICE_STATUS_MAP = {
      awaiting_payment: 'invoice:awaiting_payment',
      paid:             'invoice:paid',
      past_due:         'invoice:past_due',
      bad_debt:         'invoice:bad_debt',
    };

    // Collect all invoices: top-level + job-embedded
    const allInvoices = [
      ...invoices,
      ...jobs.flatMap(j => j.invoices || []),
    ];

    if (allInvoices.length > 0) {
      const sortedInvoices = sortByCreatedAtDesc(allInvoices);
      const latestInvoice = sortedInvoices[0];
      const mappedInvoice = INVOICE_STATUS_MAP[(latestInvoice.invoiceStatus || '').toLowerCase()];
      if (mappedInvoice) {
        await replaceTagGroup(pool, identifier, contractorId, 'invoice:', mappedInvoice);
      } else {
        await removeTagsByPrefix(pool, identifier, contractorId, 'invoice:');
      }
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'invoice:');
    }

    // ── VALUE BRACKET (most recent PAID invoice) ──────────────────────────────
    const paidInvoices = allInvoices
      .filter(inv => (inv.invoiceStatus || '').toLowerCase() === 'paid' && inv.amounts?.total !== undefined);

    if (paidInvoices.length > 0) {
      const sortedPaid = sortByCreatedAtDesc(paidInvoices);
      const latestPaid = sortedPaid[0];
      const total = parseFloat(latestPaid.amounts.total) || 0;

      if (total < 5000) {
        await replaceTagGroup(pool, identifier, contractorId, 'value:', 'value:under_5k');
      } else if (total < 15000) {
        await replaceTagGroup(pool, identifier, contractorId, 'value:', 'value:5k_to_15k');
      } else {
        await replaceTagGroup(pool, identifier, contractorId, 'value:', 'value:over_15k');
      }
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'value:');
    }

    // ── PAYING CLIENT (lifetime — never removed) ──────────────────────────────
    const hasAnyPaidInvoice = allInvoices.some(
      inv => (inv.invoiceStatus || '').toLowerCase() === 'paid'
    );
    if (hasAnyPaidInvoice) {
      await upsertTag(pool, identifier, contractorId, 'paying_client', 'jobber_crm');
    }

    // ── CUSTOM FIELD TAGS (most recent job's custom fields) ──────────────────
    const mostRecentJob = jobs.length > 0 ? sortByCreatedAtDesc(jobs)[0] : null;
    const jobCustomFields = mostRecentJob?.customFields || [];

    // work_category: Job Type
    const workCategory = getCustomFieldValue(jobCustomFields, 'Job Type');
    if (!isBlankFieldValue(workCategory)) {
      await replaceTagGroup(pool, identifier, contractorId, 'work_category:', `work_category:${normalizeTagValue(workCategory)}`);
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'work_category:');
    }

    // material_type: Material Type
    const materialType = getCustomFieldValue(jobCustomFields, 'Material Type');
    if (!isBlankFieldValue(materialType)) {
      await replaceTagGroup(pool, identifier, contractorId, 'material_type:', `material_type:${normalizeTagValue(materialType)}`);
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'material_type:');
    }

    // assigned_rep: Sales Representative
    const assignedRep = getCustomFieldValue(jobCustomFields, 'Sales Representative');
    if (!isBlankFieldValue(assignedRep)) {
      await replaceTagGroup(pool, identifier, contractorId, 'assigned_rep:', `assigned_rep:${assignedRep.toLowerCase().trim()}`);
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'assigned_rep:');
    }

    // insurance: Insurance Company
    const insurance = getCustomFieldValue(jobCustomFields, 'Insurance Company');
    if (!isBlankFieldValue(insurance)) {
      await replaceTagGroup(pool, identifier, contractorId, 'insurance:', `insurance:${insurance.toLowerCase().trim()}`);
    } else {
      await removeTagsByPrefix(pool, identifier, contractorId, 'insurance:');
    }

  } catch (err) {
    await logError({ req: null, error: err, source: `deriveAndSaveTags(${jobberClientId})` });
  }
}

module.exports = deriveAndSaveTags;
