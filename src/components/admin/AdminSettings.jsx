import { useState } from 'react';
import { AD } from '../../constants/adminTheme';
import CompanyDetailsSettings from './CompanyDetailsSettings';
import BrandingProfileSettings from './BrandingProfileSettings';

const SETTINGS_NAV = [
  { id: 'company',  icon: 'ph-buildings',    label: 'Company Details'  },
  { id: 'branding', icon: 'ph-paint-brush',  label: 'Branding Profile' },
  { id: 'banking',  icon: 'ph-bank',         label: 'Banking Settings' },
  { id: 'accounts', icon: 'ph-receipt',      label: 'Account Keeping'  },
  { id: 'team',     icon: 'ph-users-three',  label: 'Manage Team'      },
  { id: 'crm',      icon: 'ph-plugs',        label: 'CRM'              },
];

function ComingSoonCard({ icon, label, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 400 }}>
      <div style={{
        background: AD.bgCard, borderRadius: AD.radiusLg, border: `1px solid ${AD.border}`,
        padding: '48px 40px', textAlign: 'center', maxWidth: 420,
      }}>
        <i className={`ph ${icon}`} style={{ fontSize: 48, color: 'rgba(255,255,255,0.15)' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans, margin: '16px 0 8px' }}>{label}</div>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: AD.radiusPill,
          background: AD.bgCardTint, color: AD.textSecondary, fontSize: 12, marginBottom: 12,
        }}>Coming soon</span>
        <p style={{ margin: 0, fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>{description}</p>
      </div>
    </div>
  );
}

const SETTINGS_PAGES = {
  company:  <CompanyDetailsSettings />,
  branding: <BrandingProfileSettings />,
  banking:  <ComingSoonCard icon="ph-bank"        label="Banking Settings" description="Connect your bank account and configure ACH payouts" />,
  accounts: <ComingSoonCard icon="ph-receipt"     label="Account Keeping"  description="Transaction records, tax documents, and 1099 generation" />,
  team:     <ComingSoonCard icon="ph-users-three" label="Manage Team"      description="Internal users, recruitment links, and team management" />,
  crm:      <ComingSoonCard icon="ph-plugs"       label="CRM"              description="Connect and configure your CRM integration" />,
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
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 400, fontFamily: "'DM Serif Display', serif", color: AD.textPrimary, lineHeight: 1.2 }}>Settings</h1>
        </div>
        {SETTINGS_PAGES[settingsPage]}
      </main>

    </div>
  );
}
