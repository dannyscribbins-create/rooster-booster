import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { STATUS_CONFIG } from '../../constants/theme';
import { AdminPageHeader, StatCard, Badge, Btn, AdminInput } from './AdminComponents';

export default function AdminReferrers({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [newName, setNewName]       = useState('');
  const [newEmail, setNewEmail]     = useState('');
  const [newPin, setNewPin]         = useState('');
  const [formError, setFormError]   = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [selected, setSelected]     = useState(null);
  const [detail, setDetail]         = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function loadUsers() {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); }, []);

  function openDetail(user) {
    setSelected(user); setDetail(null); setDetailLoading(true);
    fetch(`${BACKEND_URL}/api/admin/referrer/${encodeURIComponent(user.full_name)}`, {
      headers: { 'Authorization': `Bearer ${adminToken()}` },
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; setDetail(d); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }

  function handleAdd() {
    setFormError(''); setFormSuccess('');
    if (!newName || !newEmail || !newPin) { setFormError('All fields required'); return; }
    fetch(`${BACKEND_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({ full_name: newName, email: newEmail, pin: newPin }),
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return;
        if (d.error) setFormError(d.error);
        else { setFormSuccess(`✓ ${newName} added`); setNewName(''); setNewEmail(''); setNewPin(''); setShowAdd(false); loadUsers(); }
      });
  }

  function handleRemove(id, name) {
    if (!window.confirm(`Remove ${name}?`)) return;
    fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken()}` },
    })
      .then(r => { if (r.status === 401) { on401(); return; } loadUsers(); });
  }

  function handleResetPin(id, name) {
    const p = window.prompt(`New PIN for ${name} (4–6 digits):`);
    if (!p) return;
    if (p.length < 4 || p.length > 6) { alert('PIN must be 4–6 digits'); return; }
    fetch(`${BACKEND_URL}/api/admin/users/${id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({ pin: p }),
    }).then(r => {
      if (r.status === 401) { on401(); return null; }
      return r.json();
    }).then(d => { if (!d) return; if (d.error) alert(d.error); else alert('✓ PIN updated'); });
  }

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Btn onClick={() => setSelected(null)} variant="outline" size="sm"><i className="ph ph-arrow-left" /> Back to Referrers</Btn>
        </div>
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px', marginBottom: 20, boxShadow: AD.shadowSm, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
            {selected.full_name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary }}>{selected.full_name}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 15, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{selected.email}</p>
          </div>
        </div>
        {detailLoading ? (
          <p style={{ color: AD.textSecondary, fontSize: 15, padding: '20px 0' }}>Loading Jobber data...</p>
        ) : detail ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard label="Total Referrals" value={detail.pipeline.length}                        icon="ph-clipboard-text" animDelay={0}   />
              <StatCard label="Sold"            value={detail.paidCount}                              icon="ph-trophy" accent={AD.greenText} animDelay={80}  />
              <StatCard label="Balance"         value={`$${detail.balance.toLocaleString()}`}         icon="ph-currency-dollar" accent={AD.amberText} animDelay={160} />
            </div>
            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${AD.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Pipeline</p>
                <span style={{ fontSize: 12, color: AD.textSecondary }}>{detail.pipeline.length} referred clients</span>
              </div>
              {detail.pipeline.length === 0 ? (
                <p style={{ color: AD.textSecondary, fontSize: 15, padding: '20px' }}>No referred clients found in Jobber.</p>
              ) : detail.pipeline.map((ref, i) => {
                const s = STATUS_CONFIG[ref.status];
                const badgeType = { lead: 'neutral', inspection: 'info', sold: 'success', closed: 'danger' }[ref.status];
                return (
                  <div key={ref.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: i < detail.pipeline.length - 1 ? `1px solid ${AD.border}` : 'none', borderLeft: `3px solid ${s.dot}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: AD.textSecondary }}>
                        {ref.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 500, color: AD.textPrimary }}>{ref.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {ref.payout && <span style={{ fontSize: 15, fontWeight: 700, color: AD.greenText, fontFamily: "'Roboto Mono', monospace" }}>+${ref.payout}</span>}
                      <Badge type={badgeType}>{s.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : <p style={{ color: AD.red2Text, fontSize: 15 }}>Failed to load Jobber data for this referrer.</p>}
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title="Referrers" subtitle={`${users.length} account${users.length !== 1 ? 's' : ''} enrolled`}
        action={<Btn onClick={() => setShowAdd(!showAdd)} variant="accent" size="md"><i className={`ph ph-${showAdd ? 'x' : 'plus'}`} /> {showAdd ? 'Cancel' : 'Add Referrer'}</Btn>}
      />
      {showAdd && (
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px 24px', marginBottom: 20, boxShadow: AD.shadowSm }}>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: AD.blueText, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>New Referrer Account</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: 12, alignItems: 'flex-end' }}>
            <AdminInput value={newName}  onChange={e => setNewName(e.target.value)}  placeholder="Daniel Scribbins" label="Full name (match Jobber exactly)" />
            <AdminInput value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" label="Email address" />
            <AdminInput value={newPin}   onChange={e => setNewPin(e.target.value)}   placeholder="1234" label="PIN (4–6 digits)" />
            <div style={{ paddingBottom: 16 }}><Btn onClick={handleAdd} variant="accent">Add</Btn></div>
          </div>
          {formError   && <p style={{ color: AD.red2Text,  fontSize: 12, margin: '4px 0 0' }}>{formError}</p>}
          {formSuccess  && <p style={{ color: AD.greenText, fontSize: 12, margin: '4px 0 0' }}>{formSuccess}</p>}
        </div>
      )}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 99, padding: '8px 16px', maxWidth: 320, boxShadow: AD.shadowSm }}>
        <i className="ph ph-magnifying-glass" style={{ color: AD.textTertiary, fontSize: 16 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." style={{ border: 'none', background: 'transparent', fontFamily: AD.fontSans, fontSize: 15, color: AD.textPrimary, outline: 'none', flex: 1 }} />
      </div>
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: AD.fontSans, fontSize: 15 }}>
          <thead>
            <tr style={{ background: AD.bgCardTint, borderBottom: `1px solid ${AD.border}` }}>
              {['Referrer', 'Email', 'Added', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: AD.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '20px', color: AD.textSecondary, fontSize: 15 }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '20px', color: AD.textSecondary, fontSize: 15 }}>{search ? 'No results found.' : 'No referrers yet — add one above.'}</td></tr>
            ) : filtered.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${AD.border}` : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = AD.bgCardTint}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {u.full_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span style={{ fontWeight: 500, color: AD.textPrimary }}>{u.full_name}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 24px', color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace", fontSize: 12.5 }}>{u.email}</td>
                <td style={{ padding: '16px 24px', color: AD.textSecondary, fontSize: 12.5 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => openDetail(u)} variant="outline" size="sm"><i className="ph ph-eye" /> View</Btn>
                    <Btn onClick={() => handleResetPin(u.id, u.full_name)} variant="outline" size="sm"><i className="ph ph-key" /> PIN</Btn>
                    <Btn onClick={() => handleRemove(u.id, u.full_name)} variant="danger" size="sm"><i className="ph ph-trash" /></Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
