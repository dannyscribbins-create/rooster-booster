import { useState, useEffect, useCallback } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import ScheduleBuilderDrawer from './ScheduleBuilderDrawer';

const MODEL_PILL = {
  escalating: { label: 'Escalating', bg: AD.blueBg,     color: AD.blueText  },
  tiered:     { label: 'Tiered',     bg: 'rgba(45,139,95,0.15)',  color: '#7dd3aa' },
  flat:       { label: 'Flat',       bg: AD.bgCardTint,  color: AD.textSecondary },
  percentage: { label: 'Percentage', bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd' },
};

function ModelPill({ model }) {
  const pill = MODEL_PILL[model] || MODEL_PILL.flat;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: AD.radiusPill,
      background: pill.bg, color: pill.color,
      fontSize: 11, fontWeight: 600, fontFamily: AD.fontSans, letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {pill.label}
    </span>
  );
}

function JobTypeChip({ label }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: AD.radiusPill,
      background: AD.bgCardTint, color: AD.textSecondary,
      fontSize: 11, fontFamily: AD.fontSans, border: `1px solid ${AD.border}`,
    }}>
      {label}
    </span>
  );
}

function formatPayoutSummary(schedule) {
  const { payout_model } = schedule;

  if (payout_model === 'escalating') {
    const steps = schedule.escalating_steps;
    if (!Array.isArray(steps) || steps.length === 0) return 'Escalating — no steps configured';
    const parts = steps.map(s => {
      const amt = `$${Number(s.payout_amount).toLocaleString()}`;
      return s.is_catch_all ? `${amt}+` : amt;
    });
    return `${parts.join(' → ')} per referral (resets annually)`;
  }

  if (payout_model === 'tiered') {
    const brackets = schedule.tier_brackets;
    if (!Array.isArray(brackets) || brackets.length === 0) return 'Tiered — no brackets configured';
    const parts = brackets.map(b => {
      const amt = `$${Number(b.payout_amount).toLocaleString()}`;
      const range = b.max == null
        ? `$${Number(b.min).toLocaleString()}+`
        : `$${Number(b.min).toLocaleString()}–$${Number(b.max).toLocaleString()}`;
      return `${amt} for ${range}`;
    });
    return parts.join(' · ');
  }

  if (payout_model === 'flat') {
    if (schedule.flat_amount == null) return 'Flat — no amount configured';
    return `$${Number(schedule.flat_amount).toLocaleString()} flat per referral`;
  }

  if (payout_model === 'percentage') {
    if (schedule.percentage_rate == null) return 'Percentage — no rate configured';
    const capStr = schedule.percentage_max_cap != null
      ? `, capped at $${Number(schedule.percentage_max_cap).toLocaleString()}`
      : ', no cap';
    return `${Number(schedule.percentage_rate)}% of invoice total${capStr}`;
  }

  return '';
}

function ScheduleCard({ schedule, onEdit, onToggle, dimmed }) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    await onToggle(schedule.id, !schedule.is_active);
    setToggling(false);
  }

  return (
    <div style={{
      background: AD.bgCard, borderRadius: AD.radiusLg, border: `1px solid ${AD.border}`,
      padding: '20px 24px', opacity: dimmed ? 0.5 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

        {/* Left: info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
              {schedule.name}
            </span>
            <ModelPill model={schedule.payout_model} />
          </div>

          {schedule.job_types?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {schedule.job_types.map(jt => <JobTypeChip key={jt} label={jt} />)}
            </div>
          )}

          {schedule.minimum_invoice && (
            <div style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
              Min invoice: ${Number(schedule.minimum_invoice).toLocaleString()}
            </div>
          )}

          {(() => {
            const summary = formatPayoutSummary(schedule);
            if (!summary) return null;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
                <i className="ph ph-receipt" style={{ fontSize: 13, flexShrink: 0 }} />
                {summary}
              </div>
            );
          })()}
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={onEdit}
            style={{
              padding: '6px 14px', borderRadius: AD.radiusMd,
              background: 'transparent', border: `1px solid ${AD.borderStrong}`,
              color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <i className="ph ph-pencil" style={{ fontSize: 13 }} />
            Edit
          </button>

          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={schedule.is_active ? 'Deactivate' : 'Activate'}
            style={{
              width: 40, height: 22, borderRadius: 11,
              background: schedule.is_active ? AD.blueText : AD.bgCardTint,
              border: `1px solid ${schedule.is_active ? AD.blueText : AD.border}`,
              cursor: toggling ? 'not-allowed' : 'pointer',
              position: 'relative', flexShrink: 0, transition: 'background 0.2s, border-color 0.2s',
              padding: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2,
              left: schedule.is_active ? 20 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReferralProgramSettings() {
  const [schedules, setSchedules]             = useState([]);
  const [allLabels, setAllLabels]             = useState([]);
  const [unassignedLabels, setUnassignedLabels] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [drawerOpen, setDrawerOpen]           = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null); // null = create mode

  const loadSchedules = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/schedules`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setSchedules(data.schedules || []);
      setAllLabels(data.all_labels || []);
      setUnassignedLabels(data.unassigned_labels || []);
    } catch {
      // errors displayed inline via loading state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(id, newActive) {
    // Optimistic update
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: newActive } : s));
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/schedules/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
        },
        body: JSON.stringify({ is_active: newActive }),
      });
      if (!res.ok) {
        // Revert on failure
        setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !newActive } : s));
      }
    } catch {
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !newActive } : s));
    }
  }

  function handleEdit(schedule) {
    setEditingSchedule(schedule);
    setDrawerOpen(true);
  }

  function handleAdd() {
    setEditingSchedule(null);
    setDrawerOpen(true);
  }

  async function handleSave(savedSchedule) {
    setDrawerOpen(false);
    setEditingSchedule(null);
    await loadSchedules();
    // brief highlight could be added here if needed
  }

  const activeSchedules   = schedules.filter(s => s.is_active);
  const inactiveSchedules = schedules.filter(s => !s.is_active);

  return (
    <div style={{ maxWidth: 760 }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>
            {loading ? '…' : `${activeSchedules.length} active schedule${activeSchedules.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={handleAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 20px', borderRadius: AD.radiusMd,
            background: AD.navy, border: `1px solid rgba(255,255,255,0.15)`,
            color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
            cursor: 'pointer',
          }}
        >
          <i className="ph ph-plus" style={{ fontSize: 15 }} />
          Add Schedule
        </button>
      </div>

      {/* ── Unassigned labels warning ── */}
      {unassignedLabels.length > 0 && (
        <div style={{
          marginBottom: 24, padding: '12px 16px', borderRadius: AD.radiusMd,
          background: AD.amberBg, border: `1px solid rgba(217,119,6,0.3)`,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <i className="ph ph-warning" style={{ fontSize: 18, color: AD.amberText, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
            Some job types from Jobber aren't assigned to any schedule:{' '}
            <strong>{unassignedLabels.join(', ')}</strong>.{' '}
            Referrals for these job types won't qualify for a bonus.
          </p>
        </div>
      )}

      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 14 }}>
          Loading schedules…
        </div>
      )}

      {!loading && schedules.length === 0 && (
        <div style={{
          padding: '48px 32px', textAlign: 'center',
          background: AD.bgCard, borderRadius: AD.radiusLg, border: `1px solid ${AD.border}`,
        }}>
          <i className="ph ph-calendar-blank" style={{ fontSize: 40, color: AD.textTertiary }} />
          <p style={{ margin: '12px 0 0', fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>
            No schedules yet. Add one to start awarding referral bonuses.
          </p>
        </div>
      )}

      {/* ── Active schedules ── */}
      {activeSchedules.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans, marginBottom: 12 }}>
            Active
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeSchedules.map(s => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                dimmed={false}
                onEdit={() => handleEdit(s)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Inactive schedules ── */}
      {inactiveSchedules.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans, marginBottom: 12 }}>
            Inactive
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inactiveSchedules.map(s => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                dimmed={true}
                onEdit={() => handleEdit(s)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Drawer ── */}
      {drawerOpen && (
        <ScheduleBuilderDrawer
          schedule={editingSchedule}
          allLabels={allLabels}
          onSave={handleSave}
          onClose={() => { setDrawerOpen(false); setEditingSchedule(null); }}
        />
      )}
    </div>
  );
}
