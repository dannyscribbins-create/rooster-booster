function deriveOptOutType(row) {
  if (!row.opt_out_campaigns && !row.opt_out_sms && !row.opt_out_all && !row.referral_only) return null;
  if (row.opt_out_all)       return 'all';
  if (row.opt_out_campaigns) return 'campaigns';
  if (row.opt_out_sms)       return 'sms';
  if (row.referral_only)     return 'referral_only';
  return null;
}

module.exports = { deriveOptOutType };
