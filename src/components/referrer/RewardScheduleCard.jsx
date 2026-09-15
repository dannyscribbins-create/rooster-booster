import { useState, useEffect } from 'react';
import { statusVar, STATUS_BANNER, STATUS_TINT } from '../../constants/statusTheme';
import { elevationVar, fontVar } from '../../constants/elevationTheme';

// ─── PALETTE-6 — THE RENDER TOKENS THIS TAB PAINTS WITH ──────────────────────
// ⚠ EVERY FALLBACK IS THE VALUE THE PROVIDER ACTUALLY MOUNTS FOR THE PLATFORM
// BRAND IN LIGHT MODE (M.7). themeKeyIntegrity.test.js fails on any that disagrees.
const PRIMARY        = 'var(--rm-primary, #F26A1B)';
const PRIMARY_DARK   = 'var(--rm-primary-dark, #CE530C)';
const ON_PRIMARY     = 'var(--rm-on-primary, #000000)';
const SECONDARY      = 'var(--rm-secondary, #1C2D4D)';
const SECONDARY_DARK = 'var(--rm-secondary-dark, #0C1320)';
const ON_SECONDARY   = 'var(--rm-on-secondary, #FFFFFF)';
const SURFACE        = 'var(--rm-surface, #FFFFFF)';
const RECESS         = 'var(--rm-recess, #ECF0F8)';
const TEXT           = 'var(--rm-text, #1C2D4D)';

// The one muted alpha, shared with the files that already use this idiom.
// ⚠ AND ITS GROUND AND ITS PARENTS ARE BOTH CHECKED (M.5). Palette-5 found a
// money span nested inside a muted paragraph inheriting 0.72 down to 3.29:1 —
// every element's own declaration correct, the composited pair wrong. Nothing
// below puts a non-muted child inside a muted parent.
const MUTED = 0.72;

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
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${elevationVar('border')}` }}>
      <div style={{
        display: 'flex', padding: '8px 14px',
        background: RECESS, borderBottom: `1px solid ${elevationVar('border')}`,
      }}>
        <span style={{ flex: 1.4, fontSize: 11, color: TEXT, opacity: MUTED, fontFamily: fontVar('mono'), textTransform: 'uppercase', letterSpacing: '0.08em' }}>Referral #</span>
        <span style={{ flex: 1, fontSize: 11, color: TEXT, opacity: MUTED, fontFamily: fontVar('mono'), textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Your Bonus</span>
      </div>
      {steps.map((step, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', padding: '11px 14px',
          borderBottom: i < lastIndex ? `1px solid ${elevationVar('border')}` : 'none',
          background: 'transparent',
        }}>
          <span style={{ flex: 1.4, fontSize: 14, color: TEXT, fontFamily: fontVar('mono'), fontWeight: 600 }}>
            {i === lastIndex
              ? `${ordinal(step.referral_number)} referral & beyond`
              : `${ordinal(step.referral_number)} referral`}
          </span>
          {/* ⚠ TEXT TONE, NOT GREEN. A schedule row is what a future referral WOULD
              pay — the ruling's own example of a projection. Green is reserved for
              money in the account so that it keeps meaning that. */}
          <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: TEXT, fontFamily: fontVar('mono'), textAlign: 'right' }}>
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
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${elevationVar('border')}` }}>
      <div style={{
        display: 'flex', padding: '8px 14px',
        background: RECESS, borderBottom: `1px solid ${elevationVar('border')}`,
      }}>
        <span style={{ flex: 1.6, fontSize: 11, color: TEXT, opacity: MUTED, fontFamily: fontVar('mono'), textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invoice Total</span>
        <span style={{ flex: 1, fontSize: 11, color: TEXT, opacity: MUTED, fontFamily: fontVar('mono'), textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Your Bonus</span>
      </div>
      {brackets.map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', padding: '11px 14px',
          borderBottom: i < lastIndex ? `1px solid ${elevationVar('border')}` : 'none',
        }}>
          <span style={{ flex: 1.6, fontSize: 14, color: TEXT, fontFamily: fontVar('mono'), fontWeight: 500 }}>
            {b.max == null
              ? `${formatCurrency(b.min)} & above`
              : `${formatCurrency(b.min)} – ${formatCurrency(b.max)}`}
          </span>
          {/* ⚠ TEXT TONE, NOT GREEN. A schedule row is what a future referral WOULD
              pay — the ruling's own example of a projection. Green is reserved for
              money in the account so that it keeps meaning that. */}
          <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: TEXT, fontFamily: fontVar('mono'), textAlign: 'right' }}>
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
    <p style={{ margin: '10px 0 0', fontSize: 12, color: TEXT, opacity: MUTED, fontFamily: fontVar('body'), lineHeight: 1.5 }}>
      Qualifying jobs: {jobText}.{minText}
    </p>
  );
}

function ResetLine({ resetPeriod }) {
  if (resetPeriod === 'annual') {
    return (
      <p style={{ margin: '6px 0 0', fontSize: 12, color: TEXT, opacity: MUTED, fontFamily: fontVar('body') }}>
        Your referral count resets each year.
      </p>
    );
  }
  if (resetPeriod === 'lifetime') {
    return (
      <p style={{ margin: '6px 0 0', fontSize: 12, color: TEXT, opacity: MUTED, fontFamily: fontVar('body') }}>
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
        <p style={{ margin: '0 0 10px', fontSize: 15, color: TEXT, fontFamily: fontVar('body') }}>
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
        <p style={{ margin: '0 0 10px', fontSize: 15, color: TEXT, fontFamily: fontVar('body') }}>
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
        margin: '0 0 10px', fontSize: 12, color: TEXT, opacity: MUTED,
        fontFamily: fontVar('mono'), letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>Reward Schedule</p>

      <div style={{
        background: SURFACE, border: `1px solid ${elevationVar('border')}`,
        borderRadius: 16, overflow: 'hidden', boxShadow: elevationVar('shadow'),
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
          <p style={{ margin: 0, fontSize: 14, color: TEXT, opacity: MUTED, fontFamily: fontVar('body'), textAlign: 'center', padding: '12px 0' }}>
            No reward schedules available.
          </p>
        )}

        {!loading && schedules && schedules.length > 0 && (
          <>
            {/* Tabs — only shown when there are multiple schedules */}
            {schedules.length > 1 && (
              <div style={{
                display: 'flex', gap: 4, marginBottom: 16,
                borderBottom: `1px solid ${elevationVar('border')}`, paddingBottom: 0,
              }}>
                {schedules.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveTab(i)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '8px 14px 10px',
                      fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
                      fontFamily: fontVar('heading'),
                      color: TEXT,
                      opacity: activeTab === i ? 1 : MUTED,
                      borderBottom: activeTab === i ? `2px solid ${PRIMARY}` : '2px solid transparent',
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
