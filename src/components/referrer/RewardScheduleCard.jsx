import { useState, useEffect } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import Skeleton from '../shared/Skeleton';

function ordinal(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function formatCurrency(val) {
  if (val == null) return '';
  return `$${Number(val).toLocaleString()}`;
}

function EscalatingTable({ steps }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const lastIndex = steps.length - 1;
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${R.border}` }}>
      <div style={{
        display: 'flex', padding: '8px 14px',
        background: R.bgCardTint, borderBottom: `1px solid ${R.border}`,
      }}>
        <span style={{ flex: 1.4, fontSize: 11, color: R.textMuted, fontFamily: R.fontMono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Referral #</span>
        <span style={{ flex: 1, fontSize: 11, color: R.textMuted, fontFamily: R.fontMono, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Your Bonus</span>
      </div>
      {steps.map((step, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', padding: '11px 14px',
          borderBottom: i < lastIndex ? `1px solid ${R.border}` : 'none',
          background: 'transparent',
        }}>
          <span style={{ flex: 1.4, fontSize: 14, color: R.textPrimary, fontFamily: R.fontMono, fontWeight: 600 }}>
            {i === lastIndex
              ? `${ordinal(step.referral_number)} referral & beyond`
              : `${ordinal(step.referral_number)} referral`}
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: R.red, fontFamily: R.fontMono, textAlign: 'right' }}>
            {formatCurrency(step.payout_amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TieredTable({ brackets }) {
  if (!Array.isArray(brackets) || brackets.length === 0) return null;
  const lastIndex = brackets.length - 1;
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${R.border}` }}>
      <div style={{
        display: 'flex', padding: '8px 14px',
        background: R.bgCardTint, borderBottom: `1px solid ${R.border}`,
      }}>
        <span style={{ flex: 1.6, fontSize: 11, color: R.textMuted, fontFamily: R.fontMono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invoice Total</span>
        <span style={{ flex: 1, fontSize: 11, color: R.textMuted, fontFamily: R.fontMono, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Your Bonus</span>
      </div>
      {brackets.map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', padding: '11px 14px',
          borderBottom: i < lastIndex ? `1px solid ${R.border}` : 'none',
        }}>
          <span style={{ flex: 1.6, fontSize: 14, color: R.textPrimary, fontFamily: R.fontMono, fontWeight: 500 }}>
            {b.max == null
              ? `${formatCurrency(b.min)} & above`
              : `${formatCurrency(b.min)} – ${formatCurrency(b.max)}`}
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: R.red, fontFamily: R.fontMono, textAlign: 'right' }}>
            {formatCurrency(b.payout_amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

function QualifyingLine({ schedule }) {
  const labels = Array.isArray(schedule.job_type_labels) ? schedule.job_type_labels : [];
  const jobText = labels.join(', ');
  const minText = schedule.minimum_invoice != null
    ? ` Minimum invoice: ${formatCurrency(schedule.minimum_invoice)}.`
    : '';
  if (!jobText) return null;
  return (
    <p style={{ margin: '10px 0 0', fontSize: 12, color: R.textMuted, fontFamily: R.fontBody, lineHeight: 1.5 }}>
      Qualifying jobs: {jobText}.{minText}
    </p>
  );
}

function ResetLine({ resetPeriod }) {
  if (resetPeriod === 'annual') {
    return (
      <p style={{ margin: '6px 0 0', fontSize: 12, color: R.textMuted, fontFamily: R.fontBody }}>
        Your referral count resets each year.
      </p>
    );
  }
  if (resetPeriod === 'lifetime') {
    return (
      <p style={{ margin: '6px 0 0', fontSize: 12, color: R.textMuted, fontFamily: R.fontBody }}>
        Your referral count never resets.
      </p>
    );
  }
  return null;
}

function SchedulePane({ schedule }) {
  const { payout_model } = schedule;

  if (payout_model === 'escalating') {
    return (
      <>
        <EscalatingTable steps={schedule.escalating_steps} />
        <QualifyingLine schedule={schedule} />
        <ResetLine resetPeriod={schedule.reset_period} />
      </>
    );
  }
  if (payout_model === 'tiered') {
    return (
      <>
        <TieredTable brackets={schedule.tier_brackets} />
        <QualifyingLine schedule={schedule} />
      </>
    );
  }
  if (payout_model === 'flat') {
    return (
      <>
        <p style={{ margin: '0 0 10px', fontSize: 15, color: R.textPrimary, fontFamily: R.fontBody }}>
          Earn {formatCurrency(schedule.flat_amount)} for every qualifying referral.
        </p>
        <QualifyingLine schedule={schedule} />
      </>
    );
  }
  if (payout_model === 'percentage') {
    const capText = schedule.percentage_max_cap != null
      ? `, up to ${formatCurrency(schedule.percentage_max_cap)}`
      : '';
    const rate = schedule.percentage_rate != null
      ? `${Number(schedule.percentage_rate)}%`
      : '';
    return (
      <>
        <p style={{ margin: '0 0 10px', fontSize: 15, color: R.textPrimary, fontFamily: R.fontBody }}>
          Earn {rate} of the final invoice total{capText}.
        </p>
        <QualifyingLine schedule={schedule} />
      </>
    );
  }
  return null;
}

export default function RewardScheduleCard({ sessionToken }) {
  const [schedules, setSchedules] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!sessionToken) return;
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/referrer/schedules`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const data = await r.json();
        if (Array.isArray(data.schedules)) setSchedules(data.schedules);
      } catch {
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <p style={{
        margin: '0 0 10px', fontSize: 12, color: R.textMuted,
        fontFamily: R.fontMono, letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>Reward Schedule</p>

      <div style={{
        background: R.bgCard, border: `1px solid ${R.border}`,
        borderRadius: 16, overflow: 'hidden', boxShadow: R.shadow,
        padding: '16px',
      }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height="36px" borderRadius="8px" />
            <Skeleton height="140px" borderRadius="8px" />
            <Skeleton width="70%" height="14px" borderRadius="6px" />
          </div>
        )}

        {!loading && (!schedules || schedules.length === 0) && (
          <p style={{ margin: 0, fontSize: 14, color: R.textMuted, fontFamily: R.fontBody, textAlign: 'center', padding: '12px 0' }}>
            No reward schedules available.
          </p>
        )}

        {!loading && schedules && schedules.length > 0 && (
          <>
            {/* Tabs — only shown when there are multiple schedules */}
            {schedules.length > 1 && (
              <div style={{
                display: 'flex', gap: 4, marginBottom: 16,
                borderBottom: `1px solid ${R.border}`, paddingBottom: 0,
              }}>
                {schedules.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveTab(i)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '8px 14px 10px',
                      fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
                      fontFamily: R.fontSans,
                      color: activeTab === i ? R.navy : R.textMuted,
                      borderBottom: activeTab === i ? `2px solid ${R.red}` : '2px solid transparent',
                      marginBottom: -1,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            <SchedulePane schedule={schedules[activeTab]} />
          </>
        )}
      </div>
    </div>
  );
}
