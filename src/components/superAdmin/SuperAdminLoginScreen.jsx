import { useState } from 'react';
import { BACKEND_URL } from '../../config/contractor';

const NAVY = '#012854';
const RED  = '#CC0000';

// ─── Super-Admin Login Screen ─────────────────────────────────────────────────
// Unadvertised — reachable only at /rm-control/login by direct URL.
// Do not link to this from any nav, help text, or admin UI.
export default function SuperAdminLoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [focused, setFocused]   = useState(null);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/rm-control/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      sessionStorage.setItem('rm_control_token', data.token);
      window.location.href = '/rm-control';
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  const inputStyle = (field) => ({
    width: '100%',
    background: '#f8fafc',
    border: `1.5px solid ${focused === field ? NAVY : '#d1d5db'}`,
    borderRadius: 8,
    padding: '14px 14px 14px 44px',
    color: '#1e293b',
    fontSize: 15,
    fontFamily: "'Roboto', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  });

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(160deg, ${NAVY} 0%, #1e3a6e 100%)`,
      padding: '32px 24px',
      fontFamily: "'Roboto', sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: '#ffffff',
        borderRadius: 16,
        padding: '36px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: NAVY,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <i className="ph ph-shield-check" style={{ fontSize: 24, color: '#ffffff' }} />
          </div>
          <h2 style={{
            margin: '0 0 6px',
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "'Montserrat', sans-serif",
            color: NAVY,
          }}>Platform Admin</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            RoofMiles control panel
          </p>
        </div>

        {/* Email */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Email
        </label>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <i className="ph ph-envelope" style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 16, color: focused === 'email' ? NAVY : '#9ca3af', pointerEvents: 'none',
            transition: 'color 0.2s',
          }} />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="admin@example.com"
            autoComplete="email"
            style={inputStyle('email')}
          />
        </div>

        {/* Password */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Password
        </label>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <i className="ph ph-lock" style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 16, color: focused === 'password' ? NAVY : '#9ca3af', pointerEvents: 'none',
            transition: 'color 0.2s',
          }} />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            autoComplete="current-password"
            style={inputStyle('password')}
          />
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fee2e2', borderRadius: 8, padding: '10px 12px',
            marginBottom: 16,
          }}>
            <i className="ph ph-warning-circle" style={{ color: '#dc2626', fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? '#9ca3af' : NAVY,
            border: 'none',
            borderRadius: 8,
            padding: '14px',
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Montserrat', sans-serif",
            cursor: loading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'background 0.2s',
          }}
        >
          {loading
            ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Signing in...</>
            : <><i className="ph ph-sign-in" style={{ fontSize: 16 }} /> Sign In</>
          }
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
