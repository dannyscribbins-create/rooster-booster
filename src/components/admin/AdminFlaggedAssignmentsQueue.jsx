import { useState, useEffect, useCallback } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';

// Generic flag_reason rendering (FA spec §4.3) — plain-language label for whatever
// reason the engine flagged, with a safe fallback so an unrecognized future flag_reason
// value never crashes the queue, it just humanizes the raw string.
const FLAG_REASON_LABELS = {
  orphan: 'Unable to auto-assign a rep',
  rep_co_assignment: 'Two reps matched this client',
};
function flagReasonLabel(reason) {
  return FLAG_REASON_LABELS[reason] || (reason || '').replace(/_/g, ' ');
}

const STATUS_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'auto_resolved', label: 'Auto-Resolved' },
];

function relativeAge(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} minutes ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function FlagCard({ flag, attributableReps, onAssign, onDismiss, actionLoading, historyMode }) {
  const [expanded, setExpanded] = useState(false);
  const [pickedRepId, setPickedRepId] = useState(
    Array.isArray(flag.reps_involved) && flag.reps_involved.length > 0 ? flag.reps_involved[0].id : ''
  );
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);

  const isOpen = flag.status === 'open';

  async function handleAssign() {
    setErr(null);
    if (!pickedRepId) { setErr('Pick a rep to assign.'); return; }
    const ok = await onAssign(flag.id, pickedRepId);
    if (!ok) setErr('Could not assign — please try again.');
  }

  async function handleDismiss() {
    setErr(null);
    const ok = await onDismiss(flag.id, note);
    if (!ok) setErr('Could not dismiss — please try again.');
  }

  return (
    <div style={{
      background: AD.bgCard, border: `1px solid ${AD.border}`,
      borderLeft: `4px solid ${isOpen ? AD.amber : AD.border}`,
      borderRadius: AD.radiusMd, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
            {flagReasonLabel(flag.flag_reason)}
          </div>
          <div style={{ fontSize: 12, color: AD.textTertiary, marginTop: 2, fontFamily: "'Roboto Mono', monospace" }}>
            Client: {flag.jobber_client_id}
          </div>
        </div>
        <span style={{ fontSize: 11, color: AD.textTertiary, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {relativeAge(flag.created_at)}
        </span>
      </div>

      {Array.isArray(flag.reps_involved) && flag.reps_involved.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {flag.reps_involved.map(r => (
            <span key={r.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 9px', borderRadius: AD.radiusPill,
              background: AD.blueBg, color: AD.blueText, fontSize: 12, fontFamily: AD.fontSans,
            }}>
              <i className="ph ph-user" style={{ fontSize: 11 }} />
              {r.full_name || `#${r.id}`}
            </span>
          ))}
        </div>
      )}

      {historyMode ? (
        <div style={{ marginTop: 10, fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
          {flag.status === 'dismissed' && flag.resolution?.note && <>Dismissed — “{flag.resolution.note}”</>}
          {flag.status === 'resolved' && flag.resolution?.rep_id && <>Resolved — assigned rep #{flag.resolution.rep_id}</>}
          {flag.status === 'auto_resolved' && <>Auto-resolved — the client was assigned through a normal event while this flag was open.</>}
          {flag.resolved_at && <span style={{ marginLeft: 6 }}>({relativeAge(flag.resolved_at)})</span>}
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              style={{
                background: 'transparent', border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd,
                padding: '6px 14px', fontSize: 12, color: AD.textSecondary, cursor: 'pointer', fontFamily: AD.fontSans,
              }}
            >
              Resolve
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={pickedRepId}
                  onChange={e => setPickedRepId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  style={{
                    padding: '7px 10px', borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`,
                    background: AD.bgSurface, color: AD.textPrimary, fontSize: 13, fontFamily: AD.fontSans,
                  }}
                >
                  <option value="">— Select a rep —</option>
                  {attributableReps.map(r => (
                    <option key={r.id} value={r.id}>{r.full_name || r.email}</option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={actionLoading}
                  style={{
                    padding: '7px 16px', borderRadius: AD.radiusMd, border: 'none',
                    background: actionLoading ? AD.bgCardTint : AD.blueText,
                    color: actionLoading ? AD.textSecondary : '#fff',
                    fontSize: 13, fontWeight: 500, fontFamily: AD.fontSans,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Assign
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Optional dismiss note…"
                  style={{
                    flex: 1, minWidth: 160, padding: '7px 10px', borderRadius: AD.radiusMd,
                    border: `1px solid ${AD.border}`, background: AD.bgSurface, color: AD.textPrimary,
                    fontSize: 13, fontFamily: AD.fontSans, boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={handleDismiss}
                  disabled={actionLoading}
                  style={{
                    padding: '7px 16px', borderRadius: AD.radiusMd,
                    border: `1px solid ${AD.red2}`,
                    background: actionLoading ? AD.bgCardTint : AD.red2Bg,
                    color: actionLoading ? AD.textSecondary : AD.red2Text,
                    fontSize: 13, fontWeight: 500, fontFamily: AD.fontSans,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Dismiss
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  style={{
                    background: 'transparent', border: 'none', color: AD.textTertiary,
                    fontSize: 12, cursor: 'pointer', fontFamily: AD.fontSans,
                  }}
                >
                  Cancel
                </button>
              </div>
              {err && <div style={{ fontSize: 12, color: AD.red2Text }}>{err}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// FA spec §4.3/§4.5 — queue card. Defaults to the open list; a status filter reaches
// resolved/dismissed/auto_resolved history. onOpenCountChange bubbles the live open
// count up to the parent for the section-nav badge (FQ-1).
export default function AdminFlaggedAssignmentsQueue({ onOpenCountChange }) {
  const [statusFilter, setStatusFilter] = useState('open');
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [attributableReps, setAttributableReps] = useState([]);

  const fetchOpenCount = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/team/flagged-assignments?status=open`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
      });
      const d = await r.json();
      if (r.ok && Array.isArray(d.flags) && onOpenCountChange) onOpenCountChange(d.flags.length);
    } catch {
      // non-fatal — badge just stays at its last known value
    }
  }, [onOpenCountChange]);

  const fetchFlags = useCallback(async (status) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/team/flagged-assignments?status=${status}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load flagged assignments');
      setFlags(Array.isArray(d.flags) ? d.flags : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags(statusFilter);
  }, [statusFilter, fetchFlags]);

  useEffect(() => {
    fetchOpenCount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function fetchReps() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/team`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        });
        const d = await r.json();
        if (r.ok && Array.isArray(d)) {
          setAttributableReps(d.filter(m => m.is_attributable && m.active));
        }
      } catch {
        // non-fatal — the assign dropdown just stays empty
      }
    }
    fetchReps();
  }, []);

  async function handleAssign(flagId, repId) {
    setActionLoadingId(flagId);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/team/flagged-assignments/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        body: JSON.stringify({ action: 'assign', rep_id: repId }),
      });
      if (!r.ok) return false;
      setFlags(prev => prev.filter(f => f.id !== flagId));
      fetchOpenCount();
      return true;
    } catch {
      return false;
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDismiss(flagId, note) {
    setActionLoadingId(flagId);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/team/flagged-assignments/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
        body: JSON.stringify({ action: 'dismiss', note: note || undefined }),
      });
      if (!r.ok) return false;
      setFlags(prev => prev.filter(f => f.id !== flagId));
      fetchOpenCount();
      return true;
    } catch {
      return false;
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {STATUS_TABS.map(t => {
          const active = statusFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              style={{
                padding: '6px 14px', borderRadius: AD.radiusPill,
                border: `1px solid ${active ? AD.blueText : AD.border}`,
                background: active ? AD.blueBg : 'transparent',
                color: active ? AD.blueText : AD.textSecondary,
                fontSize: 13, fontWeight: active ? 500 : 400, fontFamily: AD.fontSans, cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {err && (
        <div style={{
          padding: '10px 14px', borderRadius: AD.radiusMd, marginBottom: 16,
          background: AD.red2Bg, border: `1px solid ${AD.red2}`,
          color: AD.red2Text, fontSize: 13, fontFamily: AD.fontSans,
        }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: AD.textTertiary }}>
          <i className="ph ph-circle-notch" style={{ fontSize: 22, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : flags.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', color: AD.textTertiary,
          fontFamily: AD.fontSans, fontSize: 14,
        }}>
          {statusFilter === 'open'
            ? 'No assignment conflicts — the system flags anything it can\'t resolve safely.'
            : `No ${statusFilter.replace('_', '-')} flags.`}
        </div>
      ) : (
        flags.map(flag => (
          <FlagCard
            key={flag.id}
            flag={flag}
            attributableReps={attributableReps}
            onAssign={handleAssign}
            onDismiss={handleDismiss}
            actionLoading={actionLoadingId === flag.id}
            historyMode={statusFilter !== 'open'}
          />
        ))
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
