import { useState, useEffect } from 'react';
import { Lock, DownloadSimple, Phone, Envelope, ShareNetwork, GlobeSimple } from '@phosphor-icons/react';
import { R } from '../../constants/theme';
import { CONTRACTOR_CONFIG, BACKEND_URL } from '../../config/contractor';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';

// ─── Refer a Friend ───────────────────────────────────────────────────────────
export default function ReferAFriendTab({ userName, token }) {
  const firstName = userName ? userName.split(' ')[0] : 'there';

  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(false);
  const [shareLinkTapped, setShareLinkTapped] = useState(false);

  const fetchQrCode = () => {
    setQrLoading(true);
    setQrError(false);
    fetch(`${BACKEND_URL}/api/referrer/qr-code`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.qrCodeDataUrl) {
          setQrCodeDataUrl(data.qrCodeDataUrl);
        } else {
          setQrError(true);
        }
      })
      .catch(() => setQrError(true))
      .finally(() => setQrLoading(false));
  };

  useEffect(() => {
    fetchQrCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveQr = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = 'my-referral-qr.png';
    a.click();
  };

  const buildShareText = () => {
    const lines = [CONTRACTOR_CONFIG.name];
    if (CONTRACTOR_CONFIG.phone) lines.push(`📞 ${CONTRACTOR_CONFIG.phone}`);
    if (CONTRACTOR_CONFIG.email) lines.push(`✉️ ${CONTRACTOR_CONFIG.email}`);
    if (CONTRACTOR_CONFIG.website) lines.push(`🌐 ${CONTRACTOR_CONFIG.website}`);
    return lines.join('\n');
  };

  const handleShare = () => {
    const text = buildShareText();
    if (navigator.share) {
      navigator.share({ title: CONTRACTOR_CONFIG.name, text });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
            Share your personal QR code or link — when they become a customer, you earn a cash bonus.
          </p>
        </AnimCard>

        {/* ── Section 2: QR Code card ── */}
        <AnimCard delay={100}>
          <div style={{
            background: R.bgCard, borderRadius: 16, border: `1.5px solid ${R.navy}`,
            boxShadow: R.shadowMd, padding: '24px 20px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            {qrLoading && (
              <div style={{
                width: 180, height: 180, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `3px solid ${R.navy}`,
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {!qrLoading && qrError && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{
                  fontFamily: R.fontBody, fontSize: 14, color: R.red,
                  margin: '0 0 12px',
                }}>
                  Could not load your QR code. Please try again.
                </p>
                <button
                  onClick={fetchQrCode}
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

            {!qrLoading && !qrError && qrCodeDataUrl && (
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
                  Your personal referral code
                </p>
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button
                    onClick={() => setShareLinkTapped(true)}
                    disabled
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, background: R.red, opacity: 0.5, color: '#fff',
                      border: 'none', borderRadius: 10, padding: '12px 0',
                      fontFamily: R.fontSans, fontWeight: 600, fontSize: 14, cursor: 'not-allowed',
                    }}
                  >
                    <Lock size={16} weight="bold" />
                    Share Link
                  </button>
                  <button
                    onClick={handleSaveQr}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, background: R.navy, color: '#fff',
                      border: 'none', borderRadius: 10, padding: '12px 0',
                      fontFamily: R.fontSans, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    <DownloadSimple size={16} weight="bold" />
                    Save QR
                  </button>
                </div>
                {shareLinkTapped && (
                  <p style={{
                    fontFamily: R.fontBody, fontSize: 13, color: R.textSecondary,
                    margin: 0, textAlign: 'center', lineHeight: 1.5,
                  }}>
                    Share link coming soon — use your QR code for now!
                  </p>
                )}
              </>
            )}
          </div>
        </AnimCard>

        {/* ── Section 3: How it works ── */}
        <AnimCard delay={200}>
          <h3 style={{
            fontFamily: R.fontSans, fontSize: 16, fontWeight: 700,
            color: R.navy, margin: '0 0 10px',
          }}>
            How it works
          </h3>
          <div style={{
            background: R.bgCard, borderRadius: 16,
            boxShadow: R.shadow, overflow: 'hidden',
          }}>
            {[
              {
                n: 1,
                title: 'Share your code',
                desc: 'Show someone your QR code in person or send them your link.',
              },
              {
                n: 2,
                title: 'They get an inspection',
                desc: 'Accent Roofing reaches out to schedule a free roof inspection.',
              },
              {
                n: 3,
                title: 'You earn cash',
                desc: 'When the job is sold and paid, your bonus hits your balance.',
              },
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
                  width: 28, height: 28, borderRadius: '50%',
                  background: R.red, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: R.fontSans, fontWeight: 700, fontSize: 13,
                  flexShrink: 0, marginTop: 1,
                }}>
                  {step.n}
                </div>
                <div>
                  <p style={{
                    fontFamily: R.fontSans, fontWeight: 700, fontSize: 14,
                    color: R.textPrimary, margin: '0 0 3px',
                  }}>
                    {step.title}
                  </p>
                  <p style={{
                    fontFamily: R.fontBody, fontSize: 13, color: R.textSecondary,
                    margin: 0, lineHeight: 1.5,
                  }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </AnimCard>

        {/* ── Section 4: Contact fallback ── */}
        <AnimCard delay={300}>
          <h3 style={{
            fontFamily: R.fontSans, fontSize: 14, fontWeight: 600,
            color: R.textSecondary, margin: '0 0 10px',
          }}>
            Prefer to refer the old-fashioned way?
          </h3>
          <div style={{
            background: R.bgCard, borderRadius: 16,
            boxShadow: R.shadow, overflow: 'hidden',
            position: 'relative',
          }}>
            <button
              onClick={handleShare}
              style={{
                position: 'absolute', top: 10, right: 10,
                background: 'none', border: 'none', padding: 6,
                cursor: 'pointer', lineHeight: 0,
              }}
              aria-label="Share contact info"
            >
              <ShareNetwork size={20} color="#012854" />
            </button>
            {copied && (
              <span style={{
                position: 'absolute', top: 12, right: 38,
                fontFamily: R.fontBody, fontSize: 12, color: R.textMuted,
              }}>
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
                <span style={{
                  fontFamily: R.fontBody, fontSize: 15,
                  color: R.textPrimary,
                }}>
                  {CONTRACTOR_CONFIG.phone}
                </span>
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
                <span style={{
                  fontFamily: R.fontBody, fontSize: 15,
                  color: R.textPrimary,
                }}>
                  {CONTRACTOR_CONFIG.email}
                </span>
              </a>
            )}
            {CONTRACTOR_CONFIG.website && (
              <a
                href={`https://${CONTRACTOR_CONFIG.website}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '15px 18px', textDecoration: 'none',
                }}
              >
                <GlobeSimple size={20} color={R.navy} weight="duotone" />
                <span style={{
                  fontFamily: R.fontBody, fontSize: 15,
                  color: R.textPrimary,
                }}>
                  {CONTRACTOR_CONFIG.website}
                </span>
              </a>
            )}
          </div>
        </AnimCard>

      </div>
    </Screen>
  );
}
