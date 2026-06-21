import { useEffect } from 'react';

const NAVY = '#012854';

// ─── Super-Admin Shell (Phase 1 placeholder) ──────────────────────────────────
// Contractor-picker, impersonation banner, and cross-contractor UI are out of
// scope for Phase 1. This shell confirms successful login and holds the route.
export default function SuperAdminShell() {
  useEffect(() => {
    const token = sessionStorage.getItem('rm_control_token');
    if (!token) {
      window.location.href = '/rm-control/login';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    sessionStorage.removeItem('rm_control_token');
    window.location.href = '/rm-control/login';
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Roboto', sans-serif",
      padding: 32,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: '40px 48px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        textAlign: 'center',
        maxWidth: 480,
        width: '100%',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: NAVY,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <i className="ph ph-shield-check" style={{ fontSize: 28, color: '#ffffff' }} />
        </div>

        <h1 style={{
          margin: '0 0 8px',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: "'Montserrat', sans-serif",
          color: NAVY,
        }}>
          Super Admin — Logged In
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 15, color: '#64748b', lineHeight: 1.6 }}>
          Platform control panel. Contractor-picker and cross-contractor UI will be built in a future phase.
        </p>

        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: `1.5px solid ${NAVY}`,
            borderRadius: 8,
            padding: '10px 24px',
            color: NAVY,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Montserrat', sans-serif",
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <i className="ph ph-sign-out" style={{ fontSize: 16 }} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
