import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import CompanyDetailsSettings from './CompanyDetailsSettings';
import BrandingProfileSettings from './BrandingProfileSettings';
import CRMSettings from './CRMSettings';

const SETTINGS_NAV = [
  { id: 'company',  icon: 'ph-buildings',    label: 'Company Details'  },
  { id: 'branding', icon: 'ph-paint-brush',  label: 'Branding Profile' },
  { id: 'banking',  icon: 'ph-bank',         label: 'Banking Settings' },
  { id: 'accounts', icon: 'ph-receipt',      label: 'Account Keeping'  },
  { id: 'team',     icon: 'ph-users-three',  label: 'Manage Team'      },
  { id: 'crm',      icon: 'ph-plugs',        label: 'CRM'              },
  { id: 'system',   icon: 'ph-hard-drives',  label: 'System'           },
];

function ComingSoonCard({ icon, label, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 400 }}>
      <div style={{
        background: AD.bgCard, borderRadius: AD.radiusLg, border: `1px solid ${AD.border}`,
        padding: '48px 40px', textAlign: 'center', maxWidth: 420,
      }}>
        <i className={`ph ${icon}`} style={{ fontSize: 48, color: 'rgba(255,255,255,0.15)' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans, margin: '16px 0 12px' }}>{label}</div>
        <p style={{ margin: '0 0 14px', fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>{description}</p>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: AD.radiusPill,
          background: AD.bgCardTint, color: AD.textSecondary, fontSize: 12,
        }}>Coming soon</span>
      </div>
    </div>
  );
}

const SETTINGS_TITLES = {
  company:  'Company Details',
  branding: 'Branding Profile',
  banking:  'Banking Settings',
  accounts: 'Account Keeping',
  team:     'Manage Team',
  crm:      'CRM',
  system:   'System',
};

const SETTINGS_DESCRIPTIONS = {
  company:  'Your company\'s core contact information and physical address.',
  branding: 'Customize how your referral app looks and feels to referrers.',
  system:   'Database maintenance and infrastructure tools.',
};

function SystemSettings() {
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState(null); // { type: 'success' | 'error', text: string }
  const timerRef                = useRef(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  async function handleRunBackup() {
    setLoading(true);
    setMessage(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/backup/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Backup completed successfully.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Backup failed. Check server logs.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Network error.' });
    } finally {
      setLoading(false);
      timerRef.current = setTimeout(() => setMessage(null), 10000);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{
        background: AD.bgCard, borderRadius: AD.radiusLg, border: `1px solid ${AD.border}`,
        padding: '28px 28px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <i className="ph ph-hard-drives" style={{ fontSize: 20, color: AD.blueLight }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>Database Backup</span>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
          Manual trigger for the daily automated backup to Backblaze B2. The scheduled backup runs automatically at 2am UTC.
        </p>

        <button
          onClick={handleRunBackup}
          disabled={loading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 20px', borderRadius: AD.radiusMd,
            background: loading ? AD.bgCardTint : AD.blueText,
            border: `1px solid ${loading ? AD.border : AD.blueText}`,
            color: loading ? AD.textSecondary : '#fff',
            fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {loading
            ? <><i className="ph ph-circle-notch" style={{ fontSize: 15, animation: 'spin 0.8s linear infinite' }} />Running backup...</>
            : <><i className="ph ph-cloud-arrow-up" style={{ fontSize: 15 }} />Run Backup Now</>
          }
        </button>

        {message && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: AD.radiusMd,
            background: message.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: message.type === 'success' ? '#4ade80' : '#f87171',
            fontSize: 13, fontFamily: AD.fontSans, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <i className={`ph ${message.type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 16, flexShrink: 0 }} />
            {message.text}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const SETTINGS_PAGES = {
  company:  <CompanyDetailsSettings />,
  branding: <BrandingProfileSettings />,
  banking:  <ComingSoonCard icon="ph-bank"        label="Banking Settings" description="Connect your bank account and configure payout settings." />,
  accounts: <ComingSoonCard icon="ph-receipt"     label="Account Keeping"  description="View transaction records, tax documents, and 1099 generation." />,
  team:     <ComingSoonCard icon="ph-users-three" label="Manage Team"      description="Add team members, manage recruitment links, and set permissions." />,
  crm:      <CRMSettings />,
  system:   <SystemSettings />,
};

export default function AdminSettings() {
  const [settingsPage, setSettingsPage] = useState('company');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Settings sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0,
        background: 'linear-gradient(160deg, #0d3a6e 0%, #082d5a 100%)',
        borderRight: `1px solid ${AD.border}`,
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column',
        padding: '20px 10px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '0 8px 10px' }}>Configuration</div>
        <nav>
          {SETTINGS_NAV.map(item => {
            const active = settingsPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSettingsPage(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', margin: 0, borderRadius: 10,
                  background: active ? AD.bgActive : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  fontSize: 14, fontWeight: active ? 500 : 400,
                  fontFamily: AD.fontSans, transition: 'background 0.15s, color 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; } }}
              >
                {active && <div style={{ position: 'absolute', left: -2, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: AD.blueLight, borderRadius: 99 }} />}
                <i className={`ph ${item.icon}`} style={{ fontSize: 16, opacity: 0.85, flexShrink: 0 }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Content area ── */}
      <main style={{ flex: 1, padding: '36px 40px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 15, color: AD.textSecondary, marginBottom: 2, fontFamily: AD.fontSans }}>Rooster Booster · Accent Roofing</p>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 400, fontFamily: "'DM Serif Display', serif", color: AD.textPrimary, lineHeight: 1.2 }}>{SETTINGS_TITLES[settingsPage]}</h1>
          {SETTINGS_DESCRIPTIONS[settingsPage] && (
            <p style={{ margin: 0, marginTop: 4, fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>{SETTINGS_DESCRIPTIONS[settingsPage]}</p>
          )}
        </div>
        {SETTINGS_PAGES[settingsPage]}
      </main>

    </div>
  );
}
