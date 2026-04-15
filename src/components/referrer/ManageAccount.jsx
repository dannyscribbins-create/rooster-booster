import { useState, useEffect, useRef } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';

// Defined outside ManageAccount so it's a stable reference across renders
function Toggle({ on, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={!!disabled}
      aria-label="Toggle"
      style={{
        width: 44, height: 24, borderRadius: 99, flexShrink: 0,
        background: on ? R.navy : R.border,
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background 0.2s', padding: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </button>
  );
}

export default function ManageAccount({ userEmail, userName, onNameUpdate, onLogout }) {
  const [open, setOpen]         = useState(false);
  const [tab, setTab]           = useState('personal');
  const [acct, setAcct]         = useState(null);
  const [acctLoading, setAcctLoading] = useState(false);
  const loaded = useRef(false);

  // ── Personal Info ──────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');
  const [nameSaving, setNameSaving]   = useState(false);
  const [nameError, setNameError]     = useState('');

  const [emailCodeSent, setEmailCodeSent]   = useState(false);
  const [emailCode, setEmailCode]           = useState('');
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailError, setEmailError]         = useState('');

  const [editingPhone, setEditingPhone]   = useState(false);
  const [phoneInput, setPhoneInput]       = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCode, setPhoneCode]         = useState('');
  const [phoneBusy, setPhoneBusy]         = useState(false);
  const [phoneError, setPhoneError]       = useState('');

  // ── Security ───────────────────────────────────────────────────────────────
  const [totpSetup, setTotpSetup]       = useState(null); // { secret, qrCodeUrl }
  const [totpToken, setTotpToken]       = useState('');
  const [totpBusy, setTotpBusy]         = useState(false);
  const [totpError, setTotpError]       = useState('');
  const [showTotpReset, setShowTotpReset] = useState(false);

  const [recoveryPhone, setRecoveryPhone]   = useState('');
  const [recoveryEmail, setRecoveryEmail]   = useState('');
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryError, setRecoveryError]   = useState('');
  const [recoverySaved, setRecoverySaved]   = useState(false);

  const [sessions, setSessions]           = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const sessionsFetched = useRef(false);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput]         = useState('');
  const [deleteLoading, setDeleteLoading]     = useState(false);
  const [deleteError, setDeleteError]         = useState('');

  // ── Load account data on first open ───────────────────────────────────────
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    setAcctLoading(true);
    fetch(`${BACKEND_URL}/api/account/me`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_token')}` },
    })
      .then(r => r.json())
      .then(data => {
        setAcct(data);
        setRecoveryPhone(data.recovery_phone || '');
        setRecoveryEmail(data.recovery_email || '');
      })
      .catch(() => {})
      .finally(() => setAcctLoading(false));
  }, [open]);

  // ── Load sessions on first Security tab view ───────────────────────────────
  useEffect(() => {
    if (tab !== 'security' || !open || sessionsFetched.current) return;
    sessionsFetched.current = true;
    setSessionsLoading(true);
    fetch(`${BACKEND_URL}/api/account/sessions`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_token')}` },
    })
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [tab, open]);

  // ── Shared helpers ─────────────────────────────────────────────────────────
  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionStorage.getItem('rb_token')}`,
    };
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    border: `1.5px solid ${R.border}`, borderRadius: 10,
    fontSize: 14, fontFamily: R.fontBody, color: R.textPrimary,
    background: R.bgPage, boxSizing: 'border-box', outline: 'none',
  };

  const btnPrimary = {
    background: R.navy, color: '#fff', border: 'none',
    borderRadius: 8, padding: '9px 18px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: R.fontBody,
  };

  const btnSecondary = {
    background: 'transparent', color: R.textSecondary,
    border: `1.5px solid ${R.border}`, borderRadius: 8,
    padding: '9px 18px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: R.fontBody,
  };

  const rowLabel = {
    margin: 0, fontSize: 12, color: R.textMuted,
    fontFamily: R.fontBody, textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  const rowValue = {
    margin: '2px 0 0', fontSize: 15, fontWeight: 600,
    color: R.textPrimary, fontFamily: R.fontBody,
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function saveName() {
    if (!editNameVal.trim()) return;
    setNameSaving(true); setNameError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/name`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ name: editNameVal.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setNameError(d.error || 'Failed to save'); return; }
      setAcct(a => ({ ...a, name: editNameVal.trim() }));
      onNameUpdate(editNameVal.trim());
      setEditingName(false);
    } catch { setNameError('Failed to save'); }
    finally { setNameSaving(false); }
  }

  async function sendEmailCode() {
    setEmailError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/send-email-verification`, {
        method: 'POST', headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok) { setEmailError(d.error || 'Failed to send'); return; }
      setEmailCodeSent(true);
    } catch { setEmailError('Failed to send'); }
  }

  async function verifyEmail() {
    setEmailVerifying(true); setEmailError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/verify-email`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ code: emailCode }),
      });
      const d = await r.json();
      if (!r.ok) { setEmailError(d.error || 'Invalid code'); return; }
      setAcct(a => ({ ...a, email_verified: true }));
      setEmailCodeSent(false); setEmailCode('');
    } catch { setEmailError('Verification failed'); }
    finally { setEmailVerifying(false); }
  }

  async function sendPhoneCode() {
    setPhoneError(''); setPhoneBusy(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/send-phone-verification`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ phone_number: phoneInput }),
      });
      const d = await r.json();
      if (!r.ok) { setPhoneError(d.error || 'Failed to send'); return; }
      setPhoneCodeSent(true);
    } catch { setPhoneError('Failed to send'); }
    finally { setPhoneBusy(false); }
  }

  async function verifyPhone() {
    setPhoneError(''); setPhoneBusy(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/verify-phone`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ phone_number: phoneInput, code: phoneCode }),
      });
      const d = await r.json();
      if (!r.ok) { setPhoneError(d.error || 'Invalid code'); return; }
      setAcct(a => ({ ...a, phone_number: phoneInput, phone_verified: true }));
      setEditingPhone(false); setPhoneCodeSent(false);
      setPhoneCode(''); setPhoneInput('');
    } catch { setPhoneError('Verification failed'); }
    finally { setPhoneBusy(false); }
  }

  async function setupTotp() {
    setTotpBusy(true); setTotpError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/totp/setup`, {
        method: 'POST', headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok) { setTotpError(d.error || 'Setup failed'); return; }
      setTotpSetup(d);
    } catch { setTotpError('Setup failed'); }
    finally { setTotpBusy(false); }
  }

  async function confirmTotp() {
    setTotpBusy(true); setTotpError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/totp/confirm`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ secret: totpSetup.secret, token: totpToken }),
      });
      const d = await r.json();
      if (!r.ok) { setTotpError(d.error || 'Invalid code'); return; }
      setAcct(a => ({ ...a, totp_enabled: true }));
      setTotpSetup(null); setTotpToken('');
    } catch { setTotpError('Confirm failed'); }
    finally { setTotpBusy(false); }
  }

  async function disableTotp() {
    setTotpBusy(true); setTotpError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/totp/disable`, {
        method: 'POST', headers: authHeaders(),
      });
      if (!r.ok) { setTotpError('Failed to disable'); return; }
      setAcct(a => ({ ...a, totp_enabled: false }));
    } catch { setTotpError('Failed to disable'); }
    finally { setTotpBusy(false); }
  }

  async function resetTotp() {
    setTotpBusy(true); setTotpError('');
    try {
      await fetch(`${BACKEND_URL}/api/account/totp/disable`, {
        method: 'POST', headers: authHeaders(),
      });
      await fetch(`${BACKEND_URL}/api/account/totp/reset`, {
        method: 'POST', headers: authHeaders(),
      });
      setAcct(a => ({ ...a, totp_enabled: false }));
      setShowTotpReset(false);
    } catch { setTotpError('Reset failed'); }
    finally { setTotpBusy(false); }
  }

  async function toggleSms2fa(enabled) {
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/sms-2fa`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ enabled }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Failed to update'); return; }
      setAcct(a => ({ ...a, sms_2fa_enabled: enabled }));
    } catch {}
  }

  async function saveRecovery() {
    setRecoverySaving(true); setRecoveryError(''); setRecoverySaved(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/recovery`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ recovery_phone: recoveryPhone, recovery_email: recoveryEmail }),
      });
      const d = await r.json();
      if (!r.ok) { setRecoveryError(d.error || 'Failed to save'); return; }
      setAcct(a => ({ ...a, recovery_phone: recoveryPhone, recovery_email: recoveryEmail }));
      setRecoverySaved(true);
    } catch { setRecoveryError('Failed to save'); }
    finally { setRecoverySaving(false); }
  }

  async function signOutOthers() {
    try {
      await fetch(`${BACKEND_URL}/api/account/sessions/sign-out-others`, {
        method: 'POST', headers: authHeaders(),
      });
      const r = await fetch(`${BACKEND_URL}/api/account/sessions`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_token')}` },
      });
      const data = await r.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function deleteAccount() {
    if (deleteInput !== 'DELETE') return;
    setDeleteLoading(true); setDeleteError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/account/me`, {
        method: 'DELETE', headers: authHeaders(),
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });
      const d = await r.json();
      if (!r.ok) { setDeleteError(d.error || 'Failed'); return; }
      sessionStorage.removeItem('rb_token');
      onLogout();
    } catch { setDeleteError('Failed to delete account'); }
    finally { setDeleteLoading(false); }
  }

  const TAB_LABELS = { personal: 'Personal Info', security: 'Security', privacy: 'Privacy' };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{
        background: R.bgCard, border: `1px solid ${R.border}`,
        borderRadius: 16, boxShadow: R.shadow, marginBottom: 16, overflow: 'hidden',
      }}>
        {/* ── Collapsible header ── */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', background: 'none', border: 'none',
            padding: '16px 18px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ph ph-gear" style={{ fontSize: 18, color: R.navy }} />
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: R.textPrimary }}>
              Manage Account
            </span>
          </div>
          <i
            className={`ph ph-caret-${open ? 'up' : 'down'}`}
            style={{ fontSize: 16, color: R.textMuted }}
          />
        </button>

        {/* ── Expanded body ── */}
        {open && (
          <div style={{ borderTop: `1px solid ${R.border}` }}>

            {/* Loading skeleton */}
            {acctLoading && (
              <div style={{ padding: '28px 18px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 14, color: R.textMuted, fontFamily: R.fontBody }}>Loading…</p>
              </div>
            )}

            {!acctLoading && (
              <>
                {/* ── Pill tabs ── */}
                <div style={{
                  display: 'flex', gap: 8,
                  padding: '12px 16px',
                  borderBottom: `1px solid ${R.border}`,
                  overflowX: 'auto',
                }}>
                  {Object.keys(TAB_LABELS).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      style={{
                        background: tab === t ? R.navy : R.bgPage,
                        border: `1.5px solid ${tab === t ? R.navy : R.border}`,
                        borderRadius: 999, padding: '6px 14px',
                        color: tab === t ? '#fff' : R.textSecondary,
                        fontSize: 12, fontWeight: tab === t ? 700 : 500,
                        cursor: 'pointer', fontFamily: R.fontBody,
                        whiteSpace: 'nowrap',
                        transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                      }}
                    >
                      {TAB_LABELS[t]}
                    </button>
                  ))}
                </div>

                {/* ── PERSONAL INFO TAB ── */}
                {tab === 'personal' && (
                  <div>
                    {/* Name */}
                    {editingName ? (
                      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${R.border}` }}>
                        <p style={rowLabel}>Name</p>
                        <input
                          value={editNameVal}
                          onChange={e => setEditNameVal(e.target.value)}
                          style={{ ...inputStyle, marginTop: 8 }}
                          autoFocus
                        />
                        {nameError && (
                          <p style={{ margin: '6px 0 0', fontSize: 12, color: R.red }}>{nameError}</p>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button onClick={saveName} disabled={nameSaving} style={btnPrimary}>
                            {nameSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditingName(false); setNameError(''); }}
                            style={btnSecondary}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: '14px 18px', borderBottom: `1px solid ${R.border}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <div>
                          <p style={rowLabel}>Name</p>
                          <p style={rowValue}>{acct?.name || userName}</p>
                        </div>
                        <button
                          onClick={() => { setEditingName(true); setEditNameVal(acct?.name || userName); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: R.navy, padding: 6 }}
                        >
                          <i className="ph ph-pencil" style={{ fontSize: 16 }} />
                        </button>
                      </div>
                    )}

                    {/* Email */}
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${R.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={rowLabel}>Email</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <p style={rowValue}>{userEmail}</p>
                            {acct?.email_verified && (
                              <i className="ph ph-check-circle-fill" style={{ fontSize: 15, color: R.green }} />
                            )}
                          </div>
                        </div>
                        {!acct?.email_verified && !emailCodeSent && (
                          <button
                            onClick={sendEmailCode}
                            style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12, marginTop: 2 }}
                          >
                            Verify
                          </button>
                        )}
                      </div>
                      {emailCodeSent && (
                        <div style={{ marginTop: 12 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 13, color: R.textSecondary, fontFamily: R.fontBody }}>
                            Enter the 6-digit code sent to your email.
                          </p>
                          <input
                            value={emailCode}
                            onChange={e => setEmailCode(e.target.value)}
                            maxLength={6}
                            placeholder="000000"
                            style={{
                              ...inputStyle,
                              fontFamily: R.fontMono, fontSize: 20,
                              letterSpacing: '0.2em', textAlign: 'center',
                            }}
                          />
                          {emailError && (
                            <p style={{ margin: '6px 0 0', fontSize: 12, color: R.red }}>{emailError}</p>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button
                              onClick={verifyEmail}
                              disabled={emailVerifying || emailCode.length !== 6}
                              style={btnPrimary}
                            >
                              {emailVerifying ? 'Verifying…' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => { setEmailCodeSent(false); setEmailCode(''); setEmailError(''); }}
                              style={btnSecondary}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {emailError && !emailCodeSent && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: R.red }}>{emailError}</p>
                      )}
                    </div>

                    {/* Phone */}
                    <div style={{ padding: '14px 18px' }}>
                      {!editingPhone ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={rowLabel}>Phone</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <p style={{
                                ...rowValue,
                                color: acct?.phone_number ? R.textPrimary : R.textMuted,
                                fontStyle: acct?.phone_number ? 'normal' : 'italic',
                              }}>
                                {acct?.phone_number || 'Add phone number'}
                              </p>
                              {acct?.phone_verified && (
                                <i className="ph ph-check-circle-fill" style={{ fontSize: 15, color: R.green }} />
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => { setEditingPhone(true); setPhoneInput(acct?.phone_number || ''); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: R.navy, padding: 6 }}
                          >
                            <i className={`ph ph-${acct?.phone_number ? 'pencil' : 'plus-circle'}`} style={{ fontSize: 16 }} />
                          </button>
                        </div>
                      ) : !phoneCodeSent ? (
                        <div>
                          <p style={rowLabel}>Phone</p>
                          <input
                            value={phoneInput}
                            onChange={e => setPhoneInput(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            style={{ ...inputStyle, marginTop: 8 }}
                            autoFocus
                          />
                          {phoneError && (
                            <p style={{ margin: '6px 0 0', fontSize: 12, color: R.red }}>{phoneError}</p>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button
                              onClick={sendPhoneCode}
                              disabled={phoneBusy || !phoneInput.trim()}
                              style={btnPrimary}
                            >
                              {phoneBusy ? 'Sending…' : 'Send Code'}
                            </button>
                            <button
                              onClick={() => { setEditingPhone(false); setPhoneError(''); }}
                              style={btnSecondary}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p style={{ margin: '0 0 8px', fontSize: 13, color: R.textSecondary, fontFamily: R.fontBody }}>
                            Enter the 6-digit code sent to {phoneInput}.
                          </p>
                          <input
                            value={phoneCode}
                            onChange={e => setPhoneCode(e.target.value)}
                            maxLength={6}
                            placeholder="000000"
                            style={{
                              ...inputStyle,
                              fontFamily: R.fontMono, fontSize: 20,
                              letterSpacing: '0.2em', textAlign: 'center',
                            }}
                          />
                          {phoneError && (
                            <p style={{ margin: '6px 0 0', fontSize: 12, color: R.red }}>{phoneError}</p>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button
                              onClick={verifyPhone}
                              disabled={phoneBusy || phoneCode.length !== 6}
                              style={btnPrimary}
                            >
                              {phoneBusy ? 'Verifying…' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => { setPhoneCodeSent(false); setPhoneCode(''); setPhoneError(''); }}
                              style={btnSecondary}
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── SECURITY TAB ── */}
                {tab === 'security' && (
                  <div>
                    {/* Authenticator App (TOTP) */}
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${R.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, paddingRight: 16 }}>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: R.textPrimary, fontFamily: R.fontBody }}>
                            Authenticator App (TOTP)
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: R.textMuted, fontFamily: R.fontBody }}>
                            Use an authenticator app for 2-step login
                          </p>
                        </div>
                        <Toggle
                          on={acct?.totp_enabled || !!totpSetup}
                          onToggle={() => {
                            if (acct?.totp_enabled) disableTotp();
                            else if (!totpSetup) setupTotp();
                            else { setTotpSetup(null); setTotpToken(''); }
                          }}
                          disabled={totpBusy}
                        />
                      </div>
                      {totpSetup && (
                        <div style={{ marginTop: 16 }}>
                          <p style={{ margin: '0 0 12px', fontSize: 13, color: R.textSecondary, fontFamily: R.fontBody, lineHeight: 1.5 }}>
                            Scan with your authenticator app, then enter the 6-digit code to confirm.
                          </p>
                          <img
                            src={totpSetup.qrCodeUrl}
                            alt="Authenticator QR Code"
                            style={{
                              display: 'block', width: 160, height: 160,
                              margin: '0 auto 14px',
                              borderRadius: 8, border: `1px solid ${R.border}`,
                            }}
                          />
                          <input
                            value={totpToken}
                            onChange={e => setTotpToken(e.target.value)}
                            maxLength={6}
                            placeholder="000000"
                            style={{
                              ...inputStyle,
                              fontFamily: R.fontMono, fontSize: 20,
                              letterSpacing: '0.2em', textAlign: 'center',
                            }}
                          />
                          {totpError && (
                            <p style={{ margin: '6px 0 0', fontSize: 12, color: R.red }}>{totpError}</p>
                          )}
                          <button
                            onClick={confirmTotp}
                            disabled={totpBusy || totpToken.length !== 6}
                            style={{ ...btnPrimary, width: '100%', marginTop: 10 }}
                          >
                            {totpBusy ? 'Confirming…' : 'Confirm'}
                          </button>
                        </div>
                      )}
                      {!totpSetup && totpError && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: R.red }}>{totpError}</p>
                      )}
                      {acct?.totp_enabled && !totpSetup && (
                        <div style={{ marginTop: 10 }}>
                          <button
                            onClick={() => setShowTotpReset(true)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: 0, color: '#dc2626',
                              fontSize: 13, fontWeight: 600, fontFamily: R.fontBody,
                            }}
                          >
                            Reset Authenticator
                          </button>
                          {showTotpReset && (
                            <div style={{
                              marginTop: 10, padding: 14, borderRadius: 10,
                              background: '#fff5f5', border: '1px solid #fecaca',
                            }}>
                              <p style={{ margin: '0 0 12px', fontSize: 13, color: R.textSecondary, fontFamily: R.fontBody, lineHeight: 1.5 }}>
                                This will unlink your current authenticator app. You'll need to re-scan a new QR code to re-enable.
                              </p>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  onClick={resetTotp}
                                  disabled={totpBusy}
                                  style={{
                                    background: '#dc2626', color: '#fff', border: 'none',
                                    borderRadius: 8, padding: '8px 16px',
                                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: R.fontBody,
                                  }}
                                >
                                  {totpBusy ? 'Resetting…' : 'Reset'}
                                </button>
                                <button
                                  onClick={() => setShowTotpReset(false)}
                                  style={{
                                    background: 'transparent', color: R.textSecondary,
                                    border: `1.5px solid ${R.border}`, borderRadius: 8,
                                    padding: '8px 16px', fontSize: 13, fontWeight: 600,
                                    cursor: 'pointer', fontFamily: R.fontBody,
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* SMS 2FA */}
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${R.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, paddingRight: 16 }}>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: R.textPrimary, fontFamily: R.fontBody }}>
                            2-Step via SMS
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: R.textMuted, fontFamily: R.fontBody }}>
                            Receive a code by text message at login
                          </p>
                        </div>
                        <Toggle
                          on={acct?.sms_2fa_enabled || false}
                          onToggle={() => toggleSms2fa(!acct?.sms_2fa_enabled)}
                          disabled={!acct?.phone_verified && !acct?.sms_2fa_enabled}
                        />
                      </div>
                      {!acct?.phone_verified && !acct?.sms_2fa_enabled && (
                        <p style={{ margin: '8px 0 0', fontSize: 12, color: R.textMuted, fontFamily: R.fontBody }}>
                          Verify your phone number first (under Personal Info).
                        </p>
                      )}
                    </div>

                    {/* Recovery */}
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${R.border}` }}>
                      <p style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: R.textPrimary, fontFamily: R.fontBody }}>
                        Recovery
                      </p>
                      <p style={{ ...rowLabel, marginBottom: 6 }}>Recovery Phone</p>
                      <input
                        value={recoveryPhone}
                        onChange={e => setRecoveryPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        style={{ ...inputStyle, marginBottom: 14 }}
                      />
                      <p style={{ ...rowLabel, marginBottom: 6 }}>Recovery Email</p>
                      <input
                        value={recoveryEmail}
                        onChange={e => setRecoveryEmail(e.target.value)}
                        placeholder="backup@email.com"
                        style={{ ...inputStyle, marginBottom: 12 }}
                      />
                      {recoveryError && (
                        <p style={{ margin: '0 0 8px', fontSize: 12, color: R.red }}>{recoveryError}</p>
                      )}
                      {recoverySaved && (
                        <p style={{ margin: '0 0 8px', fontSize: 12, color: R.green, fontFamily: R.fontBody }}>
                          Saved.
                        </p>
                      )}
                      <button
                        onClick={saveRecovery}
                        disabled={recoverySaving}
                        style={{ ...btnPrimary, width: '100%' }}
                      >
                        {recoverySaving ? 'Saving…' : 'Save Recovery Info'}
                      </button>
                    </div>

                    {/* Login Activity */}
                    <div style={{ padding: '14px 18px' }}>
                      <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: R.textPrimary, fontFamily: R.fontBody }}>
                        Login Activity
                      </p>
                      {sessionsLoading && (
                        <p style={{ margin: 0, fontSize: 13, color: R.textMuted, fontFamily: R.fontBody }}>Loading…</p>
                      )}
                      {!sessionsLoading && sessions && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {sessions.map(s => (
                            <div
                              key={s.id}
                              style={{
                                background: R.bgPage, borderRadius: 10,
                                padding: '12px 14px', border: `1px solid ${R.border}`,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{
                                    margin: 0, fontSize: 13, fontWeight: 600,
                                    color: R.textPrimary, fontFamily: R.fontBody,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}>
                                    {s.device_info ? s.device_info.substring(0, 55) : 'Unknown device'}
                                  </p>
                                  <p style={{ margin: '3px 0 0', fontSize: 12, color: R.textMuted, fontFamily: R.fontBody }}>
                                    {s.city && s.country ? `${s.city}, ${s.country}` : 'Location unavailable'}
                                  </p>
                                </div>
                                {s.is_current && (
                                  <span style={{
                                    flexShrink: 0, background: R.greenBg, color: R.greenText,
                                    fontSize: 11, fontWeight: 700, padding: '2px 8px',
                                    borderRadius: 999, fontFamily: R.fontBody,
                                  }}>
                                    Current
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {sessions.some(s => !s.is_current) && (
                            <button
                              onClick={signOutOthers}
                              style={{ ...btnSecondary, width: '100%', marginTop: 4 }}
                            >
                              Sign out of all other devices
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── PRIVACY TAB ── */}
                {tab === 'privacy' && (
                  <div style={{ padding: '14px 18px' }}>
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="ph ph-shield-check" style={{ fontSize: 18, color: R.navy }} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: R.textPrimary, fontFamily: R.fontBody }}>
                          Privacy Policy
                        </span>
                      </div>
                      <i className="ph ph-arrow-square-out" style={{ fontSize: 16, color: R.textMuted }} />
                    </a>
                  </div>
                )}

                {/* ── Delete Account ── always visible below tabs ── */}
                <div style={{ padding: '12px 18px', borderTop: `1px solid ${R.border}` }}>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 0, color: '#dc2626',
                      fontSize: 13, fontWeight: 600, fontFamily: R.fontBody,
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Delete Account Modal ── */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 20px',
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '28px 24px',
            width: '100%', maxWidth: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <i className="ph ph-warning" style={{ fontSize: 22, color: '#dc2626' }} />
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, fontFamily: R.fontSans, color: R.textPrimary }}>
                Delete Account
              </h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: R.textSecondary, fontFamily: R.fontBody, lineHeight: 1.6 }}>
              This will permanently delete your account in 30 days. This cannot be undone.
            </p>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="Type DELETE to confirm"
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            {deleteError && (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#dc2626' }}>{deleteError}</p>
            )}
            <button
              onClick={deleteAccount}
              disabled={deleteInput !== 'DELETE' || deleteLoading}
              style={{
                width: '100%', border: 'none', borderRadius: 10, padding: '13px',
                fontSize: 14, fontWeight: 700, fontFamily: R.fontBody, marginBottom: 10,
                background: deleteInput === 'DELETE' ? '#dc2626' : '#f0f0f0',
                color: deleteInput === 'DELETE' ? '#fff' : '#bbb',
                cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {deleteLoading ? 'Deleting…' : 'Delete My Account'}
            </button>
            <button
              onClick={() => { setShowDeleteModal(false); setDeleteInput(''); setDeleteError(''); }}
              style={{ ...btnSecondary, width: '100%' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
