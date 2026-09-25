'use strict';

// ── THE ONE DEFINITION OF "PAID" (Danny's ruling, 2026-09-25) ────────────────
//
// An invoice counts as paid when ALL THREE hold:
//   invoiceStatus = 'paid'   AND   invoiceBalance = 0   AND   total > 0
//
// ⚠ IT LIVES IN ITS OWN MODULE SO THERE CAN BE EXACTLY ONE. It began inside
// attributionDecide.js, but classifyPipelineStatus (server/crm/pipelineSync.js) has to use it
// too — and attributionDecide imports classifyPipelineStatus, so putting it in either file
// creates a require cycle. A shared rule with two homes is the thing this commit removes.
//
// ⚠ AND server/test/oneDefinitionOfPaid.test.js ENFORCES THAT. It fails if any other file
// compares an invoice status to the 'paid' literal, naming the file and line. If you are about
// to add such a comparison, import isInvoicePaid instead — or PAID_STATUS, if you genuinely need
// the string rather than the decision.
//
// ⚠ WHY EACH CONDITION EARNS ITS PLACE, because a reader will otherwise drop one as redundant:
//   · invoiceStatus = 'paid'  excludes `voided` and `bad_debt`. A written-off invoice has a ZERO
//     BALANCE by definition, so balance alone counts a write-off as revenue.
//   · invoiceBalance = 0      excludes a `paid` invoice still carrying a balance after a credit
//     or an adjustment.
//   · total > 0               excludes a $0 invoice. Zero-value work must never mark a client as
//     paying, and this is the "queued-$0 exclusion" the one-engine design names.
//
// ⚠ THE OLD DEFINITION WAS THE STATUS ALONE, AT SEVEN SITES. It differs from this one in exactly
// two shapes — status paid with a NON-ZERO balance, and status paid with TOTAL 0 — and both of
// those used to mark a client as paying.

// The Jobber InvoiceStatusTypeEnum value that means settled. Exported so a caller that needs the
// STRING (a webhook payload pre-filter, say) does not have to write the literal and trip the
// one-definition fence.
const PAID_STATUS = 'paid';

/**
 * Is this invoice PAID?
 * Inputs: an invoice in EITHER shape —
 *   · a Jobber node:  { invoiceStatus, amounts: { total, invoiceBalance } }
 *   · a database row: { invoiceStatus | invoice_status, total, invoiceBalance | invoice_balance }
 *   Money may be a number or the NUMERIC string node-postgres returns.
 * Output: boolean.
 *
 * ⚠ BOTH SHAPES ON PURPOSE. The seven sites this helper replaced were fed from GraphQL nodes,
 * from saved fact rows, and from a flattened object built for tag derivation. A helper that
 * accepted only one of those would have been copied rather than reused, which is how the
 * definition split in the first place.
 */
function isInvoicePaid(invoice) {
  if (!invoice || typeof invoice !== 'object') return false;

  const status = invoice.invoiceStatus ?? invoice.invoice_status;
  if (typeof status !== 'string') return false;
  if (status.toLowerCase() !== PAID_STATUS) return false;

  // A Jobber node nests the money under `amounts`; a row carries it flat.
  const amounts = invoice.amounts && typeof invoice.amounts === 'object' ? invoice.amounts : invoice;
  const rawBalance = amounts.invoiceBalance ?? amounts.invoice_balance;
  const rawTotal = amounts.total;

  // ⚠ null AND undefined ARE REJECTED BEFORE PARSING. Number(null) is 0, which would read as a
  // SETTLED balance — a missing value must never look like a paid one. This is the direction that
  // fails open, so it is closed explicitly.
  if (rawBalance === null || rawBalance === undefined) return false;
  if (rawTotal === null || rawTotal === undefined) return false;

  const balance = Number(rawBalance);
  const total = Number(rawTotal);
  if (!Number.isFinite(balance) || !Number.isFinite(total)) return false;

  return balance === 0 && total > 0;
}

module.exports = { isInvoicePaid, PAID_STATUS };
