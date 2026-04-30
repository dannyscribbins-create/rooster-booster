import { useState } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';

const MODELS = [
  {
    id: 'escalating',
    icon: 'ph-trend-up',
    label: 'Escalating',
    desc: 'Bonus increases with each referral. Resets annually.',
  },
  {
    id: 'tiered',
    icon: 'ph-stack',
    label: 'Tiered',
    desc: 'Bonus based on invoice amount brackets. No reset.',
  },
  {
    id: 'flat',
    icon: 'ph-equals',
    label: 'Flat',
    desc: 'Same bonus for every qualifying referral.',
  },
  {
    id: 'percentage',
    icon: 'ph-percent',
    label: 'Percentage',
    desc: 'Referrer earns a percentage of the invoice total.',
  },
];

const WINDOW_OPTIONS = [20, 30, 45, 60];

function StepIndicator({ current, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: done ? AD.blueText : active ? AD.navy : AD.bgCardTint,
              border: `2px solid ${done ? AD.blueText : active ? AD.blueText : AD.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: done ? AD.bgCard : active ? AD.blueLight : AD.textTertiary,
              fontFamily: AD.fontSans, flexShrink: 0,
            }}>
              {done ? <i className="ph ph-check" style={{ fontSize: 12 }} /> : step}
            </div>
            {step < total && (
              <div style={{ width: 20, height: 2, background: done ? AD.blueText : AD.border, borderRadius: 1 }} />
            )}
          </div>
        );
      })}
      <span style={{ marginLeft: 8, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
        Step {current} of {total}
      </span>
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: AD.textSecondary, fontFamily: AD.fontSans, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {children}{required && <span style={{ color: AD.red2Text, marginLeft: 3 }}>*</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', style = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '9px 12px', borderRadius: AD.radiusMd,
        background: AD.bgCardTint, border: `1px solid ${AD.borderStrong}`,
        color: AD.textPrimary, fontSize: 14, fontFamily: AD.fontSans,
        outline: 'none', ...style,
      }}
    />
  );
}

function DollarInput({ value, onChange, placeholder = '0', style = {} }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: AD.textSecondary, fontSize: 14, fontFamily: AD.fontSans, pointerEvents: 'none' }}>$</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '9px 12px 9px 22px', borderRadius: AD.radiusMd,
          background: AD.bgCardTint, border: `1px solid ${AD.borderStrong}`,
          color: AD.textPrimary, fontSize: 14, fontFamily: AD.fontSans,
          outline: 'none', ...style,
        }}
      />
    </div>
  );
}

// ── Step 1: Name & Type ────────────────────────────────────────────────────────
function Step1({ form, setForm }) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <FieldLabel required>Schedule Name</FieldLabel>
        <TextInput
          value={form.name}
          onChange={v => setForm(p => ({ ...p, name: v }))}
          placeholder="e.g. Full Roof Replacement"
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <FieldLabel required>Payout Model</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {MODELS.map(m => {
            const selected = form.payout_model === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setForm(p => ({ ...p, payout_model: m.id }))}
                style={{
                  padding: '14px 16px', borderRadius: AD.radiusMd, textAlign: 'left',
                  background: selected ? 'rgba(147,197,253,0.08)' : AD.bgCardTint,
                  border: `2px solid ${selected ? AD.blueText : AD.border}`,
                  cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <i className={`ph ${m.icon}`} style={{ fontSize: 18, color: selected ? AD.blueText : AD.textSecondary }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: selected ? AD.textPrimary : AD.textSecondary, fontFamily: AD.fontSans }}>{m.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.4 }}>{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FieldLabel>Active on save</FieldLabel>
        <button
          onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
          style={{
            width: 40, height: 22, borderRadius: 11, flexShrink: 0,
            background: form.is_active ? AD.blueText : AD.bgCardTint,
            border: `1px solid ${form.is_active ? AD.blueText : AD.border}`,
            cursor: 'pointer', position: 'relative', padding: 0,
            transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: form.is_active ? 20 : 2,
            width: 16, height: 16, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s',
          }} />
        </button>
        <span style={{ fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          {form.is_active ? 'Will activate immediately' : 'Save as draft'}
        </span>
      </div>
    </div>
  );
}

// ── Step 2: Job Type Mapping ───────────────────────────────────────────────────
function Step2({ form, setForm, allLabels }) {
  const selected = new Set(form.job_types);

  function toggle(label) {
    setForm(p => {
      const next = new Set(p.job_types);
      if (next.has(label)) next.delete(label); else next.add(label);
      return { ...p, job_types: [...next] };
    });
  }

  const qualifying    = allLabels.filter(l => selected.has(l));
  const notQualifying = allLabels.filter(l => !selected.has(l));

  // Labels not in allLabels but in form (from existing schedule with unknown labels)
  const extraSelected = form.job_types.filter(l => !allLabels.includes(l));

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
        Select which Jobber job types qualify for this schedule. At least one is required.
      </p>

      {allLabels.length === 0 && (
        <div style={{ padding: '16px', borderRadius: AD.radiusMd, background: AD.amberBg, border: `1px solid rgba(217,119,6,0.3)`, marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans }}>
            No job types discovered yet — connect Jobber or add labels manually below.
          </p>
        </div>
      )}

      {qualifying.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.blueText, fontFamily: AD.fontSans, marginBottom: 8 }}>Qualifying</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {qualifying.map(l => (
              <button key={l} onClick={() => toggle(l)} style={{
                padding: '5px 12px', borderRadius: AD.radiusPill,
                background: 'rgba(147,197,253,0.12)', border: `1px solid ${AD.blueText}`,
                color: AD.blueText, fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <i className="ph ph-check" style={{ fontSize: 11 }} />
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {notQualifying.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans, marginBottom: 8 }}>Not Qualifying</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {notQualifying.map(l => (
              <button key={l} onClick={() => toggle(l)} style={{
                padding: '5px 12px', borderRadius: AD.radiusPill,
                background: AD.bgCardTint, border: `1px solid ${AD.border}`,
                color: AD.textSecondary, fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
              }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {extraSelected.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: AD.amberText, fontFamily: AD.fontSans, marginBottom: 8 }}>Currently Assigned (not in Jobber fields)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {extraSelected.map(l => (
              <button key={l} onClick={() => toggle(l)} style={{
                padding: '5px 12px', borderRadius: AD.radiusPill,
                background: AD.amberBg, border: `1px solid rgba(217,119,6,0.3)`,
                color: AD.amberText, fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <i className="ph ph-check" style={{ fontSize: 11 }} />
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Qualifying Threshold ──────────────────────────────────────────────
function Step3({ form, setForm }) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <FieldLabel>Minimum Invoice Amount</FieldLabel>
        <DollarInput
          value={form.minimum_invoice}
          onChange={v => setForm(p => ({ ...p, minimum_invoice: v }))}
          placeholder="No minimum"
        />
        <p style={{ margin: '8px 0 0', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          {form.minimum_invoice
            ? `Referrals only qualify on jobs invoiced above $${Number(form.minimum_invoice).toLocaleString()}`
            : 'No minimum — all invoice amounts qualify'}
        </p>
      </div>

      <div>
        <FieldLabel>Invoice Grouping Window</FieldLabel>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          How many days of invoices are grouped together to determine the total job value.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {WINDOW_OPTIONS.map(days => {
            const active = Number(form.invoice_window_days) === days;
            return (
              <button
                key={days}
                onClick={() => setForm(p => ({ ...p, invoice_window_days: days }))}
                style={{
                  padding: '8px 16px', borderRadius: AD.radiusMd,
                  background: active ? 'rgba(147,197,253,0.08)' : AD.bgCardTint,
                  border: `2px solid ${active ? AD.blueText : AD.border}`,
                  color: active ? AD.blueText : AD.textSecondary,
                  fontSize: 13, fontFamily: AD.fontSans, cursor: 'pointer',
                  fontWeight: active ? 600 : 400, transition: 'all 0.15s',
                }}
              >
                {days} days
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Payout Configuration ──────────────────────────────────────────────

function EscalatingConfig({ form, setForm }) {
  const steps = form.escalating_steps || [
    { referral_number: 1, payout_amount: '', is_catch_all: false },
    { referral_number: 2, payout_amount: '', is_catch_all: false },
  ];

  function update(idx, field, value) {
    setForm(p => {
      const next = (p.escalating_steps || steps).map((s, i) => i === idx ? { ...s, [field]: value } : s);
      return { ...p, escalating_steps: next };
    });
  }

  function addRow() {
    setForm(p => {
      const prev = p.escalating_steps || steps;
      const nextNum = prev.length + 1;
      return { ...p, escalating_steps: [...prev, { referral_number: nextNum, payout_amount: '', is_catch_all: false }] };
    });
  }

  function removeRow(idx) {
    setForm(p => {
      const next = (p.escalating_steps || steps).filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, referral_number: i + 1, is_catch_all: false }));
      return { ...p, escalating_steps: next };
    });
  }

  const rows = form.escalating_steps || steps;
  const lastIdx = rows.length - 1;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 36px', gap: '6px 8px', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Referral #</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bonus Amount</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Catch-all</div>
        <div />
      </div>

      {rows.map((row, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 36px', gap: '6px 8px', alignItems: 'center', marginBottom: 6 }}>
          <div style={{
            padding: '9px 10px', background: AD.bgCardTint, borderRadius: AD.radiusMd,
            border: `1px solid ${AD.border}`, fontSize: 13, color: AD.textSecondary,
            fontFamily: AD.fontSans, textAlign: 'center',
          }}>
            {row.is_catch_all ? `${row.referral_number}+` : row.referral_number}
          </div>
          <DollarInput
            value={row.payout_amount}
            onChange={v => update(idx, 'payout_amount', v)}
          />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {idx === lastIdx && (
              <input
                type="checkbox"
                checked={!!row.is_catch_all}
                onChange={e => update(idx, 'is_catch_all', e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: AD.blueText }}
              />
            )}
          </div>
          <button
            onClick={() => removeRow(idx)}
            disabled={rows.length <= 2}
            style={{
              width: 28, height: 28, borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`,
              background: 'transparent', cursor: rows.length <= 2 ? 'not-allowed' : 'pointer',
              color: rows.length <= 2 ? AD.textTertiary : AD.red2Text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, padding: 0,
            }}
          >
            <i className="ph ph-x" />
          </button>
        </div>
      ))}

      <button
        onClick={addRow}
        style={{
          marginTop: 8, padding: '7px 14px', borderRadius: AD.radiusMd,
          background: 'transparent', border: `1px dashed ${AD.borderStrong}`,
          color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        <i className="ph ph-plus" style={{ fontSize: 13 }} />
        Add Row
      </button>
    </div>
  );
}

function TieredConfig({ form, setForm }) {
  const brackets = form.tier_brackets || [
    { min: '', max: '', payout_amount: '' },
  ];

  function update(idx, field, value) {
    setForm(p => {
      const next = (p.tier_brackets || brackets).map((b, i) => i === idx ? { ...b, [field]: value } : b);
      return { ...p, tier_brackets: next };
    });
  }

  function addBracket() {
    setForm(p => {
      const prev = p.tier_brackets || brackets;
      return { ...p, tier_brackets: [...prev, { min: '', max: '', payout_amount: '' }] };
    });
  }

  function removeBracket(idx) {
    setForm(p => {
      const next = (p.tier_brackets || brackets).filter((_, i) => i !== idx);
      return { ...p, tier_brackets: next.length ? next : [{ min: '', max: '', payout_amount: '' }] };
    });
  }

  const rows = form.tier_brackets || brackets;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: '6px 8px', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Min Invoice</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Max Invoice</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bonus</div>
        <div />
      </div>

      {rows.map((row, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: '6px 8px', alignItems: 'center', marginBottom: 6 }}>
          <DollarInput value={row.min} onChange={v => update(idx, 'min', v)} placeholder="0" />
          <DollarInput value={row.max ?? ''} onChange={v => update(idx, 'max', v)} placeholder="and above" />
          <DollarInput value={row.payout_amount} onChange={v => update(idx, 'payout_amount', v)} />
          <button
            onClick={() => removeBracket(idx)}
            disabled={rows.length <= 1}
            style={{
              width: 28, height: 28, borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`,
              background: 'transparent', cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
              color: rows.length <= 1 ? AD.textTertiary : AD.red2Text,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, padding: 0,
            }}
          >
            <i className="ph ph-x" />
          </button>
        </div>
      ))}

      <button
        onClick={addBracket}
        style={{
          marginTop: 8, padding: '7px 14px', borderRadius: AD.radiusMd,
          background: 'transparent', border: `1px dashed ${AD.borderStrong}`,
          color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        <i className="ph ph-plus" style={{ fontSize: 13 }} />
        Add Bracket
      </button>
    </div>
  );
}

function FlatConfig({ form, setForm }) {
  return (
    <div style={{ maxWidth: 240 }}>
      <FieldLabel required>Bonus Amount per Referral</FieldLabel>
      <DollarInput
        value={form.flat_amount ?? ''}
        onChange={v => setForm(p => ({ ...p, flat_amount: v }))}
        placeholder="500"
      />
    </div>
  );
}

function PercentageConfig({ form, setForm }) {
  const rate = parseFloat(form.percentage_rate) || 0;
  const cap  = parseFloat(form.percentage_max_cap) || 0;
  const sampleInvoice = 10000;
  const earned = Math.min(rate > 0 ? sampleInvoice * (rate / 100) : 0, cap > 0 ? cap : Infinity);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <FieldLabel required>Referrer Earns</FieldLabel>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.percentage_rate ?? ''}
              onChange={e => setForm(p => ({ ...p, percentage_rate: e.target.value }))}
              placeholder="5"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 28px 9px 12px', borderRadius: AD.radiusMd,
                background: AD.bgCardTint, border: `1px solid ${AD.borderStrong}`,
                color: AD.textPrimary, fontSize: 14, fontFamily: AD.fontSans, outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: AD.textSecondary, fontSize: 14, pointerEvents: 'none' }}>%</span>
          </div>
        </div>
        <div>
          <FieldLabel>Maximum Bonus Cap</FieldLabel>
          <DollarInput
            value={form.percentage_max_cap ?? ''}
            onChange={v => setForm(p => ({ ...p, percentage_max_cap: v }))}
            placeholder="No cap"
          />
        </div>
      </div>

      {rate > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: AD.radiusMd,
          background: AD.bgCardTint, border: `1px solid ${AD.border}`,
          fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans,
        }}>
          On a $10,000 invoice, referrer earns{' '}
          <strong style={{ color: AD.textPrimary }}>${earned.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          {cap > 0 && earned === cap ? ' (capped)' : ''}
        </div>
      )}
    </div>
  );
}

function Step4({ form, setForm }) {
  return (
    <div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
        Configure the payout rules for this schedule.
      </p>
      {form.payout_model === 'escalating'  && <EscalatingConfig  form={form} setForm={setForm} />}
      {form.payout_model === 'tiered'      && <TieredConfig       form={form} setForm={setForm} />}
      {form.payout_model === 'flat'        && <FlatConfig         form={form} setForm={setForm} />}
      {form.payout_model === 'percentage'  && <PercentageConfig   form={form} setForm={setForm} />}
    </div>
  );
}

// ── Step 5: Preview & Save ─────────────────────────────────────────────────────
function buildPreview(form) {
  const { payout_model, job_types, minimum_invoice, escalating_steps, tier_brackets, flat_amount, percentage_rate, percentage_max_cap } = form;
  const types = job_types?.length ? job_types.join(' / ') : 'any job type';
  const minStr = minimum_invoice ? ` invoiced over $${Number(minimum_invoice).toLocaleString()}` : '';

  if (payout_model === 'escalating') {
    const steps = escalating_steps || [];
    const parts = steps.map((s, i) => {
      const label = s.is_catch_all ? `their ${s.referral_number}+ referral` : ordinal(s.referral_number);
      return `$${Number(s.payout_amount || 0).toLocaleString()} on ${label}`;
    });
    return `A referrer who brings in a ${types} job${minStr} earns ${parts.join(', ')}. Resets annually.`;
  }

  if (payout_model === 'tiered') {
    const brackets = tier_brackets || [];
    const amounts = brackets.map(b => `$${Number(b.payout_amount || 0).toLocaleString()}`);
    const range = amounts.length > 1 ? `${amounts[0]}–${amounts[amounts.length - 1]}` : (amounts[0] || '$0');
    return `A referrer who brings in a ${types} job${minStr} earns ${range} depending on the invoice amount.`;
  }

  if (payout_model === 'flat') {
    return `Every qualifying ${types} referral${minStr} pays $${Number(flat_amount || 0).toLocaleString()}.`;
  }

  if (payout_model === 'percentage') {
    const capStr = percentage_max_cap ? `, up to $${Number(percentage_max_cap).toLocaleString()}` : '';
    return `Referrer earns ${percentage_rate || 0}% of the invoice total${capStr}.`;
  }

  return '';
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return `their ${n}${s[(v-20)%10] || s[v] || s[0]} referral`;
}

function Step5({ form, onSave, saving }) {
  const preview = buildPreview(form);
  return (
    <div>
      <div style={{
        padding: '20px', borderRadius: AD.radiusLg,
        background: AD.bgCardTint, border: `1px solid ${AD.borderStrong}`,
        marginBottom: 28,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: AD.textTertiary, fontFamily: AD.fontSans, marginBottom: 10 }}>
          How this schedule works
        </div>
        <p style={{ margin: 0, fontSize: 14, color: AD.textPrimary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
          {preview || <span style={{ color: AD.textSecondary }}>Fill in previous steps to see a preview.</span>}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => onSave(false)}
          disabled={saving}
          style={{
            flex: 1, padding: '10px', borderRadius: AD.radiusMd,
            background: 'transparent', border: `1px solid ${AD.borderStrong}`,
            color: saving ? AD.textTertiary : AD.textSecondary, fontSize: 14, fontFamily: AD.fontSans,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving === 'draft' ? 'Saving…' : 'Save as Draft'}
        </button>
        <button
          onClick={() => onSave(true)}
          disabled={saving}
          style={{
            flex: 1, padding: '10px', borderRadius: AD.radiusMd,
            background: saving ? AD.bgCardTint : AD.navy,
            border: `1px solid ${saving ? AD.border : 'rgba(255,255,255,0.15)'}`,
            color: saving ? AD.textTertiary : '#fff', fontSize: 14, fontWeight: 600, fontFamily: AD.fontSans,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving === 'active' ? 'Saving…' : 'Activate & Save'}
        </button>
      </div>
    </div>
  );
}

// ── Validation ─────────────────────────────────────────────────────────────────
function canAdvance(step, form) {
  if (step === 1) return form.name.trim().length > 0 && !!form.payout_model;
  if (step === 2) return form.job_types.length > 0;
  if (step === 3) return true;
  if (step === 4) {
    if (form.payout_model === 'flat')       return parseFloat(form.flat_amount) > 0;
    if (form.payout_model === 'percentage') return parseFloat(form.percentage_rate) > 0;
    if (form.payout_model === 'escalating') {
      const steps = form.escalating_steps || [];
      return steps.length >= 2 && steps.every(s => parseFloat(s.payout_amount) > 0);
    }
    if (form.payout_model === 'tiered') {
      const brackets = form.tier_brackets || [];
      return brackets.length >= 1 && brackets.every(b => parseFloat(b.payout_amount) > 0);
    }
  }
  return true;
}

function buildPayload(form, is_active) {
  return {
    name:                form.name.trim(),
    payout_model:        form.payout_model,
    is_active,
    minimum_invoice:     form.minimum_invoice ? parseFloat(form.minimum_invoice) : null,
    invoice_window_days: Number(form.invoice_window_days) || 20,
    escalating_steps:    form.payout_model === 'escalating' ? (form.escalating_steps || []).map(s => ({
      referral_number: s.referral_number,
      payout_amount:   parseFloat(s.payout_amount) || 0,
      is_catch_all:    !!s.is_catch_all,
    })) : null,
    tier_brackets:       form.payout_model === 'tiered' ? (form.tier_brackets || []).map(b => ({
      min:          parseFloat(b.min) || 0,
      max:          b.max !== '' && b.max !== null && b.max !== undefined ? parseFloat(b.max) : null,
      payout_amount: parseFloat(b.payout_amount) || 0,
    })) : null,
    flat_amount:         form.payout_model === 'flat'       ? parseFloat(form.flat_amount) || null     : null,
    percentage_rate:     form.payout_model === 'percentage' ? parseFloat(form.percentage_rate) || null : null,
    percentage_max_cap:  form.payout_model === 'percentage' ? (form.percentage_max_cap ? parseFloat(form.percentage_max_cap) : null) : null,
    job_types:           form.job_types,
  };
}

function initFormFromSchedule(schedule) {
  if (!schedule) {
    return {
      name: '', payout_model: '', is_active: true,
      minimum_invoice: '', invoice_window_days: 20,
      escalating_steps: null, tier_brackets: null,
      flat_amount: null, percentage_rate: null, percentage_max_cap: null,
      job_types: [],
    };
  }
  return {
    name:                schedule.name || '',
    payout_model:        schedule.payout_model || '',
    is_active:           schedule.is_active ?? true,
    minimum_invoice:     schedule.minimum_invoice != null ? String(schedule.minimum_invoice) : '',
    invoice_window_days: schedule.invoice_window_days || 20,
    escalating_steps:    schedule.escalating_steps || null,
    tier_brackets:       schedule.tier_brackets || null,
    flat_amount:         schedule.flat_amount != null ? String(schedule.flat_amount) : null,
    percentage_rate:     schedule.percentage_rate != null ? String(schedule.percentage_rate) : null,
    percentage_max_cap:  schedule.percentage_max_cap != null ? String(schedule.percentage_max_cap) : null,
    job_types:           schedule.job_types || [],
  };
}

// ── Main Drawer ────────────────────────────────────────────────────────────────
export default function ScheduleBuilderDrawer({ schedule, allLabels, onSave, onClose }) {
  const isEdit = !!schedule;
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState(() => initFormFromSchedule(schedule));
  const [saving, setSaving] = useState(false); // false | 'draft' | 'active'
  const [error, setError]   = useState(null);

  const TOTAL_STEPS = 5;
  const canNext = canAdvance(step, form);

  async function handleSave(activate) {
    setSaving(activate ? 'active' : 'draft');
    setError(null);
    const payload = buildPayload(form, activate);
    try {
      const url = isEdit
        ? `${BACKEND_URL}/api/admin/schedules/${schedule.id}`
        : `${BACKEND_URL}/api/admin/schedules`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        setSaving(false);
        return;
      }
      onSave(data);
    } catch (err) {
      setError(err.message || 'Network error');
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 200,
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 520, background: AD.bgSurface,
        borderLeft: `1px solid ${AD.border}`,
        zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: AD.shadowLg,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${AD.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, marginBottom: 2 }}>
              {isEdit ? 'Edit' : 'New'} Schedule
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary }}>
              {isEdit ? form.name || 'Edit Schedule' : 'Schedule Builder'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`,
              background: 'transparent', cursor: 'pointer', color: AD.textSecondary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, padding: 0,
            }}
          >
            <i className="ph ph-x" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0' }}>
          <StepIndicator current={step} total={TOTAL_STEPS} />

          {step === 1 && <Step1 form={form} setForm={setForm} />}
          {step === 2 && <Step2 form={form} setForm={setForm} allLabels={allLabels} />}
          {step === 3 && <Step3 form={form} setForm={setForm} />}
          {step === 4 && <Step4 form={form} setForm={setForm} />}
          {step === 5 && <Step5 form={form} onSave={handleSave} saving={saving} />}

          {error && (
            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: AD.radiusMd,
              background: AD.red2Bg, border: `1px solid rgba(220,38,38,0.3)`,
              color: AD.red2Text, fontSize: 13, fontFamily: AD.fontSans,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <i className="ph ph-warning-circle" style={{ fontSize: 15, flexShrink: 0 }} />
              {error}
            </div>
          )}
        </div>

        {/* Footer nav (steps 1-4 only) */}
        {step < TOTAL_STEPS && (
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${AD.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
              style={{
                padding: '8px 18px', borderRadius: AD.radiusMd,
                background: 'transparent', border: `1px solid ${step === 1 ? AD.border : AD.borderStrong}`,
                color: step === 1 ? AD.textTertiary : AD.textSecondary,
                fontSize: 14, fontFamily: AD.fontSans, cursor: step === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Back
            </button>

            <button
              onClick={() => setStep(s => Math.min(TOTAL_STEPS, s + 1))}
              disabled={!canNext}
              style={{
                padding: '8px 24px', borderRadius: AD.radiusMd,
                background: canNext ? AD.navy : AD.bgCardTint,
                border: `1px solid ${canNext ? 'rgba(255,255,255,0.15)' : AD.border}`,
                color: canNext ? '#fff' : AD.textTertiary,
                fontSize: 14, fontWeight: 600, fontFamily: AD.fontSans,
                cursor: canNext ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
