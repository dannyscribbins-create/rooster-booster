import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Badge, Btn } from './AdminComponents';
import Skeleton from '../shared/Skeleton';
import { safeAsync } from '../../utils/clientErrorReporter';

const METHOD_CONFIG = {
  stripe_ach: { icon: 'ph-bank',           label: 'Stripe ACH',    bg: AD.blueBg,                    color: AD.blueText,      border: `${AD.blue}30` },
  check:      { icon: 'ph-envelope-simple', label: 'Check by Mail', bg: 'rgba(255,255,255,0.06)',      color: AD.textSecondary, border: AD.border },
  venmo:      { icon: 'ph-device-mobile',  label: 'Venmo',         bg: 'rgba(255,255,255,0.06)',      color: AD.textSecondary, border: AD.border },
  zelle:      { icon: 'ph-lightning',      label: 'Zelle',         bg: 'rgba(255,255,255,0.06)',      color: AD.textSecondary, border: AD.border },
};
const UNKNOWN_METHOD = { icon: 'ph-question', label: 'Unknown', bg: 'rgba(255,255,255,0.06)', color: AD.textTertiary, border: AD.border };

function MethodBadge({ method }) {
  const cfg = METHOD_CONFIG[method] || UNKNOWN_METHOD;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: 11, fontWeight: 500, fontFamily: AD.fontSans, flexShrink: 0,
    }}>
      <i className={`ph ${cfg.icon}`} style={{ fontSize: 12 }} />
      {cfg.label}
    </span>
  );
}

export default function AdminCashOuts({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
  const [cashouts, setCashouts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [transferringId, setTransferringId]   = useState(null);
  const [transferErrors, setTransferErrors]   = useState({});

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/cashouts`, { headers: { 'Authorization': `Bearer ${adminToken()}` } });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      setCashouts(Array.isArray(d) ? d : []);
      setLoading(false);
    } catch {
      // no-op: preserves original behavior where setLoading stays true on error
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const handleAction = safeAsync(async (id, status) => {
    const msgs = { approved: 'Approve this request?', denied: 'Deny this request?', paid: 'Mark this request as paid?' };
    if (!window.confirm(msgs[status] || 'Confirm?')) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/cashouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ status }),
      });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      if (d.error) alert(d.error); else load();
    } catch {
      // swallow
    }
  }, 'AdminCashOuts');

  const handleStripeTransfer = safeAsync(async (c) => {
    if (!window.confirm('Approve and send Stripe ACH transfer?')) return;
    setTransferringId(c.id);
    setTransferErrors(prev => ({ ...prev, [c.id]: null }));
    try {
      const transferRes = await fetch(`${BACKEND_URL}/api/admin/stripe/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ cashoutRequestId: c.id, userId: c.user_id, bonusAmount: parseFloat(c.amount) }),
      });
      if (transferRes.status === 401) { on401(); return; }
      const transferData = await transferRes.json();
      if (!transferRes.ok) {
        let msg;
        if (transferData.error === 'no_bank_account') {
          msg = 'This referrer has not connected a bank account yet. They have been notified — check back once they connect.';
        } else if (transferData.error === 'no_stripe_account') {
          msg = 'Contractor Stripe account is not connected. Go to Banking Settings to complete setup.';
        } else {
          msg = transferData.message || 'Transfer failed. Please try again.';
        }
        setTransferErrors(prev => ({ ...prev, [c.id]: msg }));
        return;
      }
      const approveRes = await fetch(`${BACKEND_URL}/api/admin/cashouts/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (approveRes.status === 401) { on401(); return; }
      if (!approveRes.ok) {
        const approveData = await approveRes.json().catch(() => ({}));
        const msg = approveData.error || 'Transfer succeeded but approval failed — please approve manually.';
        setTransferErrors(prev => ({ ...prev, [c.id]: msg }));
        return;
      }
      load();
    } catch {
      setTransferErrors(prev => ({ ...prev, [c.id]: 'Unexpected error during transfer' }));
    } finally {
      setTransferringId(null);
    }
  }, 'AdminCashOuts');

  const noteStyle = { margin: '8px 0 0', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans };

  function renderActions(c) {
    const isStripeACH = c.payout_method === 'stripe_ach';

    if (c.status === 'pending') {
      if (isStripeACH) {
        const isTransferring = transferringId === c.id;
        const transferError = transferErrors[c.id];
        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => !isTransferring && handleStripeTransfer(c)} variant="success" disabled={isTransferring}>
                <i className="ph ph-bank" /> {isTransferring ? 'Transferring…' : 'Approve & Transfer'}
              </Btn>
              <Btn onClick={() => handleAction(c.id, 'denied')} variant="danger" disabled={isTransferring}>
                <i className="ph ph-x" /> Deny
              </Btn>
            </div>
            {transferError && (
              <p style={{ ...noteStyle, color: AD.red2Text, marginTop: 8 }}>
                <i className="ph ph-warning-circle" style={{ marginRight: 4 }} />
                {transferError}
              </p>
            )}
            {!transferError && (
              <p style={noteStyle}>Stripe ACH transfer fires before approval is recorded.</p>
            )}
          </div>
        );
      }
      return (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => handleAction(c.id, 'paid')} variant="success">
              <i className="ph ph-check" /> Mark as Paid
            </Btn>
            <Btn onClick={() => handleAction(c.id, 'denied')} variant="danger">
              <i className="ph ph-x" /> Deny
            </Btn>
          </div>
          <p style={noteStyle}>Send payment manually, then mark as paid.</p>
        </div>
      );
    }

    if (c.status === 'approved') {
      return (
        <div style={{ marginTop: 16 }}>
          <Btn onClick={() => handleAction(c.id, 'paid')} variant="success">
            <i className="ph ph-check" /> Mark as Paid
          </Btn>
        </div>
      );
    }

    if (c.status === 'paid') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <i className="ph-fill ph-check-circle" style={{ color: AD.greenText, fontSize: 18 }} />
          <span style={{ color: AD.greenText, fontWeight: 600, fontSize: 13, fontFamily: AD.fontSans }}>Paid</span>
          {c.paid_at && (
            <span style={{ color: AD.textTertiary, fontSize: 12, fontFamily: AD.fontSans }}>
              {new Date(c.paid_at).toLocaleDateString()}
            </span>
          )}
        </div>
      );
    }

    if (c.status === 'denied') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <i className="ph-fill ph-x-circle" style={{ color: AD.red2Text, fontSize: 18 }} />
          <span style={{ color: AD.red2Text, fontWeight: 600, fontSize: 13, fontFamily: AD.fontSans }}>Denied</span>
        </div>
      );
    }

    return null;
  }

  const filtered = filter === 'all' ? cashouts : cashouts.filter(c => c.status === filter);
  const pendingCount = cashouts.filter(c => c.status === 'pending').length;
  const badgeType = { pending: 'warning', approved: 'info', paid: 'success', denied: 'danger' };

  return (
    <>
      <AdminPageHeader title="Cash Outs" subtitle={pendingCount > 0 ? `${pendingCount} pending review` : 'All requests reviewed'} />
      <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
        {['all', 'pending', 'approved', 'paid', 'denied'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter === f ? AD.bgSurface : 'transparent', color: filter === f ? AD.textPrimary : AD.textSecondary, fontSize: 12, fontWeight: filter === f ? 600 : 400, fontFamily: AD.fontSans, textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>
            {f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => <Skeleton key={i} height="120px" borderRadius="16px" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '32px', textAlign: 'center' }}>
          <i className="ph ph-check-circle" style={{ fontSize: 32, color: AD.greenText, display: 'block', marginBottom: 8 }} />
          <p style={{ color: AD.textSecondary, fontSize: 15, margin: 0 }}>No {filter === 'all' ? '' : filter} requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: AD.shadowSm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {c.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>{c.full_name}</p>
                      <MethodBadge method={c.payout_method} />
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{c.email}</p>
                  </div>
                </div>
                <Badge type={badgeType[c.status] || 'neutral'}>{c.status}</Badge>
              </div>
              <div style={{ display: 'flex', gap: 28 }}>
                {[
                  { label: 'Amount', val: `$${parseFloat(c.amount).toLocaleString()}`, mono: true, big: true },
                  { label: 'Submitted', val: new Date(c.requested_at).toLocaleDateString() },
                ].map(({ label, val, mono, big }) => (
                  <div key={label}>
                    <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</p>
                    <p style={{ margin: '3px 0 0', fontSize: big ? 16 : 15, fontWeight: big ? 700 : 500, color: AD.textPrimary, fontFamily: mono ? "'Roboto Mono', monospace" : AD.fontSans }}>{val}</p>
                  </div>
                ))}
              </div>
              {c.bank_connection_blocked_reason && (
                <div style={{
                  backgroundColor: '#1a0a00',
                  border: '1px solid #ff8c00',
                  borderRadius: 8,
                  padding: '10px 12px',
                  margin: '10px 0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8
                }}>
                  <i className="ph-fill ph-warning"
                     style={{ fontSize: 16, color: '#ff8c00', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#ff8c00',
                      marginBottom: 3
                    }}>
                      Transfer Blocked
                    </div>
                    <div style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: 12,
                      color: '#cc7700',
                      lineHeight: 1.4
                    }}>
                      {c.bank_connection_blocked_reason}
                    </div>
                  </div>
                </div>
              )}
              {renderActions(c)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
