import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Btn } from './AdminComponents';

const PERIODS = [
  { key: 'monthly',   label: 'Monthly'   },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly',    label: 'Yearly'    },
  { key: 'alltime',   label: 'All-Time'  },
];

const PLACES = [
  { label: '🥇 1st Place', idx: 0 },
  { label: '🥈 2nd Place', idx: 1 },
  { label: '🥉 3rd Place', idx: 2 },
];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function emptyPrizes() {
  return [
    { amount: '', description: '' },
    { amount: '', description: '' },
    { amount: '', description: '' },
  ];
}

const card = {
  background: AD.bgCard,
  border: `1px solid ${AD.border}`,
  borderRadius: 16,
  padding: '24px 28px',
  boxShadow: AD.shadowSm,
  marginBottom: 24,
};

const inputBase = {
  padding: '8px 12px',
  background: AD.bgSurface,
  border: `1px solid ${AD.borderStrong}`,
  borderRadius: 10,
  fontFamily: AD.fontSans,
  fontSize: 15,
  color: AD.textPrimary,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

// Compute current quarter and year windows from season settings for the preview row
function computeSeasonPreview(ysm, q1, q2, q3, q4) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  function fmt(d) {
    return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  function lastDay(exclusiveEnd) {
    return new Date(exclusiveEnd.getTime() - 86400000);
  }

  // Year window
  const yStartYear = currentMonth >= ysm ? currentYear : currentYear - 1;
  const yStart = new Date(yStartYear, ysm - 1, 1);
  const yEnd = lastDay(new Date(yStartYear + 1, ysm - 1, 1));

  // Quarter window
  const q = [q1, q2, q3, q4];
  let qIdx = 0;
  for (let i = q.length - 1; i >= 0; i--) {
    if (currentMonth >= q[i]) { qIdx = i; break; }
  }
  const qStartMonth = q[qIdx];
  const qEndMonth = q[(qIdx + 1) % 4];
  const qEndYear = qEndMonth <= qStartMonth ? currentYear + 1 : currentYear;
  const qStart = new Date(currentYear, qStartMonth - 1, 1);
  const qEnd = lastDay(new Date(qEndYear, qEndMonth - 1, 1));

  return {
    quarter: `${fmt(qStart)} – ${fmt(qEnd)}`,
    year: `${fmt(yStart)} – ${fmt(yEnd)}`,
  };
}

function MonthSelect({ value, onChange, label, helperText }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{ ...inputBase, width: 200, cursor: 'pointer' }}
        onFocus={e => e.target.style.borderColor = AD.blueLight}
        onBlur={e => e.target.style.borderColor = AD.borderStrong}
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i + 1} value={i + 1}>{name}</option>
        ))}
      </select>
      {helperText && (
        <div style={{ fontSize: 12, color: AD.textTertiary, marginTop: 4 }}>{helperText}</div>
      )}
    </div>
  );
}

function PrizeRows({ prizes, setPrizes }) {
  function update(idx, field, value) {
    setPrizes(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }
  return PLACES.map(({ label, idx }) => (
    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <div style={{ width: 114, fontSize: 14, fontWeight: 500, color: AD.textSecondary, flexShrink: 0 }}>{label}</div>
      <div style={{ position: 'relative', width: 120, flexShrink: 0 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: AD.textSecondary, fontSize: 14, pointerEvents: 'none' }}>$</span>
        <input
          type="number"
          min="0"
          value={prizes[idx].amount}
          onChange={e => update(idx, 'amount', e.target.value)}
          placeholder="0"
          style={{ ...inputBase, width: '100%', paddingLeft: 22 }}
          onFocus={e => e.target.style.borderColor = AD.blueLight}
          onBlur={e => e.target.style.borderColor = AD.borderStrong}
        />
      </div>
      <input
        type="text"
        value={prizes[idx].description}
        onChange={e => update(idx, 'description', e.target.value)}
        placeholder="e.g. Visa gift card"
        style={{ ...inputBase, flex: 1 }}
        onFocus={e => e.target.style.borderColor = AD.blueLight}
        onBlur={e => e.target.style.borderColor = AD.borderStrong}
      />
    </div>
  ));
}

export default function AdminEngagement({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };

  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState('');

  // Section 0 — Season Settings
  const [yearStartMonth, setYearStartMonth] = useState(1);
  const [q1Start, setQ1Start] = useState(1);
  const [q2Start, setQ2Start] = useState(4);
  const [q3Start, setQ3Start] = useState(7);
  const [q4Start, setQ4Start] = useState(10);

  // Section 1 — Leaderboard toggle
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);

  // Section 2 — Prize config
  const [quarterlyPrizes, setQuarterlyPrizes] = useState(emptyPrizes());
  const [yearlyPrizes,    setYearlyPrizes]    = useState(emptyPrizes());

  // Save state
  const [saving,     setSaving]     = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Section 3 — Admin leaderboard view
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading,   setLbLoading]   = useState(true);
  const [period,      setPeriod]      = useState('alltime');

  // Section 4 — Prize Preview
  const [preview,        setPreview]        = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/engagement-settings`, {
      headers: { 'Authorization': `Bearer ${adminToken()}` },
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        setLeaderboardEnabled(d.leaderboard_enabled ?? true);
        if (Array.isArray(d.quarterly_prizes) && d.quarterly_prizes.length > 0) {
          setQuarterlyPrizes(d.quarterly_prizes.map(p => ({ amount: p.amount ?? '', description: p.description ?? '' })));
        }
        if (Array.isArray(d.yearly_prizes) && d.yearly_prizes.length > 0) {
          setYearlyPrizes(d.yearly_prizes.map(p => ({ amount: p.amount ?? '', description: p.description ?? '' })));
        }
        setYearStartMonth(d.year_start_month ?? 1);
        setQ1Start(d.quarter_1_start ?? 1);
        setQ2Start(d.quarter_2_start ?? 4);
        setQ3Start(d.quarter_3_start ?? 7);
        setQ4Start(d.quarter_4_start ?? 10);
        setLoading(false);
      })
      .catch(() => { setLoadError('Failed to load settings.'); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLbLoading(true);
    fetch(`${BACKEND_URL}/api/admin/leaderboard?period=${period}`, {
      headers: { 'Authorization': `Bearer ${adminToken()}` },
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        setLeaderboard(Array.isArray(d) ? d : []);
        setLbLoading(false);
      })
      .catch(() => setLbLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  function handleSave() {
    setSaving(true); setSaveStatus('');
    fetch(`${BACKEND_URL}/api/admin/engagement-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({
        leaderboard_enabled: leaderboardEnabled,
        quarterly_prizes: quarterlyPrizes,
        yearly_prizes: yearlyPrizes,
        year_start_month: yearStartMonth,
        quarter_1_start: q1Start,
        quarter_2_start: q2Start,
        quarter_3_start: q3Start,
        quarter_4_start: q4Start,
      }),
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => {
        setSaving(false);
        if (!d) return;
        setSaveStatus(d.success ? 'saved' : 'error');
        setTimeout(() => setSaveStatus(''), 2000);
      })
      .catch(() => { setSaving(false); setSaveStatus('error'); });
  }

  function handlePreviewWinners() {
    setPreviewLoading(true);
    setPreview(null);
    Promise.all([
      fetch(`${BACKEND_URL}/api/admin/leaderboard?period=quarterly`, { headers: { 'Authorization': `Bearer ${adminToken()}` } }),
      fetch(`${BACKEND_URL}/api/admin/leaderboard?period=yearly`,    { headers: { 'Authorization': `Bearer ${adminToken()}` } }),
    ])
      .then(async ([qRes, yRes]) => {
        if (qRes.status === 401 || yRes.status === 401) { on401(); return; }
        const [qData, yData] = await Promise.all([qRes.json(), yRes.json()]);
        setPreview({
          quarterly: Array.isArray(qData) ? qData : [],
          yearly:    Array.isArray(yData) ? yData : [],
        });
        setPreviewLoading(false);
      })
      .catch(() => { setPreview({ error: 'Failed to load preview.' }); setPreviewLoading(false); });
  }

  if (loading) {
    return (
      <>
        <AdminPageHeader title="Engagement" />
        <p style={{ color: AD.textSecondary, fontSize: 15 }}>Loading…</p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <AdminPageHeader title="Engagement" />
        <p style={{ color: AD.red2Text, fontSize: 15 }}>{loadError}</p>
      </>
    );
  }

  const seasonPreview = computeSeasonPreview(yearStartMonth, q1Start, q2Start, q3Start, q4Start);

  return (
    <>
      <AdminPageHeader title="Engagement" subtitle="Leaderboard and prize configuration" />

      {/* Section 0 — Season Settings */}
      <div style={card}>
        <div style={{ fontSize: 17, fontWeight: 600, color: AD.textPrimary, marginBottom: 4 }}>Season Settings</div>
        <div style={{ fontSize: 14, color: AD.textSecondary, marginBottom: 20 }}>
          Define when your leaderboard periods reset. Defaults to standard calendar year.
        </div>

        <MonthSelect
          value={yearStartMonth}
          onChange={setYearStartMonth}
          label="Your leaderboard year begins in…"
          helperText="This sets when yearly prizes reset. Default is January."
        />

        <div style={{ borderTop: `1px solid ${AD.border}`, margin: '20px 0' }} />

        <div style={{ fontSize: 14, fontWeight: 500, color: AD.textSecondary, marginBottom: 16 }}>
          Quarter Definitions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 32px' }}>
          <MonthSelect value={q1Start} onChange={setQ1Start} label="Q1 Start" helperText="First quarter begins" />
          <MonthSelect value={q2Start} onChange={setQ2Start} label="Q2 Start" helperText="Second quarter begins" />
          <MonthSelect value={q3Start} onChange={setQ3Start} label="Q3 Start" helperText="Third quarter begins" />
          <MonthSelect value={q4Start} onChange={setQ4Start} label="Q4 Start" helperText="Fourth quarter begins" />
        </div>

        <div style={{
          marginTop: 8,
          padding: '12px 16px',
          background: AD.bgCardTint,
          borderRadius: 10,
          fontSize: 13,
          color: AD.textSecondary,
          lineHeight: 1.6,
        }}>
          <span style={{ color: AD.blueText, fontWeight: 500 }}>Current quarter:</span> {seasonPreview.quarter}
          <span style={{ margin: '0 10px', color: AD.textTertiary }}>·</span>
          <span style={{ color: AD.blueText, fontWeight: 500 }}>Current year:</span> {seasonPreview.year}
        </div>
      </div>

      {/* Section 1 — Leaderboard Toggle */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: AD.textPrimary, marginBottom: 3 }}>Leaderboard</div>
            <div style={{ fontSize: 14, color: AD.textSecondary }}>Show Rankings tab to referrers</div>
          </div>
          <button
            onClick={() => setLeaderboardEnabled(v => !v)}
            aria-label="Toggle leaderboard visibility"
            style={{
              width: 48, height: 26, borderRadius: 99, flexShrink: 0,
              background: leaderboardEnabled ? AD.green : AD.borderStrong,
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s', padding: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: leaderboardEnabled ? 25 : 3,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>
      </div>

      {/* Section 2 — Prize Configuration */}
      <div style={card}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: AD.textPrimary, marginBottom: 16 }}>Quarterly Prizes</div>
          <PrizeRows prizes={quarterlyPrizes} setPrizes={setQuarterlyPrizes} />
        </div>
        <div style={{ borderTop: `1px solid ${AD.border}`, paddingTop: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: AD.textPrimary, marginBottom: 16 }}>Yearly Prizes</div>
          <PrizeRows prizes={yearlyPrizes} setPrizes={setYearlyPrizes} />
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
        <Btn onClick={handleSave} variant="accent" size="lg" style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Btn>
        {saveStatus === 'saved' && <span style={{ color: AD.greenText, fontSize: 14 }}>Saved successfully.</span>}
        {saveStatus === 'error' && <span style={{ color: AD.red2Text,  fontSize: 14 }}>Save failed — try again.</span>}
      </div>

      {/* Section 4 — Prize Preview */}
      {/* STRIPE HOOK: replace preview-only state with confirmation + Stripe trigger when stripe.js routes are implemented */}
      <div style={card}>
        <div style={{ fontSize: 17, fontWeight: 600, color: AD.textPrimary, marginBottom: 6 }}>Prize Preview</div>
        <div style={{ fontSize: 14, color: AD.textSecondary, marginBottom: 20 }}>
          See who would win prizes based on current standings. No payouts are triggered.
        </div>

        <Btn onClick={handlePreviewWinners} variant="secondary" size="md" style={{ opacity: previewLoading ? 0.7 : 1 }}>
          {previewLoading ? 'Loading…' : 'Preview Winners'}
        </Btn>

        {preview && !preview.error && (
          <div style={{ marginTop: 24 }}>
            {['quarterly', 'yearly'].map(pKey => {
              const prizeSrc = pKey === 'quarterly' ? quarterlyPrizes : yearlyPrizes;
              const winners  = preview[pKey] || [];
              return (
                <div key={pKey} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: AD.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                    {pKey === 'quarterly' ? 'Quarterly' : 'Yearly'} — {seasonPreview[pKey === 'quarterly' ? 'quarter' : 'year']}
                  </div>
                  {PLACES.map(({ label, idx }) => {
                    const winner = winners[idx];
                    const prize  = prizeSrc[idx];
                    const hasAmount = prize?.amount && parseFloat(prize.amount) > 0;
                    if (!winner || winner.converted_count === 0) {
                      return (
                        <div key={idx} style={{ fontSize: 14, color: AD.textTertiary, marginBottom: 8 }}>
                          {label}: Not enough data yet
                        </div>
                      );
                    }
                    const lastInitial = winner.last_name ? ` ${winner.last_name[0].toUpperCase()}.` : '';
                    return (
                      <div key={idx} style={{ fontSize: 14, color: AD.textPrimary, marginBottom: 8 }}>
                        <span style={{ color: AD.textSecondary }}>{label}:</span>{' '}
                        <strong>{winner.first_name}{lastInitial}</strong>
                        {' '}({winner.converted_count} {winner.converted_count === 1 ? 'job' : 'jobs'})
                        {' '}would receive{' '}
                        <strong style={{ color: hasAmount ? AD.greenText : AD.textSecondary }}>
                          {hasAmount ? `$${prize.amount}` : '(no prize set)'}
                        </strong>
                        {prize?.description ? <span style={{ color: AD.textSecondary }}> — {prize.description}</span> : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div style={{ fontSize: 12, color: AD.textTertiary, marginTop: 8, borderTop: `1px solid ${AD.border}`, paddingTop: 12 }}>
              This is a preview only. No payouts are triggered. When Stripe ACH is connected, a Confirm Payout button will appear here.
            </div>
          </div>
        )}

        {preview?.error && (
          <div style={{ marginTop: 16, fontSize: 14, color: AD.red2Text }}>{preview.error}</div>
        )}
      </div>

      {/* Section 3 — Admin Leaderboard View */}
      <div style={card}>
        <div style={{ fontSize: 17, fontWeight: 600, color: AD.textPrimary, marginBottom: 16 }}>Leaderboard</div>

        {/* Period filter pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '6px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: AD.fontSans,
                background: period === p.key ? AD.navy : AD.bgCardTint,
                color: period === p.key ? '#fff' : AD.textSecondary,
                transition: 'background 0.15s, color 0.15s',
              }}
            >{p.label}</button>
          ))}
        </div>

        {lbLoading ? (
          <p style={{ color: AD.textSecondary, fontSize: 14, margin: 0 }}>Loading…</p>
        ) : leaderboard.length === 0 ? (
          <p style={{ color: AD.textSecondary, fontSize: 14, margin: 0 }}>No data for this period.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontFamily: AD.fontSans }}>
              <thead>
                <tr>
                  {['Rank', 'Name', 'Email', 'Converted Jobs'].map(col => (
                    <th key={col} style={{
                      textAlign: col === 'Rank' || col === 'Converted Jobs' ? 'center' : 'left',
                      padding: '8px 12px', fontSize: 11, fontWeight: 500,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: AD.textSecondary, borderBottom: `1px solid ${AD.border}`,
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.email || i} style={{ borderBottom: `1px solid ${AD.border}` }}>
                    <td style={{ textAlign: 'center', padding: '12px', color: AD.textSecondary, fontSize: 13 }}>{i + 1}</td>
                    <td style={{ padding: '12px', fontWeight: 500, color: AD.textPrimary }}>{row.first_name} {row.last_name}</td>
                    <td style={{ padding: '12px', color: AD.textSecondary }}>{row.email}</td>
                    <td style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: AD.textPrimary }}>{row.converted_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
