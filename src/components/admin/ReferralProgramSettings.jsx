import { useState, useEffect, useCallback } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import ScheduleBuilderDrawer from './ScheduleBuilderDrawer';
import { getAdminToken } from '../../utils/authStorage';

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
  // ⚠ THE CATEGORY FIELD'S LABEL, ONLY SO A WARNING CAN NAME IT (7c-0). It is display text,
  // never an identity: the mapping is being moved onto entity + CRM id in 7c-1.
  const [categoryFieldLabel, setCategoryFieldLabel] = useState(null);
  // 7c-3 — the DEFAULT schedule. `null` is "No bonus", which is the state every contractor starts
  // in by Danny's ruling, so it is a real chosen option rather than an empty control.
  const [defaultScheduleId, setDefaultScheduleId] = useState(null);
  const [savingDefault, setSavingDefault]         = useState(false);
  const [defaultError, setDefaultError]           = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [drawerOpen, setDrawerOpen]           = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null); // null = create mode

  const loadSchedules = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/schedules`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setSchedules(data.schedules || []);
      setDefaultScheduleId(data.default_schedule_id ?? null);
      setAllLabels(data.all_labels || []);
      setUnassignedLabels(data.unassigned_labels || []);
      setCategoryFieldLabel(data.category_field_label || null);
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
          Authorization: `Bearer ${getAdminToken()}`,
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

  // ── 7c-3 — CHOOSE THE DEFAULT SCHEDULE ──────────────────────────────────────
  // ⚠ NOT OPTIMISTIC, UNLIKE THE TOGGLE ABOVE, AND THAT IS DELIBERATE. This control decides what
  // an unmapped or blank category PAYS. Showing a change that did not persist would tell a
  // contractor their fallback is one schedule while the engine uses another — so the value only
  // moves once the server has confirmed it, and a failure says so instead of reverting quietly.
  async function handleDefaultChange(nextValue) {
    setSavingDefault(true);
    setDefaultError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/schedules/default`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({ default_schedule_id: nextValue }),
      });
      if (!res.ok) {
        setDefaultError('Could not save the default. Nothing was changed.');
        return;
      }
      const data = await res.json();
      setDefaultScheduleId(data.default_schedule_id ?? null);
    } catch {
      setDefaultError('Could not save the default. Nothing was changed.');
    } finally {
      setSavingDefault(false);
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

  // ⚠ READ STRAIGHT FROM THE SERVER'S VERDICT, NEVER RECOMPUTED HERE (7c-0). The server owns this
  // for every SAVED schedule — `unmatched_job_types` comes from the one shared matcher in
  // server/utils/categoryMatch.js — and recomputing it in the client would be a second definition
  // of exactly the rule 7c-0 exists to unify. It is also already gated by `options_known` there, so
  // an absent field or an unrun discovery arrives as an empty array rather than as every key.
  const schedulesWithBrokenKeys = schedules.filter(
    s => Array.isArray(s.unmatched_job_types) && s.unmatched_job_types.length > 0
  );

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

      {/* ── THE INVERSE GUARDRAIL (7c-0) ──
          A schedule whose qualifying value matches NO option in the mapped Jobber field can never
          fire. ⚠ IT IS THE DANGEROUS DIRECTION, and it is the opposite of the warning below: that
          one says "this option earns nothing", this one says "this schedule pays nobody". The
          engine's refusal is silent — no row, no flag, no email — so the admin panel is the only
          place it can surface.
          ⚠ THE CHECK ITSELF IS NOT NEW. ScheduleBuilderDrawer's Step 2 has always rendered it as
          amber "not in Jobber fields" pills. What is new is that it is visible WITHOUT opening each
          schedule, and that the verdict is computed once on the server rather than three ways.
          ⚠ `options_known` GATES IT: with no mapped field or no discovery run, nothing is known
          about which options exist, and flagging every key would be a wall of false alarms on the
          setup where the admin can do least about it. Unknown is not wrong. */}
      {schedulesWithBrokenKeys.length > 0 && (
        <div style={{
          marginBottom: 24, padding: '12px 16px', borderRadius: AD.radiusMd,
          background: AD.amberBg, border: `1px solid rgba(217,119,6,0.3)`,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <i className="ph ph-warning-octagon" style={{ fontSize: 18, color: AD.amberText, flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: AD.amberText, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
              {schedulesWithBrokenKeys.length === 1
                ? 'One schedule has a qualifying option that no longer exists in Jobber.'
                : `${schedulesWithBrokenKeys.length} schedules have qualifying options that no longer exist in Jobber.`}
            </p>
            {schedulesWithBrokenKeys.map(s => (
              <p key={s.id} style={{ margin: '0 0 4px', fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
                <strong>{s.name}</strong>:{' '}
                {s.unmatched_job_types.length === 1
                  ? '1 qualifying option no longer exists'
                  : `${s.unmatched_job_types.length} qualifying options no longer exist`}
                {' — '}
                {/* ⚠ QUOTED so a trailing space is visible. Two of Accent's own Jobber options carry
                    one, and a bare value would make an admin hunt for a difference they cannot see. */}
                {s.unmatched_job_types.map(v => `"${v}"`).join(', ')}
              </p>
            ))}
            <p style={{ margin: '4px 0 0', fontSize: 12, color: AD.amberText, opacity: 0.85, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
              Referrals matching only those options pay nothing. Open the schedule and re-pick from
              the current Jobber options{categoryFieldLabel ? ` in "${categoryFieldLabel}"` : ''}.
            </p>
          </div>
        </div>
      )}

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

      {/* ── 7c-3 — THE DEFAULT SCHEDULE ──────────────────────────────────────
          Danny's ruling: each contractor has a DEFAULT schedule used when a job's category value
          is blank, absent at every stage, or not mapped to any schedule. It starts as "No bonus"
          until the contractor picks one. Unmapped and blank values never silently pay on a
          schedule nobody chose.
          ⚠ RENDERED EVEN WITH NO SCHEDULES YET, because "No bonus" is a real answer and the
          contractor should be able to see what happens today before they build anything. The
          select simply has one option until they add a schedule.
          ⚠ THE COPY NAMES ALL THREE TRIGGERS EXPLICITLY. "When a job has no category" would cover
          only one of them, and the unmapped case is the one that actually surprises people — a new
          option added in Jobber and never assigned. */}
      {!loading && (
        <div
          data-default-schedule-card
          style={{
            marginBottom: 24, padding: '16px 18px', borderRadius: AD.radiusLg,
            background: AD.bgCard, border: `1px solid ${AD.border}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
            Default schedule
          </div>
          <p style={{ margin: '6px 0 12px', fontSize: 13, lineHeight: 1.5, color: AD.textSecondary, fontFamily: AD.fontSans }}>
            Used when a job&rsquo;s category is blank, missing, or set to an option you
            haven&rsquo;t assigned to any schedule. Leave it on <strong>No bonus</strong> and those
            jobs earn nothing.
          </p>
          <label
            htmlFor="default-schedule-select"
            style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans, marginBottom: 6 }}
          >
            Applies when nothing matches
          </label>
          <select
            id="default-schedule-select"
            value={defaultScheduleId === null ? '' : String(defaultScheduleId)}
            disabled={savingDefault}
            onChange={e => handleDefaultChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
            style={{
              padding: '8px 10px', fontSize: 14, borderRadius: AD.radiusMd,
              border: `1px solid ${AD.border}`, background: AD.bgCard,
              color: AD.textPrimary, fontFamily: AD.fontSans, minWidth: 260,
            }}
          >
            <option value="">No bonus</option>
            {activeSchedules.map(s => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
          {savingDefault && (
            <span style={{ marginLeft: 10, fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
              Saving…
            </span>
          )}
          {defaultError && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: AD.red2Text, fontFamily: AD.fontSans }}>
              {defaultError}
            </p>
          )}
          {/* ⚠ ONLY ACTIVE SCHEDULES ARE OFFERED, matching the server's own check. A retired
              schedule as the default would pay on the fallback path while this screen showed it as
              inactive — a state nothing on the surface would explain. */}
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
