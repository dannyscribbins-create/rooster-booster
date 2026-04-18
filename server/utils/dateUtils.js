// SCALABLE: period boundaries driven by contractor engagement_settings, not hardcoded
function getPeriodDateRange(period, settings) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (!period || period === 'alltime') return { start: null, end: null };
  if (period === 'monthly') {
    return {
      start: new Date(currentYear, now.getMonth(), 1),
      end: new Date(currentYear, now.getMonth() + 1, 1),
    };
  }
  if (period === 'yearly') {
    const ysm = settings.year_start_month || 1;
    const startYear = currentMonth >= ysm ? currentYear : currentYear - 1;
    return {
      start: new Date(startYear, ysm - 1, 1),
      end: new Date(startYear + 1, ysm - 1, 1),
    };
  }
  if (period === 'quarterly') {
    const q = [
      settings.quarter_1_start || 1,
      settings.quarter_2_start || 4,
      settings.quarter_3_start || 7,
      settings.quarter_4_start || 10,
    ];
    let qIdx = 0;
    for (let i = q.length - 1; i >= 0; i--) {
      if (currentMonth >= q[i]) { qIdx = i; break; }
    }
    const qStartMonth = q[qIdx];
    const qEndMonth = q[(qIdx + 1) % 4];
    const endYear = qEndMonth <= qStartMonth ? currentYear + 1 : currentYear;
    return {
      start: new Date(currentYear, qStartMonth - 1, 1),
      end: new Date(endYear, qEndMonth - 1, 1),
    };
  }
  return { start: null, end: null };
}

module.exports = { getPeriodDateRange };
