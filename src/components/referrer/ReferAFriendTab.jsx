import { useState, useEffect } from 'react';
import { Copy, DownloadSimple, Phone, Envelope, ShareNetwork, GlobeSimple } from '@phosphor-icons/react';
import { R } from '../../constants/theme';
import { statusVar, STATUS_BANNER, STATUS_TINT } from '../../constants/statusTheme';
import { elevationVar } from '../../constants/elevationTheme';

// â”€â”€â”€ PALETTE-6 â€” THE RENDER TOKENS THIS TAB PAINTS WITH â”€â”€â”€
// âš  EVERY FALLBACK IS THE VALUE THE PROVIDER ACTUALLY MOUNTS FOR THE PLATFORM
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
// âš  AND ITS GROUND AND ITS PARENTS ARE BOTH CHECKED (M.5). Palette-5 found a
// money span nested inside a muted paragraph inheriting 0.72 down to 3.29:1 â€”
// every element's own declaration correct, the composited pair wrong. Nothing
// below puts a non-muted child inside a muted parent.
const MUTED = 0.72;

import { BACKEND_URL } from '../../config/contractor';
import { useBranding } from '../shared/ThemeProvider';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import Skeleton from '../shared/Skeleton';

// ─── Refer a Friend ───────────────────────────────────────────────────────────
export default function ReferAFriendTab({ userName, token }) {
  const branding = useBranding();
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
        title: `Join ${branding.companyName}'s rewards program`,
        text: `Sign up and start earning rewards for referring friends to ${branding.companyName}!`,
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
    const lines = [branding.companyName];
    if (branding.phone) lines.push(`📞 ${branding.phone}`);
    if (branding.email) lines.push(`✉️ ${branding.email}`);
    if (branding.website) lines.push(`🌐 ${branding.website}`);
    const text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: branding.companyName, text });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setContactCopied(true);
        setTimeout(() => setContactCopied(false), 2000);
      });
    }
  };

  const phoneDigits = branding.phone
    ? branding.phone.replace(/\D/g, '')
    : '';

  return (
    <Screen>
      <div style={{ padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Section 1: Header ── */}
        <AnimCard delay={0}>
          <h2 style={{
            fontFamily: R.fontSans, fontSize: 22, fontWeight: 700,
            color: TEXT, margin: '0 0 8px', lineHeight: 1.3,
          }}>
            Hey {firstName}, know someone who needs a new roof?
          </h2>
          <p style={{
            fontFamily: R.fontBody, fontSize: 14, color: TEXT, opacity: MUTED,
            margin: 0, lineHeight: 1.6,
          }}>
            Share your personal invite link or QR code — when they sign up and become a customer, you earn a cash bonus.
          </p>
        </AnimCard>

        {/* ── Section 2: QR Code + invite link card ── */}
        <AnimCard delay={100}>
          <div style={{
            background: SURFACE, borderRadius: 16, border: `1.5px solid ${SECONDARY}`,
            boxShadow: elevationVar('shadowMd'), padding: '24px 20px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            {linkLoading && (
              <Skeleton width="180px" height="180px" borderRadius="12px" />
            )}

            {!linkLoading && linkError && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ fontFamily: R.fontBody, fontSize: 14, color: statusVar('dangerText'), margin: '0 0 12px' }}>
                  Could not load your invite link. Please try again.
                </p>
                <button
                  onClick={fetchInviteLink}
                  style={{
                    background: SECONDARY, color: ON_SECONDARY, border: 'none',
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
                      fontFamily: R.fontBody, fontSize: 12, color: TEXT, opacity: MUTED,
                      margin: 0, letterSpacing: 0.2,
                    }}>
                      Your personal referral QR code
                    </p>
                  </>
                )}

                {/* Invite URL copyable field */}
                <div style={{
                  width: '100%', background: RECESS,
                  border: `1.5px solid ${elevationVar('border')}`,
                  borderRadius: 10, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <p style={{
                    fontFamily: R.fontMono, fontSize: 12, color: TEXT, opacity: MUTED,
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
                    {/* ⚠ THE PHOSPHOR `color` PROP IS DROPPED (Palette-4a): a var() in an SVG
                        PRESENTATION ATTRIBUTE is not something to bet a glyph on. Phosphor
                        defaults to currentColor, so the parent's CSS colour reaches it. */}
                    <span style={{ display: 'flex', color: copied ? statusVar('successText') : TEXT }}>
                      <Copy size={18} weight="bold" />
                    </span>
                  </button>
                </div>
                {copied && (
                  <p style={{ fontFamily: R.fontBody, fontSize: 12, color: statusVar('successText'), margin: '-4px 0 0', alignSelf: 'flex-start' }}>
                    Link copied!
                  </p>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button
                    onClick={handleShare}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, background: PRIMARY, color: ON_PRIMARY,
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
                      gap: 6, background: SECONDARY, color: ON_SECONDARY,
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
          <h3 style={{ fontFamily: R.fontSans, fontSize: 16, fontWeight: 700, color: TEXT, margin: '0 0 10px' }}>
            How it works
          </h3>
          <div style={{ background: SURFACE, borderRadius: 16, boxShadow: elevationVar('shadow'), overflow: 'hidden' }}>
            {[
              { n: 1, title: 'Share your link', desc: 'Send your personal invite link or show your QR code in person.' },
              { n: 2, title: 'They get an inspection', desc: `${branding.companyName} reaches out to schedule a free roof inspection.` },
              { n: 3, title: 'You earn cash', desc: 'When the job is sold and paid, your bonus hits your balance.' },
            ].map((step, i) => (
              <div
                key={step.n}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '16px 18px',
                  borderBottom: i < 2 ? `1px solid ${elevationVar('border')}` : 'none',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: PRIMARY, color: ON_PRIMARY,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: R.fontSans, fontWeight: 700, fontSize: 13,
                  flexShrink: 0, marginTop: 1,
                }}>
                  {step.n}
                </div>
                <div>
                  <p style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 14, color: TEXT, margin: '0 0 3px' }}>{step.title}</p>
                  <p style={{ fontFamily: R.fontBody, fontSize: 13, color: TEXT, opacity: MUTED, margin: 0, lineHeight: 1.5 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimCard>

        {/* ── Section 4: Contact fallback ── */}
        <AnimCard delay={300}>
          <h3 style={{ fontFamily: R.fontSans, fontSize: 14, fontWeight: 600, color: TEXT, opacity: MUTED, margin: '0 0 10px' }}>
            Prefer to refer the old-fashioned way?
          </h3>
          <div style={{ background: SURFACE, borderRadius: 16, boxShadow: elevationVar('shadow'), overflow: 'hidden', position: 'relative' }}>
            <button
              onClick={handleShareContact}
              style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', padding: 6, cursor: 'pointer', lineHeight: 0 }}
              aria-label="Share contact info"
            >
              <span style={{ display: 'flex', color: TEXT }}><ShareNetwork size={20} /></span>
            </button>
            {contactCopied && (
              <span style={{ position: 'absolute', top: 12, right: 38, fontFamily: R.fontBody, fontSize: 12, color: TEXT, opacity: MUTED }}>
                Copied!
              </span>
            )}
            {branding.phone && (
              <a
                href={`tel:${phoneDigits}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '15px 18px', textDecoration: 'none',
                  borderBottom: (branding.email || branding.website) ? `1px solid ${elevationVar('border')}` : 'none',
                }}
              >
                <span style={{ display: 'flex', color: TEXT }}><Phone size={20} weight="duotone" /></span>
                <span style={{ fontFamily: R.fontBody, fontSize: 15, color: TEXT }}>{branding.phone}</span>
              </a>
            )}
            {branding.email && (
              <a
                href={`mailto:${branding.email}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '15px 18px', textDecoration: 'none',
                  borderBottom: branding.website ? `1px solid ${elevationVar('border')}` : 'none',
                }}
              >
                <span style={{ display: 'flex', color: TEXT }}><Envelope size={20} weight="duotone" /></span>
                <span style={{ fontFamily: R.fontBody, fontSize: 15, color: TEXT }}>{branding.email}</span>
              </a>
            )}
            {branding.website && (
              <a
                href={`https://${branding.website}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', textDecoration: 'none' }}
              >
                <span style={{ display: 'flex', color: TEXT }}><GlobeSimple size={20} weight="duotone" /></span>
                <span style={{ fontFamily: R.fontBody, fontSize: 15, color: TEXT }}>{branding.website}</span>
              </a>
            )}
          </div>
        </AnimCard>

      </div>
    </Screen>
  );
}
