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

  return (
    <>
      <AdminPageHeader title="Engagement" subtitle="Leaderboard and prize configuration" />

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
                    <td style={{ padding: '12px', fontWeight: 500, color: AD.textPrimary }}>{row.name}</td>
                    <td style={{ padding: '12px', color: AD.textSecondary }}>{row.email}</td>
                    <td style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: AD.textPrimary }}>{row.converted_jobs ?? 0}</td>
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
