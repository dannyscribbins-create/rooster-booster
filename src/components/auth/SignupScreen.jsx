import { useState } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import rbLogoSquareWordmark from '../../assets/images/rb logo w wordmark 2000px transparent background.png';
import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
import useEntrance from '../../hooks/useEntrance';

// ─── Signup Screen ─────────────────────────────────────────────────────────────
export default function SignupScreen({ inviteSlug, contractorName, onSignupComplete }) {
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [phone, setPhone]                 = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [focused, setFocused]             = useState(null);
  const [loading, setLoading]             = useState(false);
  const [serverError, setServerError]     = useState('');
  const [fieldErrors, setFieldErrors]     = useState({});
  const cardVisible = useEntrance(80);

  // ─── Validation ──────────────────────────────────────────────────────────────
  function validate() {
    const errors = {};
    if (!firstName.trim()) errors.firstName = 'First name is required.';
    if (!lastName.trim())  errors.lastName  = 'Last name is required.';
    if (!phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else if (!/^[\d\s\-()+]{7,}$/.test(phone)) {
      errors.phone = 'Enter a valid phone number.';
    }
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    return errors;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────────
  function handleSubmit() {
    setServerError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    fetch(`${BACKEND_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, phone, email, password, inviteSlug }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, data }) => {
        setLoading(false);
        if (!ok) {
          setServerError(data.error || 'Something went wrong. Please try again.');
        } else {
          onSignupComplete({ action: 'verify', userId: data.userId, email });
        }
      })
      .catch(() => {
        setLoading(false);
        setServerError('Something went wrong. Please try again.');
      });
  }

  // ─── Styles ───────────────────────────────────────────────────────────────────
  const inputStyle = (field) => ({
    width: '100%',
    background: R.bgPage,
    border: `1.5px solid ${fieldErrors[field] ? '#dc2626' : focused === field ? R.navy : R.border}`,
    borderRadius: 10,
    padding: '14px 16px 14px 44px',
    color: R.textPrimary,
    fontSize: 15,
    fontFamily: R.fontBody,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  });

  const inputStyleNoIcon = (field) => ({
    ...inputStyle(field),
    padding: '14px 16px',
  });

  const inputStyleWithIconRight = (field) => ({
    ...inputStyle(field),
    padding: '14px 44px 14px 44px',
  });

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: R.textSecondary,
    marginBottom: 6,
    fontFamily: R.fontBody,
  };

  const fieldErrorStyle = {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 0,
  };

  const iconStyle = (field) => ({
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 16,
    color: focused === field ? R.navy : R.textMuted,
    transition: 'color 0.2s',
    pointerEvents: 'none',
  });

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
      padding: '32px 24px',
      fontFamily: R.fontBody,
    }}>
      {/* Top brand mark */}
      <div style={{
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        <img
          src={rbLogoSquareWordmark}
          alt="Rooster Booster"
          style={{ width: 200, height: 'auto', margin: '0 auto', display: 'block', marginBottom: 8 }}
        />
      </div>

      {/* Signup card */}
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: R.bgCard,
        borderRadius: 20,
        padding: '32px 28px',
        boxShadow: R.shadowLg,
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <img
          src={accentRoofingLogo}
          alt={contractorName || 'Accent Roofing Service'}
          style={{ width: 120, height: 'auto', display: 'block', margin: '0 auto 20px' }}
        />
        <h2 style={{
          margin: '0 0 6px',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: R.fontSans,
          color: R.navy,
        }}>
          Create your account
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 15, color: R.textSecondary }}>
          Join {contractorName || 'the referral program'} and start earning rewards.
        </p>

        {/* Server error */}
        {serverError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fee2e2',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
          }}>
            <i className="ph ph-warning-circle" style={{ color: '#dc2626', fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: '#dc2626', fontSize: 14, margin: 0, lineHeight: 1.4 }}>{serverError}</p>
          </div>
        )}

        {/* First Name + Last Name row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: fieldErrors.firstName || fieldErrors.lastName ? 4 : 16 }}>
          {/* First Name */}
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>First name</label>
            <div style={{ position: 'relative' }}>
              <i className="ph ph-user" style={iconStyle('firstName')} />
              <input
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setFieldErrors(fe => ({ ...fe, firstName: '' })); }}
                onFocus={() => setFocused('firstName')}
                onBlur={() => setFocused(null)}
                placeholder="First"
                style={inputStyle('firstName')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            {fieldErrors.firstName && <p style={fieldErrorStyle}>{fieldErrors.firstName}</p>}
          </div>

          {/* Last Name */}
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Last name</label>
            <div style={{ position: 'relative' }}>
              <input
                value={lastName}
                onChange={e => { setLastName(e.target.value); setFieldErrors(fe => ({ ...fe, lastName: '' })); }}
                onFocus={() => setFocused('lastName')}
                onBlur={() => setFocused(null)}
                placeholder="Last"
                style={inputStyleNoIcon('lastName')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            {fieldErrors.lastName && <p style={fieldErrorStyle}>{fieldErrors.lastName}</p>}
          </div>
        </div>

        {/* Phone */}
        <div style={{ marginBottom: fieldErrors.phone ? 4 : 16 }}>
          <label style={labelStyle}>Phone number</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-phone" style={iconStyle('phone')} />
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setFieldErrors(fe => ({ ...fe, phone: '' })); }}
              onFocus={() => setFocused('phone')}
              onBlur={() => setFocused(null)}
              placeholder="(770) 555-1234"
              style={inputStyle('phone')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {fieldErrors.phone && <p style={fieldErrorStyle}>{fieldErrors.phone}</p>}
        </div>

        {/* Email */}
        <div style={{ marginBottom: fieldErrors.email ? 4 : 16 }}>
          <label style={labelStyle}>Email address</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-envelope" style={iconStyle('email')} />
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(fe => ({ ...fe, email: '' })); }}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="you@example.com"
              style={inputStyle('email')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {fieldErrors.email && <p style={fieldErrorStyle}>{fieldErrors.email}</p>}
        </div>

        {/* Password */}
        <div style={{ marginBottom: fieldErrors.password ? 4 : 16 }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-lock" style={iconStyle('password')} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setFieldErrors(fe => ({ ...fe, password: '' })); }}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              placeholder="Min. 6 characters"
              style={inputStyleWithIconRight('password')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: R.textMuted,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <i className={`ph ph-${showPassword ? 'eye-slash' : 'eye'}`} style={{ fontSize: 16 }} />
            </button>
          </div>
          {fieldErrors.password && <p style={fieldErrorStyle}>{fieldErrors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: fieldErrors.confirmPassword ? 4 : 24 }}>
          <label style={labelStyle}>Confirm password</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-lock" style={iconStyle('confirmPassword')} />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(fe => ({ ...fe, confirmPassword: '' })); }}
              onFocus={() => setFocused('confirmPassword')}
              onBlur={() => setFocused(null)}
              placeholder="Re-enter password"
              style={inputStyleWithIconRight('confirmPassword')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: R.textMuted,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <i className={`ph ph-${showConfirm ? 'eye-slash' : 'eye'}`} style={{ fontSize: 16 }} />
            </button>
          </div>
          {fieldErrors.confirmPassword && <p style={{ ...fieldErrorStyle, marginBottom: 16 }}>{fieldErrors.confirmPassword}</p>}
        </div>

        {/* Submit button — navy gradient (not red, differentiates from login) */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            background: loading
              ? R.navyDark
              : `linear-gradient(135deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
            border: 'none',
            borderRadius: 10,
            padding: '16px',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: R.fontSans,
            cursor: loading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'transform 0.2s, box-shadow 0.2s',
            transform: loading ? 'scale(0.98)' : 'scale(1)',
            boxShadow: loading ? 'none' : `0 4px 14px rgba(1,40,84,0.35)`,
          }}
        >
          {loading
            ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Creating account...</>
            : <><i className="ph ph-user-plus" style={{ fontSize: 16 }} /> Create Account</>
          }
        </button>

        {/* Sign in link */}
        <p style={{ textAlign: 'center', marginTop: 20, color: R.textMuted, fontSize: 15 }}>
          Already have an account?{' '}
          <button
            onClick={() => onSignupComplete({ action: 'login' })}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              font: 'inherit',
              cursor: 'pointer',
              color: R.navy,
              fontWeight: 600,
            }}
          >
            Sign in
          </button>
        </p>
      </div>

      {/* Footer */}
      <p style={{
        marginTop: 24,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontFamily: R.fontMono,
        letterSpacing: '0.06em',
        opacity: cardVisible ? 1 : 0,
        transition: 'opacity 0.5s ease 0.3s',
      }}>
        ACCENT ROOFING SERVICE · EST. 1989
      </p>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
