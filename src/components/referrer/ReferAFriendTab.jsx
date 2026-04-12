import { useState, useEffect } from 'react';
import { Copy, DownloadSimple, Phone, Envelope, ShareNetwork, GlobeSimple } from '@phosphor-icons/react';
import { R } from '../../constants/theme';
import { CONTRACTOR_CONFIG, BACKEND_URL } from '../../config/contractor';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import Skeleton from '../shared/Skeleton';

// ─── Refer a Friend ───────────────────────────────────────────────────────────
export default function ReferAFriendTab({ userName, token }) {
  const firstName = userName ? userName.split(' ')[0] : 'there';

  const [inviteUrl, setInviteUrl]         = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [linkLoading, setLinkLoading]     = useState(true);
  const [linkError, setLinkError]         = useState(false);
  const [copied, setCopied]               = useState(false);
  const [contactCopied, setContactCopied] = useState(false);

  const fetchInviteLink = () => {
    setLinkLoading(true);
    setLinkError(false);
    fetch(`${BACKEND_URL}/api/referrer/my-invite-link`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.fullUrl) {
          setInviteUrl(data.fullUrl);
          setQrCodeDataUrl(data.qrCodeDataUrl || null);
        } else {
          setLinkError(true);
        }
      })
      .catch(() => setLinkError(true))
      .finally(() => setLinkLoading(false));
  };

  useEffect(() => {
    fetchInviteLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      navigator.share({
        title: `Join ${CONTRACTOR_CONFIG.name}'s rewards program`,
        text: `Sign up and start earning rewards for referring friends to ${CONTRACTOR_CONFIG.name}!`,
        url: inviteUrl,
      });
    } else {
      handleCopyLink();
    }
  };

  const handleSaveQr = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = 'my-referral-qr.png';
    a.click();
  };

  const handleShareContact = () => {
    const lines = [CONTRACTOR_CONFIG.name];
    if (CONTRACTOR_CONFIG.phone) lines.push(`📞 ${CONTRACTOR_CONFIG.phone}`);
    if (CONTRACTOR_CONFIG.email) lines.push(`✉️ ${CONTRACTOR_CONFIG.email}`);
    if (CONTRACTOR_CONFIG.website) lines.push(`🌐 ${CONTRACTOR_CONFIG.website}`);
    const text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: CONTRACTOR_CONFIG.name, text });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setContactCopied(true);
        setTimeout(() => setContactCopied(false), 2000);
      });
    }
  };

  const phoneDigits = CONTRACTOR_CONFIG.phone
    ? CONTRACTOR_CONFIG.phone.replace(/\D/g, '')
    : '';

  return (
    <Screen>
      <div style={{ padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Section 1: Header ── */}
        <AnimCard delay={0}>
          <h2 style={{
            fontFamily: R.fontSans, fontSize: 22, fontWeight: 700,
            color: R.navy, margin: '0 0 8px', lineHeight: 1.3,
          }}>
            Hey {firstName}, know someone who needs a new roof?
          </h2>
          <p style={{
            fontFamily: R.fontBody, fontSize: 14, color: R.textMuted,
            margin: 0, lineHeight: 1.6,
          }}>
            Share your personal invite link or QR code — when they sign up and become a customer, you earn a cash bonus.
          </p>
        </AnimCard>

        {/* ── Section 2: QR Code + invite link card ── */}
        <AnimCard delay={100}>
          <div style={{
            background: R.bgCard, borderRadius: 16, border: `1.5px solid ${R.navy}`,
            boxShadow: R.shadowMd, padding: '24px 20px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            {linkLoading && (
              <Skeleton width="180px" height="180px" borderRadius="12px" style={{ background: 'rgba(1,40,84,0.08)' }} />
            )}

            {!linkLoading && linkError && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ fontFamily: R.fontBody, fontSize: 14, color: R.red, margin: '0 0 12px' }}>
                  Could not load your invite link. Please try again.
                </p>
                <button
                  onClick={fetchInviteLink}
                  style={{
                    background: R.navy, color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 20px', fontFamily: R.fontSans,
                    fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {!linkLoading && !linkError && inviteUrl && (
              <>
                {qrCodeDataUrl && (
                  <>
                    <img
                      src={qrCodeDataUrl}
                      alt="Your personal referral QR code"
                      style={{ width: 180, height: 180, display: 'block' }}
                    />
                    <p style={{
                      fontFamily: R.fontBody, fontSize: 12, color: R.textMuted,
                      margin: 0, letterSpacing: 0.2,
                    }}>
                      Your personal referral QR code
                    </p>
                  </>
                )}

                {/* Invite URL copyable field */}
                <div style={{
                  width: '100%', background: R.bgPage,
                  border: `1.5px solid ${R.border}`,
                  borderRadius: 10, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <p style={{
                    fontFamily: R.fontMono, fontSize: 12, color: R.textSecondary,
                    margin: 0, flex: 1, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {inviteUrl}
                  </p>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      background: 'none', border: 'none', padding: 4,
                      cursor: 'pointer', lineHeight: 0, flexShrink: 0,
                    }}
                    aria-label="Copy invite link"
                  >
                    <Copy size={18} color={copied ? '#2D8B5F' : R.navy} weight="bold" />
                  </button>
                </div>
                {copied && (
                  <p style={{ fontFamily: R.fontBody, fontSize: 12, color: '#2D8B5F', margin: '-4px 0 0', alignSelf: 'flex-start' }}>
                    Link copied!
                  </p>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button
                    onClick={handleShare}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, background: R.red, color: '#fff',
                      border: 'none', borderRadius: 10, padding: '12px 0',
                      fontFamily: R.fontSans, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    <ShareNetwork size={16} weight="bold" />
                    Share Link
                  </button>
                  <button
                    onClick={handleSaveQr}
                    disabled={!qrCodeDataUrl}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, background: R.navy, color: '#fff',
                      border: 'none', borderRadius: 10, padding: '12px 0',
                      fontFamily: R.fontSans, fontWeight: 600, fontSize: 14,
                      cursor: qrCodeDataUrl ? 'pointer' : 'default',
                      opacity: qrCodeDataUrl ? 1 : 0.5,
                    }}
                  >
                    <DownloadSimple size={16} weight="bold" />
                    Save QR
                  </button>
                </div>
              </>
            )}
          </div>
        </AnimCard>

        {/* ── Section 3: How it works ── */}
        <AnimCard delay={200}>
          <h3 style={{ fontFamily: R.fontSans, fontSize: 16, fontWeight: 700, color: R.navy, margin: '0 0 10px' }}>
            How it works
          </h3>
          <div style={{ background: R.bgCard, borderRadius: 16, boxShadow: R.shadow, overflow: 'hidden' }}>
            {[
              { n: 1, title: 'Share your link', desc: 'Send your personal invite link or show your QR code in person.' },
              { n: 2, title: 'They get an inspection', desc: 'Accent Roofing reaches out to schedule a free roof inspection.' },
              { n: 3, title: 'You earn cash', desc: 'When the job is sold and paid, your bonus hits your balance.' },
            ].map((step, i) => (
              <div
                key={step.n}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '16px 18px',
                  borderBottom: i < 2 ? `1px solid ${R.border}` : 'none',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: R.red, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: R.fontSans, fontWeight: 700, fontSize: 13,
                  flexShrink: 0, marginTop: 1,
                }}>
                  {step.n}
                </div>
                <div>
                  <p style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 14, color: R.textPrimary, margin: '0 0 3px' }}>{step.title}</p>
                  <p style={{ fontFamily: R.fontBody, fontSize: 13, color: R.textSecondary, margin: 0, lineHeight: 1.5 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimCard>

        {/* ── Section 4: Contact fallback ── */}
        <AnimCard delay={300}>
          <h3 style={{ fontFamily: R.fontSans, fontSize: 14, fontWeight: 600, color: R.textSecondary, margin: '0 0 10px' }}>
            Prefer to refer the old-fashioned way?
          </h3>
          <div style={{ background: R.bgCard, borderRadius: 16, boxShadow: R.shadow, overflow: 'hidden', position: 'relative' }}>
            <button
              onClick={handleShareContact}
              style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', padding: 6, cursor: 'pointer', lineHeight: 0 }}
              aria-label="Share contact info"
            >
              <ShareNetwork size={20} color="#012854" />
            </button>
            {contactCopied && (
              <span style={{ position: 'absolute', top: 12, right: 38, fontFamily: R.fontBody, fontSize: 12, color: R.textMuted }}>
                Copied!
              </span>
            )}
            {CONTRACTOR_CONFIG.phone && (
              <a
                href={`tel:${phoneDigits}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '15px 18px', textDecoration: 'none',
                  borderBottom: (CONTRACTOR_CONFIG.email || CONTRACTOR_CONFIG.website) ? `1px solid ${R.border}` : 'none',
                }}
              >
                <Phone size={20} color={R.navy} weight="duotone" />
                <span style={{ fontFamily: R.fontBody, fontSize: 15, color: R.textPrimary }}>{CONTRACTOR_CONFIG.phone}</span>
              </a>
            )}
            {CONTRACTOR_CONFIG.email && (
              <a
                href={`mailto:${CONTRACTOR_CONFIG.email}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '15px 18px', textDecoration: 'none',
                  borderBottom: CONTRACTOR_CONFIG.website ? `1px solid ${R.border}` : 'none',
                }}
              >
                <Envelope size={20} color={R.navy} weight="duotone" />
                <span style={{ fontFamily: R.fontBody, fontSize: 15, color: R.textPrimary }}>{CONTRACTOR_CONFIG.email}</span>
              </a>
            )}
            {CONTRACTOR_CONFIG.website && (
              <a
                href={`https://${CONTRACTOR_CONFIG.website}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', textDecoration: 'none' }}
              >
                <GlobeSimple size={20} color={R.navy} weight="duotone" />
                <span style={{ fontFamily: R.fontBody, fontSize: 15, color: R.textPrimary }}>{CONTRACTOR_CONFIG.website}</span>
              </a>
            )}
          </div>
        </AnimCard>

      </div>
    </Screen>
  );
}
