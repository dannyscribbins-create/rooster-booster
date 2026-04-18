import { useState, useEffect } from 'react';
import { ShareNetwork, X, Lock, DownloadSimple } from '@phosphor-icons/react';
import { R } from '../../constants/theme';
import { BOOST_TABLE, getNextPayout } from '../../constants/boostSchedule';
import { CONTRACTOR_CONFIG, BACKEND_URL } from '../../config/contractor';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import StatusBadge from '../shared/StatusBadge';
import AvatarCircle from '../shared/AvatarCircle';
import Skeleton from '../shared/Skeleton';
import ContractorAboutModal from './ContractorAboutModal';
import BookingFormModal from './BookingFormModal';

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({ setTab, pipeline, loading, pipelineRateLimited, userName, balance, paidCount, profilePhoto, showReviewCard, onDismissReview, sessionToken, onViewAllReferrals }) {
  const soldCount = paidCount;
  const nextPayout = getNextPayout(soldCount);
  const progressPct = Math.min((soldCount / 7) * 100, 100);
  const [barAnimated, setBarAnimated] = useState(false);

  const [aboutData, setAboutData]           = useState(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);

  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [shareLinkTapped, setShareLinkTapped] = useState(false);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setBarAnimated(true), 400);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // Fetch About Us data on mount
  useEffect(() => {
    if (!sessionToken) return;
    fetch(`${BACKEND_URL}/api/referrer/about`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then(r => r.json())
      .then(d => {
        if (!d || !d.enabled) { setAboutData(null); return; }
        setAboutData(d);
        if (d.booking_submitted) setBookingSubmitted(true);
      })
      .catch(() => setAboutData(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-show About Us modal on first visit
  useEffect(() => {
    if (aboutData && !aboutData.about_modal_seen) {
      setShowAboutModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aboutData]);

  function markAboutModalSeen() {
    if (!sessionToken) return;
    fetch(`${BACKEND_URL}/api/referrer/about/seen`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}` },
    }).catch(() => {});
  }

  function handleAboutContinue() {
    markAboutModalSeen();
    setShowAboutModal(false);
  }

  function handleAboutBook() {
    markAboutModalSeen();
    setShowAboutModal(false);
    setShowBookingModal(true);
  }

  useEffect(() => {
    if (!showQRModal) return;
    setQrLoading(true);
    setQrError(false);
    fetch(`${BACKEND_URL}/api/referrer/qr-code`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_token')}` },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQRModal]);

  const handleSaveQr = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = 'my-referral-qr.png';
    a.click();
  };

  const closeModal = () => {
    setShowQRModal(false);
    setShareLinkTapped(false);
  };

  return (
    <Screen>
      {/* Hero header — navy gradient with brand feel */}
      <div style={{
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
        padding: "52px 24px 32px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circles — your gradient element, rebranded */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 180, height: 180, borderRadius: "50%",
          background: "rgba(211,227,240,0.12)",
        }} />
        <div style={{
          position: "absolute", top: 20, right: 40,
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(211,227,240,0.08)",
        }} />
        <div style={{
          position: "absolute", bottom: -20, left: -20,
          width: 120, height: 120, borderRadius: "50%",
          background: "rgba(204,0,0,0.12)",
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, color: "rgba(255,255,255,0.65)" }}>
              Hey, {userName.split(" ")[0]}! 👋
            </p>
            <h1 style={{
              margin: "4px 0 0", fontSize: 22, fontWeight: 800,
              fontFamily: R.fontSans, color: "#fff",
              letterSpacing: "-0.02em",
            }}>Your Dashboard</h1>
          </div>
          <AvatarCircle
            userName={userName}
            profilePhoto={profilePhoto}
            size={44}
            shadow="0 0 0 3px rgba(255,255,255,0.2)"
            showCameraHint={false}
          />
        </div>

        {/* Balance card — floats on the hero */}
        <AnimCard delay={100} screenKey="dashboard" style={{ marginTop: 24 }}>
          <div style={{
            background: R.bgCard, borderRadius: 18,
            padding: "24px 24px 16px",
            boxShadow: R.shadowLg,
          }}>
            <p style={{
              margin: 0, fontSize: 12, color: R.textMuted,
              fontFamily: R.fontMono, letterSpacing: "0.12em", textTransform: "uppercase",
            }}>Available Balance</p>

            {loading ? (
              <div style={{ margin: "10px 0 6px" }}>
                <Skeleton height="52px" borderRadius="8px" style={{ marginBottom: 8 }} />
                <Skeleton width="60%" height="14px" borderRadius="6px" />
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, margin: "6px 0 4px" }}>
                  <span style={{ fontSize: 32, color: R.red, fontFamily: R.fontMono, fontWeight: 700, lineHeight: 1 }}>$</span>
                  <span style={{
                    fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em",
                    fontFamily: R.fontSans, color: R.navy, lineHeight: 1,
                  }}>
                    {balance.toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: R.textSecondary }}>
                  {soldCount} sold referral{soldCount !== 1 ? "s" : ""} this year ·{" "}
                  Next: <span style={{ color: R.red, fontWeight: 700 }}>${nextPayout.total}</span>
                </p>
              </>
            )}

            <button onClick={() => setTab("cashout")} style={{
              marginTop: 16, width: "100%",
              background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
              border: "none", borderRadius: 10, padding: "13px 24px",
              color: "#fff", fontSize: 15, fontWeight: 700,
              fontFamily: R.fontSans, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              <i className="ph ph-money" style={{ fontSize: 17 }} />
              Cash Out Now
            </button>
          </div>
        </AnimCard>

        {/* Refer a Friend button */}
        <AnimCard delay={180} screenKey="dashboard" style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowQRModal(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, background: R.red, border: 'none', borderRadius: 12,
              padding: 16, color: '#fff', fontSize: 16, fontWeight: 700,
              fontFamily: R.fontSans, cursor: 'pointer',
            }}
          >
            <ShareNetwork size={20} weight="fill" />
            Refer a Friend
          </button>
        </AnimCard>
      </div>

      {/* 429 rate-limit notice — shown without clearing existing data */}
      {pipelineRateLimited && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{
            background: '#FFF8E1', border: '1px solid #F5C518',
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <i className="ph ph-warning" style={{ fontSize: 18, color: '#B8860B', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: '#7B5900', fontFamily: R.fontBody, lineHeight: 1.5 }}>
              Pipeline data is temporarily unavailable. Please wait a few minutes and try again.
            </p>
          </div>
        </div>
      )}

      {/* Booking Banner */}
      {aboutData?.booking_enabled && !bookingSubmitted && (
        <div style={{ padding: "16px 20px 0" }}>
          <AnimCard delay={200} screenKey="dashboard">
            <div style={{
              background: R.navy, borderRadius: 16, padding: '18px 20px',
              boxShadow: R.shadowLg,
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: R.fontSans }}>
                Book Your Free Inspection
              </p>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(211,227,240,0.75)', fontFamily: R.fontBody, lineHeight: 1.5 }}>
                Schedule your free roof inspection with {CONTRACTOR_CONFIG.name || 'us'} today.
              </p>
              <button
                onClick={() => setShowBookingModal(true)}
                style={{
                  background: R.red, border: 'none', borderRadius: 10, padding: '11px 20px',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  fontFamily: R.fontSans, cursor: 'pointer',
                }}
              >
                Book Now
              </button>
            </div>
          </AnimCard>
        </div>
      )}

      {/* Boost Progress Card */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={200} screenKey="dashboard">
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, padding: "18px 20px",
            boxShadow: R.shadow,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{
                  margin: 0, fontSize: 12, color: R.textMuted,
                  fontFamily: R.fontMono, letterSpacing: "0.1em", textTransform: "uppercase",
                }}>Boost Progress</p>
                <p style={{
                  margin: "4px 0 0", fontSize: 16, fontWeight: 800,
                  fontFamily: R.fontSans, color: R.navy,
                }}>
                  {soldCount} <span style={{ color: R.textSecondary, fontWeight: 400, fontSize: 15 }}>of 7 referrals</span>
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 12, color: R.textMuted, fontFamily: R.fontMono, textTransform: "uppercase" }}>Next Payout</p>
                <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, fontFamily: R.fontMono, color: R.red }}>${nextPayout.total}</p>
              </div>
            </div>

            {/* Animated progress bar */}
            <div style={{ background: R.bgBlueLight, borderRadius: 999, height: 8, overflow: "hidden" }}>
              <div style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(90deg, ${R.red} 0%, ${R.navy} 100%)`,
                borderRadius: 999,
                transform: barAnimated ? `scaleX(${progressPct / 100})` : "scaleX(0)",
                transformOrigin: "left",
                transition: "transform 1.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }} />
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: R.textSecondary }}>
              {soldCount < 7
                ? `${7 - soldCount} more sold deal${7 - soldCount !== 1 ? "s" : ""} to reach max boost — `
                : "Max boost reached — "}
              <span style={{ color: R.navy, fontWeight: 700 }}>
                {soldCount < 7 ? "$900/deal" : "$900/deal! 🎉"}
              </span>
            </p>
          </div>
        </AnimCard>
      </div>

      {/* Reward Schedule Table */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={280} screenKey="dashboard">
          <p style={{
            margin: "0 0 10px", fontSize: 12, color: R.textMuted,
            fontFamily: R.fontMono, letterSpacing: "0.1em", textTransform: "uppercase",
          }}>Reward Schedule</p>
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow,
          }}>
            {/* Header row */}
            <div style={{
              display: "flex", padding: "8px 16px",
              borderBottom: `1px solid ${R.border}`,
              background: R.bgCardTint,
            }}>
              {["Referral", "Base", "Boost", "Total"].map((h, i) => (
                <span key={h} style={{
                  flex: i === 0 ? 1.2 : 1, fontSize: 12, color: R.textMuted,
                  fontFamily: R.fontMono, textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textAlign: i === 3 ? "right" : i === 0 ? "left" : "center",
                }}>{h}</span>
              ))}
            </div>

            {BOOST_TABLE.map((row, i) => {
              const isCurrent = (i + 1) === soldCount;
              const isNext    = (i + 1) === soldCount + 1 || (soldCount >= 7 && i === 6);
              const isPast    = (i + 1) < soldCount;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", padding: "12px 16px",
                  borderBottom: i < BOOST_TABLE.length - 1 ? `1px solid ${R.border}` : "none",
                  background: isNext ? "#fff7f7" : "transparent",
                  borderLeft: isNext ? `3px solid ${R.red}` : "3px solid transparent",
                  opacity: isPast ? 0.4 : 1,
                  transition: "background 0.2s",
                }}>
                  <span style={{
                    flex: 1.2, fontSize: 15, fontWeight: 700,
                    color: isCurrent ? R.green : isNext ? R.red : R.textSecondary,
                    fontFamily: R.fontMono,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    {row.label}
                    {isCurrent && <span style={{ fontSize: 12, color: R.green, background: R.greenBg, padding: "2px 6px", borderRadius: 99 }}>✓ done</span>}
                    {isNext && <span style={{ fontSize: 12, color: R.red, background: "#fee2e2", padding: "2px 6px", borderRadius: 99 }}>next</span>}
                  </span>
                  <span style={{ flex: 1, fontSize: 15, color: R.textSecondary, fontFamily: R.fontMono, textAlign: "center" }}>${row.base}</span>
                  <span style={{
                    flex: 1, fontSize: 15, textAlign: "center",
                    color: row.boost > 0 ? R.red : R.textMuted,
                    fontFamily: R.fontMono, fontWeight: row.boost > 0 ? 700 : 400,
                  }}>
                    {row.boost > 0 ? `+$${row.boost}` : "—"}
                  </span>
                  <span style={{
                    flex: 1, fontSize: 15, fontWeight: 900, textAlign: "right",
                    color: isNext ? R.navy : R.textSecondary,
                    fontFamily: R.fontMono,
                  }}>${row.total}</span>
                </div>
              );
            })}
          </div>
          <p style={{
            margin: "8px 0 0", fontSize: 12, color: R.textMuted,
            fontFamily: R.fontMono, textAlign: "center",
          }}>
            * Qualifying roofs must be 28 squares or more. Resets Jan 1 each year.
          </p>
        </AnimCard>
      </div>

      {/* About Us Card */}
      {aboutData && (
        <div style={{ padding: "16px 20px 0" }}>
          <AnimCard delay={220} screenKey="dashboard">
            <div
              onClick={() => setShowAboutModal(true)}
              style={{
                background: R.bgCard, border: `1px solid ${R.border}`,
                borderRadius: 16, padding: '16px 20px',
                boxShadow: R.shadow, cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = R.shadowMd}
              onMouseLeave={e => e.currentTarget.style.boxShadow = R.shadow}
            >
              <p style={{ margin: '0 0 8px', fontSize: 12, color: R.textMuted, fontFamily: R.fontMono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                About {CONTRACTOR_CONFIG.name || 'Your Contractor'}
              </p>
              {aboutData.google_rating != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <i className="ph ph-star-fill" style={{ color: '#F5A623', fontSize: 14 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: R.navy, fontFamily: R.fontMono }}>
                    {aboutData.google_rating}
                  </span>
                  <span style={{ fontSize: 12, color: R.textSecondary }}>star rating on Google</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13, color: R.navy, fontWeight: 600, fontFamily: R.fontBody }}>Learn more</span>
                  <i className="ph ph-arrow-right" style={{ fontSize: 13, color: R.navy }} />
                </div>
                {!bookingSubmitted && (
                  <button
                    onClick={e => { e.stopPropagation(); setShowBookingModal(true); }}
                    style={{
                      background: R.red, border: 'none', borderRadius: 8,
                      padding: '6px 14px', color: '#fff',
                      fontSize: 12, fontWeight: 700,
                      fontFamily: R.fontSans, cursor: 'pointer',
                    }}
                  >
                    Book Now
                  </button>
                )}
              </div>
            </div>
          </AnimCard>
        </div>
      )}

      {/* Recent Referrals */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={360} screenKey="dashboard">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{
              margin: 0, fontSize: 12, color: R.textMuted,
              fontFamily: R.fontMono, letterSpacing: "0.1em", textTransform: "uppercase",
            }}>Recent Referrals</p>
            <button onClick={onViewAllReferrals} style={{
              background: "none", border: "none", cursor: "pointer",
              color: R.navy, fontSize: 12, fontFamily: R.fontMono, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              View all <i className="ph ph-arrow-right" style={{ fontSize: 15 }} />
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2].map(i => (
                <Skeleton key={i} height="62px" borderRadius="12px" />
              ))}
            </div>
          ) : pipeline.length === 0 ? (
            <div style={{
              background: R.bgCard, border: `1px solid ${R.border}`,
              borderRadius: 14, padding: "28px 20px", textAlign: "center",
              boxShadow: R.shadow,
            }}>
              <i className="ph ph-users" style={{ fontSize: 32, color: R.blueLight, display: "block", marginBottom: 8 }} />
              <p style={{ margin: 0, color: R.textSecondary, fontSize: 15 }}>
                No referrals yet — start sending names to earn rewards!
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pipeline.slice(0, 3).map((ref, idx) => (
                <AnimCard key={ref.id} delay={400 + idx * 60}>
                  <div style={{
                    background: R.bgCard, border: `1px solid ${R.border}`,
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    boxShadow: R.shadow,
                  }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = R.shadowMd}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = R.shadow}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: R.bgBlueLight, color: R.navy,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, fontFamily: R.fontMono, flexShrink: 0,
                      }}>
                        {ref.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: R.textPrimary }}>
                        {ref.name}
                      </p>
                    </div>
                    <StatusBadge status={ref.status} />
                  </div>
                </AnimCard>
              ))}
            </div>
          )}
        </AnimCard>
      </div>

      {/* Google Review Banner */}
      {showReviewCard && (
        <div style={{ padding: "16px 20px 0" }}>
          <AnimCard delay={600} screenKey="dashboard">
            <div style={{
              background: "#1a3a6b",
              border: "1px solid #041D3E",
              outline: "2px solid #ffffff",
              outlineOffset: "-4px",
              borderRadius: 16,
              padding: "18px 20px",
              boxShadow: R.shadow,
              display: "flex",
              alignItems: "center",
              gap: 16,
              position: "relative",
            }}>
              {/* Dismiss X */}
              <button
                onClick={onDismissReview}
                aria-label="Dismiss"
                style={{
                  position: "absolute", top: 10, right: 10,
                  background: "rgba(255,255,255,0.12)", border: "none",
                  borderRadius: "50%", width: 26, height: 26,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", padding: 0,
                }}
              >
                <i className="ph ph-x" aria-hidden="true" style={{ fontSize: 14, color: "#fff" }} />
              </button>
              <i className="ph ph-star-fill" aria-hidden="true" style={{
                fontSize: 32,
                color: "#ffffff",
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <p style={{
                  margin: "0 0 10px",
                  fontSize: 15,
                  color: "#D3E3F0",
                  fontFamily: R.fontBody,
                  lineHeight: 1.4,
                }}>
                  {CONTRACTOR_CONFIG.reviewMessage}
                </p>
                <button
                  onClick={() => window.open(CONTRACTOR_CONFIG.reviewUrl, '_blank', 'noopener,noreferrer')}
                  style={{
                    background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 16px",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: R.fontBody,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <i className="ph ph-star" aria-hidden="true" style={{ fontSize: 15 }} />
                  {CONTRACTOR_CONFIG.reviewButtonText}
                </button>
              </div>
            </div>
          </AnimCard>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* About Us Modal */}
      <ContractorAboutModal
        visible={showAboutModal}
        onContinue={handleAboutContinue}
        onBook={handleAboutBook}
        aboutData={aboutData}
      />

      {/* Booking Form Modal */}
      <BookingFormModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onBookingSuccess={() => setBookingSubmitted(true)}
        sessionToken={sessionToken}
      />

      {/* QR Code Modal */}
      {showQRModal && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', background: '#fff',
              borderRadius: '20px 20px 0 0',
              padding: '24px 24px env(safe-area-inset-bottom, 24px)',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}
          >
            {/* Top row */}
            <div style={{
              width: '100%', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 4,
            }}>
              <span style={{
                fontFamily: R.fontSans, fontSize: 18, fontWeight: 700, color: R.navy,
              }}>
                Your Referral QR Code
              </span>
              <button
                onClick={closeModal}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                <X size={22} color={R.navy} weight="bold" />
              </button>
            </div>

            {/* Spinner */}
            {qrLoading && (
              <div style={{
                width: 180, height: 180,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `3px solid ${R.navy}`, borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            )}

            {/* Error */}
            {!qrLoading && qrError && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ fontFamily: R.fontBody, fontSize: 14, color: R.red, margin: '0 0 12px' }}>
                  Could not load your QR code. Please try again.
                </p>
                <button
                  onClick={() => { setQrError(false); setShowQRModal(false); setTimeout(() => setShowQRModal(true), 50); }}
                  style={{
                    background: R.navy, color: '#fff', border: 'none', borderRadius: 8,
                    padding: '10px 20px', fontFamily: R.fontSans, fontWeight: 600,
                    fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* QR image + buttons */}
            {!qrLoading && !qrError && qrCodeDataUrl && (
              <>
                <img
                  src={qrCodeDataUrl}
                  alt="Your personal referral QR code"
                  style={{ width: 180, height: 180, display: 'block' }}
                />
                <p style={{
                  fontFamily: R.fontBody, fontSize: 12, color: R.textMuted,
                  margin: 0, textAlign: 'center',
                }}>
                  Scan to refer a friend
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
                    margin: 0, textAlign: 'center',
                  }}>
                    Share link coming soon!
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Screen>
  );
}
