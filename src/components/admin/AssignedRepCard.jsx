import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';

// ── WHO HOLDS THIS CLIENT, AND HOW TO CHANGE IT (Danny, 2026-09-22) ──────────
//
// Until this card existed, an admin could see an assignment only in the Flagged queue —
// which lists only clients carrying an open flag — so a contractor whose attribution went
// wrong had no recourse inside the product. This is that recourse, on the client's own
// record.
//
// ⚠ UNASSIGNED IS THE COMMON CASE AND MUST NOT READ AS AN ERROR. Measured on Accent
// 2026-09-22: 1,990 clients carry an approved quote by someone mapped to nobody, and they
// are correctly unassigned because nobody is mapped yet. The empty state says what is true
// and what to do about it — no warning colour, no exclamation.
//
// ⚠ LOCKED vs PROVISIONAL IS CONFIDENCE, NOT OWNERSHIP. A provisional client is fully in
// that rep's book (the book predicate is COALESCE(sticky, provisional)); the difference is
// whether anything has confirmed it. The copy says "can still change" rather than anything
// implying the rep does not really have them.

const STATE_STYLE = {
  locked:      { label: 'Locked',      bg: AD.greenBg, color: AD.greenText },
  provisional: { label: 'Provisional', bg: AD.bgCardTint, color: AD.textSecondary },
};

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AssignedRepCard({ assignment, jobberClientId, token, canAssign = true, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [reps, setReps] = useState([]);
  const [repsError, setRepsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  // The rep list comes from the same endpoint the Flagged queue uses, so there is one
  // source for "who can hold a client" rather than a second list that could drift.
  useEffect(() => {
    if (!editing || reps.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/team`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error('Could not load the team list');
        const data = await r.json();
        const list = (Array.isArray(data) ? data : data.members || [])
          .filter((m) => m.is_attributable && m.active !== false);
        if (!cancelled) setReps(list);
      } catch (e) {
        if (!cancelled) setRepsError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [editing, reps.length, token]);

  async function save(repId) {
    setSaving(true);
    setError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/team/client-assignment/${encodeURIComponent(jobberClientId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: repId }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'Could not change the assignment');
      }
      const data = await r.json();
      if (!mounted.current) return;
      setEditing(false);
      if (onChanged) onChanged(data.assignment || null);
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  const state = assignment ? STATE_STYLE[assignment.state] || STATE_STYLE.provisional : null;

  return (
    <div data-assigned-rep-card style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
        color: AD.textSecondary, fontFamily: AD.fontSans, marginBottom: 8 }}>
        Assigned rep
      </div>

      {assignment ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span data-rep-name style={{ fontSize: 14, color: AD.textPrimary, fontFamily: AD.fontSans, fontWeight: 600 }}>
              {assignment.rep_name || `Team member #${assignment.rep_id}`}
            </span>
            <span
              data-assignment-state={assignment.state}
              style={{ padding: '2px 8px', borderRadius: 4, background: state.bg, color: state.color,
                fontSize: 11, fontFamily: AD.fontSans, fontWeight: 600 }}
            >
              {state.label}
            </span>
            {assignment.rep_active === false && (
              <span style={{ fontSize: 11, color: AD.textSecondary, fontFamily: AD.fontSans }}>
                No longer active
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, marginTop: 4 }}>
            {assignment.source_label || 'Assigned'}
            {formatDate(assignment.set_at) ? ` · ${formatDate(assignment.set_at)}` : ''}
          </div>
          {assignment.state === 'provisional' && (
            <div style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, marginTop: 4 }}>
              This is the best match from the CRM and can still change.
            </div>
          )}
        </div>
      ) : (
        // ⚠ THE EMPTY STATE. Plain, and it explains itself: the engine assigns a rep when
        // the CRM names one, so "nobody yet" is a fact about the CRM, not a fault here.
        <div data-assignment-empty style={{ fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          Not assigned to a rep. A rep is assigned automatically when a request, quote or job
          in your CRM names one of your mapped team members.
        </div>
      )}

      {canAssign && !editing && (
        <button
          data-assign-open
          onClick={() => { setError(''); setEditing(true); }}
          style={{ marginTop: 10, padding: '6px 12px', borderRadius: AD.radiusMd,
            background: AD.bgCardTint, border: `1px solid ${AD.border}`, color: AD.textPrimary,
            fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer' }}
        >
          {assignment ? 'Change rep' : 'Assign a rep'}
        </button>
      )}

      {canAssign && editing && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {repsError && (
            <span style={{ fontSize: 12, color: AD.red2Text, fontFamily: AD.fontSans }}>{repsError}</span>
          )}
          {reps.map((m) => (
            <button
              key={m.id}
              data-assign-rep={m.id}
              disabled={saving}
              onClick={() => save(m.id)}
              style={{ padding: '6px 12px', borderRadius: AD.radiusMd, background: AD.bgCardTint,
                border: `1px solid ${AD.border}`, color: AD.textPrimary, fontSize: 12,
                fontFamily: AD.fontSans, cursor: saving ? 'default' : 'pointer' }}
            >
              {m.full_name || m.email}
            </button>
          ))}
          {assignment && (
            <button
              data-assign-clear
              disabled={saving}
              onClick={() => save(null)}
              style={{ padding: '6px 12px', borderRadius: AD.radiusMd, background: 'transparent',
                border: `1px solid ${AD.border}`, color: AD.textSecondary, fontSize: 12,
                fontFamily: AD.fontSans, cursor: saving ? 'default' : 'pointer' }}
            >
              Clear assignment
            </button>
          )}
          <button
            data-assign-cancel
            disabled={saving}
            onClick={() => setEditing(false)}
            style={{ padding: '6px 12px', borderRadius: AD.radiusMd, background: 'transparent',
              border: 'none', color: AD.textSecondary, fontSize: 12, fontFamily: AD.fontSans,
              cursor: saving ? 'default' : 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div data-assign-error style={{ marginTop: 8, fontSize: 12, color: AD.red2Text, fontFamily: AD.fontSans }}>
          {error}
        </div>
      )}
    </div>
  );
}
