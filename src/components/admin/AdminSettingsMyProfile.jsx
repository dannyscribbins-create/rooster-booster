import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { usePermissions } from '../../hooks/useAdminPermissions';

export default function AdminSettingsMyProfile() {
  const { full_name, email, tier } = usePermissions();

  const [titleId, setTitleId]               = useState(null);
  const [titleLoading, setTitleLoading]     = useState(true);
  const [titles, setTitles]                 = useState([]);
  const [saving, setSaving]                 = useState(false);
  const [saveMsg, setSaveMsg]               = useState(null); // { type: 'success'|'error', text: string }
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const saveMsgTimerRef                     = useRef(null);

  useEffect(() => {
    const token = sessionStorage.getItem('rb_admin_token');
    (async () => {
      try {
        const [meRes, titlesRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/admin/me`,     { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BACKEND_URL}/api/admin/titles`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (meRes.ok) {
          const me = await meRes.json();
          setTitleId(me.title_id ?? null);
        }
        if (titlesRes.ok) {
          setTitles(await titlesRes.json());
        }
      } catch {
        // swallow — fields remain at initial state
      } finally {
        setTitleLoading(false);
      }
    })();
    return () => { if (saveMsgTimerRef.current) clearTimeout(saveMsgTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTitleChange(e) {
    const newId = e.target.value ? parseInt(e.target.value, 10) : null;
    setTitleId(newId);
    setSaving(true);
    setSaveMsg(null);
    if (saveMsgTimerRef.current) clearTimeout(saveMsgTimerRef.current);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/me/title`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
        },
        body: JSON.stringify({ title_id: newId }),
      });
      if (r.ok) {
        setSaveMsg({ type: 'success', text: 'Title saved.' });
      } else {
        const d = await r.json().catch(() => ({}));
        setSaveMsg({
          type: 'error',
          text: d.error === 'invalid_title' ? 'Invalid title selection.' : 'Failed to save title.',
        });
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
      saveMsgTimerRef.current = setTimeout(() => setSaveMsg(null), 4000);
    }
  }

  const displayName = full_name || email || 'Team Member';
  const showNudge   = !titleLoading && titleId === null && !nudgeDismissed;

  const readonlyFieldStyle = {
    fontSize: 14, color: AD.textPrimary, fontFamily: AD.fontSans,
    padding: '8px 12px', background: AD.bgSurface,
    borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`,
  };

  return (
    <div style={{ maxWidth: 480 }}>

      {/* ── Identity — read-only ── */}
      <div style={{
        background: AD.bgCard, borderRadius: AD.radiusLg,
        border: `1px solid ${AD.border}`, padding: '24px 28px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: AD.textTertiary, marginBottom: 16 }}>
          Identity
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 4 }}>Name</div>
            <div style={readonlyFieldStyle}>{displayName}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 4 }}>Email</div>
            <div style={readonlyFieldStyle}>{email || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 4 }}>Role tier</div>
            <div style={{ ...readonlyFieldStyle, textTransform: 'capitalize' }}>{tier || '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Title self-select ── */}
      <div style={{
        background: AD.bgCard, borderRadius: AD.radiusLg,
        border: `1px solid ${AD.border}`, padding: '24px 28px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: AD.textTertiary, marginBottom: 16 }}>
          Title
        </div>

        {showNudge && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${AD.border}`,
            borderRadius: AD.radiusMd, padding: '10px 14px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ph ph-info" style={{ fontSize: 15, color: AD.blueLight, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
                Your title isn't set — choose one from the list below.
              </span>
            </div>
            <button
              onClick={() => setNudgeDismissed(true)}
              aria-label="Dismiss"
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', color: AD.textTertiary, fontSize: 16, lineHeight: 1, flexShrink: 0,
              }}
            >
              <i className="ph ph-x" />
            </button>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>
            Your title
          </label>
          {titleLoading ? (
            <div style={{ ...readonlyFieldStyle, color: AD.textTertiary }}>Loading…</div>
          ) : (
            <select
              value={titleId ?? ''}
              onChange={handleTitleChange}
              disabled={saving}
              style={{
                width: '100%', padding: '9px 12px',
                background: AD.bgCard, border: `1px solid ${AD.border}`,
                borderRadius: AD.radiusMd, fontFamily: AD.fontSans, fontSize: 14,
                color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <option value="">— None —</option>
              {titles.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {saveMsg && (
          <div style={{
            marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontFamily: AD.fontSans,
            color: saveMsg.type === 'success' ? '#4ade80' : '#f87171',
          }}>
            <i
              className={`ph ${saveMsg.type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'}`}
              style={{ fontSize: 15, flexShrink: 0 }}
            />
            {saveMsg.text}
          </div>
        )}
      </div>

    </div>
  );
}
