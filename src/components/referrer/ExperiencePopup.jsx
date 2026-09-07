import { useState, useEffect, useRef } from 'react';
import { Star, SmileyMeh, CheckCircle, ShareNetwork } from '@phosphor-icons/react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import { useBranding } from '../shared/ThemeProvider';
import { safeAsync } from '../../utils/clientErrorReporter';
import { getReferrerToken } from '../../utils/authStorage';
import { statusVar } from '../../constants/statusTheme';
import { elevationVar } from '../../constants/elevationTheme';

// ─── PALETTE-11 B1 TOKENS ────────────────────────────────────────────────────
// ⚠ THE GROUND HERE IS `surface`, NOT the page. A modal sits on a SCRIM, and the
// scrim stays a literal on purpose: it dims whatever is behind the modal and is
// not a themed ground — tokenising it would claim the brand owns the dimming.
// ⚠ AND `--rm-recess` IS A SECOND GROUND INSIDE THE SAME MODAL where form fields
// are inset. A token floored against `surface` is NOT safe on `recess`; that is
// what took two ManageAccount icons to 2.68 and 2.89 last phase.
// ⚠ EVERY FALLBACK IS THE VALUE THE PROVIDER ACTUALLY MOUNTS for the platform
// brand. A plausible-looking substitute is R-1's defect.
const TEXT       = 'var(--rm-text, #1C2D4D)';
const SURFACE    = 'var(--rm-surface, #FFFFFF)';
const RECESS     = 'var(--rm-recess, #ECF0F8)';
const PRIMARY    = 'var(--rm-primary, #F26A1B)';
const ON_PRIMARY = 'var(--rm-on-primary, #000000)';
const MUTED = 0.72;

// ⚠ NO `onSuccess` TOKEN EXISTS. This is a literal WITH its measurement, the
// same shape as ManageAccount's ON_DANGER — but unlike that one it is not
// mode-blind, because the success FILL is the same hex in both modes.
const ON_SUCCESS = '#000000';

// ⚠ BOTH OF THESE WERE LIVE CONTRAST DEFECTS, FOUND BY MEASURING RATHER THAN
// BY READING. The amber star measured 2.15:1 on the white card against a
// GRAPHIC floor of 3, and the green fill carried a white label at 3.30:1
// against a TEXT floor of 4.5. Routed to the status system, which owns these.
const AMBER = "statusVar('warning')";
const GREEN = "statusVar('success')";

// Slide map (direction determines which content shows on slides 1 and 2):
//   0  — rating fork
//   1  — positive: review ask  |  negative: suggestion box
//   2  — positive: return ack (auto-advance)  |  negative: bad ack (terminal)
//   3  — positive: referral nudge
//   4  — positive: close (terminal)

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9000,
  padding: '0 16px',
};

const card = {
  background: SURFACE,
  borderRadius: 20,
  padding: '32px 28px',
  maxWidth: 360,
  width: '100%',
  boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
  position: 'relative',
  overflow: 'hidden',
};

function SlideRail({ slide, children }) {
  return (
    <div style={{ overflow: 'hidden', width: '100%' }}>
      <div style={{
        display: 'flex',
        transform: `translateX(${-slide * 100}%)`,
        transition: 'transform 0.3s ease',
      }}>
        {children}
      </div>
    </div>
  );
}

function SlidePanel({ children }) {
  return (
    <div style={{ minWidth: '100%', boxSizing: 'border-box' }}>
      {children}
    </div>
  );
}

export default function ExperiencePopup({ prompt, onDismiss }) {
  const branding = useBranding();
  const [slide,            setSlide]            = useState(0);
  const [direction,        setDirection]        = useState(null);
  const [text,             setText]             = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [error,            setError]            = useState(null);
  const [hasLeftForReview, setHasLeftForReview] = useState(false);
  const [copied,           setCopied]           = useState(false);
  const autoAdvanceTimer = useRef(null);
  const token = getReferrerToken();

  // Auto-advance return-acknowledgment screen after 2.5 s (good path only)
  useEffect(() => {
    if (slide === 2 && direction === 'positive') {
      autoAdvanceTimer.current = setTimeout(() => setSlide(3), 2500);
    }
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, direction]);

  // Detect app return after user taps Google review link
  useEffect(() => {
    if (!hasLeftForReview) return;
    function handleVisibility() {
      if (!document.hidden && hasLeftForReview) {
        setSlide(2);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLeftForReview]);

  // Fire-and-forget: mark modal as shown in pipeline_cache
  function markComplete() {
    ;(async () => {
      try {
        await fetch(`${BACKEND_URL}/api/referrer/post-job-sequence-complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // non-critical — failure silently ignored
      }
    })();
  }

  // Fire-and-forget: mark experience prompt as responded
  function markPromptResponded(responseType) {
    ;(async () => {
      try {
        await fetch(`${BACKEND_URL}/api/referrer/experience-prompt/${prompt.id}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ response_type: responseType }),
        });
      } catch {
        // non-critical
      }
    })();
  }

  function handleClose() {
    markComplete();
    onDismiss();
  }

  const handleLeaveReview = safeAsync(async () => {
    const reviewUrl = branding.reviewUrl;
    if (reviewUrl && reviewUrl !== '#') {
      window.open(reviewUrl, '_blank', 'noopener,noreferrer');
      setHasLeftForReview(true);
    } else {
      // No review URL configured — advance to return ack anyway
      setSlide(2);
    }
  });

  const handleFeedbackSubmit = safeAsync(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Write to dedicated feedback table
      const feedbackRes = await fetch(`${BACKEND_URL}/api/referrer/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text.trim() }),
      });
      if (!feedbackRes.ok) {
        const d = await feedbackRes.json().catch(() => ({}));
        setError(d.error || 'Something went wrong. Please try again.');
        return;
      }
      setSlide(2);
    } finally {
      setSubmitting(false);
    }
  });

  const handleShare = safeAsync(async () => {
    const referralLink = prompt.referral_link || window.location.origin;
    const message      = `I just finished my project with ${branding.companyName} and I'd like to introduce you to them. Download their app to learn more: ${referralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
      } catch {
        // user cancelled share or share failed — fall through to clipboard
      }
    } else {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError('Unable to copy — please copy your link manually.');
      }
    }
  });

  const responseBtn = {
    flex: '0 0 48%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '16px 8px',
    borderRadius: 12, border: `1.5px solid ${PRIMARY}`,
    background: SURFACE, cursor: 'pointer',
    fontFamily: R.fontBody,
  };

  // Terminal screens: show × close button
  const isTerminal = slide === 4 || (slide === 2 && direction === 'negative');

  return (
    <div style={overlay}>
      <div style={card}>
        {isTerminal && (
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              color: TEXT, fontSize: 22, lineHeight: 1, padding: '4px 6px',
              zIndex: 1,
            }}
          >×</button>
        )}

        <SlideRail slide={slide}>

          {/* ── Slide 0: Rating fork ─────────────────────────────────────────── */}
          <SlidePanel>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Star size={40} color={AMBER} weight="fill" />
            </div>
            <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: TEXT, textAlign: 'center', marginBottom: 10 }}>
              How'd everything go?
            </div>
            <div style={{ fontFamily: R.fontBody, fontSize: 14, color: TEXT, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
              Your feedback helps {branding.companyName} keep delivering great work.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button
                onClick={() => { setDirection('positive'); setSlide(1); }}
                style={responseBtn}
              >
                <span style={{ fontSize: 28 }}>😊</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>Great experience</span>
              </button>
              <button
                onClick={() => { setDirection('negative'); setSlide(1); }}
                style={responseBtn}
              >
                <span style={{ fontSize: 28 }}>😕</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>Could be better</span>
              </button>
            </div>
          </SlidePanel>

          {/* ── Slide 1: direction-sensitive ──────────────────────────────────── */}
          <SlidePanel>
            {direction === 'positive' ? (
              /* Slide 1 — Good path: Review ask */
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <Star size={40} color={AMBER} weight="fill" />
                </div>
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: TEXT, textAlign: 'center', marginBottom: 10 }}>
                  Mind sharing your experience?
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: TEXT, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
                  Reviews help other homeowners make a confident decision — and they mean a lot to the team.
                </div>
                {/* ⚠ NO DESTINATION, NO BUTTON (BR-2 Phase 2, R2). This rendered
                    unconditionally, and with no review URL `handleLeaveReview`
                    took its else branch and silently advanced the slide — a
                    button that looks like it does one thing and does another.
                    ⚠ `reviewUrl` DERIVES (`review_url || built from
                    google_place_id`), so this is only falsy for a contractor
                    with NEITHER. A check against review_url alone would still
                    hide the button from contractors who have a working Place ID.
                    ⚠ THE SLIDE STILL RENDERS AND STILL ADVANCES — "Skip for now"
                    below calls setSlide(3) directly, which is what makes hiding
                    this safe. Confirmed before the change, because if this had
                    been the only way forward, removing it would strand the user
                    on a slide with no exit — worse than the dead end it fixes.
                    MINIMAL BY RULING: the sequence is untouched and the full
                    treatment belongs to the Referral Conversion Engine. */}
                {branding.reviewUrl && (
                <button
                  onClick={handleLeaveReview}
                  disabled={hasLeftForReview}
                  style={{
                    display: 'block', width: '100%',
                    background: hasLeftForReview ? RECESS : PRIMARY,
                    color: hasLeftForReview ? TEXT : ON_PRIMARY,
                    opacity: hasLeftForReview ? MUTED : 1,
                    border: hasLeftForReview ? `1.5px solid ${elevationVar('border')}` : 'none',
                    borderRadius: 10,
                    padding: '14px', fontSize: 15, fontWeight: 600,
                    fontFamily: R.fontBody,
                    cursor: hasLeftForReview ? 'not-allowed' : 'pointer',
                    marginBottom: 14,
                  }}
                >
                  {hasLeftForReview ? 'Waiting for your return…' : 'Leave a Google Review'}
                </button>
                )}
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => setSlide(3)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: R.fontBody, fontSize: 14, color: TEXT,
                      textDecoration: 'underline', padding: '4px 8px',
                    }}
                  >Skip for now</button>
                </div>
              </>
            ) : (
              /* Slide 1 — Bad path: Suggestion box */
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <SmileyMeh size={40} color={TEXT} weight="fill" />
                </div>
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: TEXT, textAlign: 'center', marginBottom: 10 }}>
                  We're sorry to hear that.
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: TEXT, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
                  Your feedback helps us improve. What could we have done better?
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Tell us what happened or what we could do better..."
                  maxLength={2000}
                  rows={6}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    borderRadius: 10, border: `1.5px solid ${elevationVar('border')}`,
                    padding: '12px', fontFamily: R.fontBody, fontSize: 14,
                    color: TEXT, resize: 'vertical', outline: 'none',
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ fontSize: 12, color: TEXT, textAlign: 'right', marginBottom: 16, marginTop: 4 }}>
                  {text.length} / 2000
                </div>
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={!text.trim() || submitting}
                  style={{
                    display: 'block', width: '100%',
                    background: PRIMARY, color: ON_PRIMARY,
                    border: 'none', borderRadius: 10,
                    padding: '14px', fontSize: 15, fontWeight: 600,
                    fontFamily: R.fontBody,
                    cursor: (!text.trim() || submitting) ? 'not-allowed' : 'pointer',
                    opacity: (!text.trim() || submitting) ? 0.5 : 1,
                  }}
                >
                  {submitting ? 'Sending…' : 'Submit'}
                </button>
                {error && (
                  <div style={{ marginTop: 10, fontSize: 13, color: statusVar('dangerText'), textAlign: 'center' }}>
                    {error}
                  </div>
                )}
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button
                    onClick={() => setSlide(2)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: R.fontBody, fontSize: 14, color: TEXT,
                      textDecoration: 'underline', padding: '4px 8px',
                    }}
                  >Skip</button>
                </div>
              </>
            )}
          </SlidePanel>

          {/* ── Slide 2: direction-sensitive ──────────────────────────────────── */}
          <SlidePanel>
            {direction === 'positive' ? (
              /* Slide 2 — Good path: Return acknowledgment (auto-advances to slide 3) */
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 20, marginTop: 8 }}>
                  <CheckCircle size={40} color={GREEN} weight="fill" />
                </div>
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: TEXT, marginBottom: 10 }}>
                  Thank you! 🙏
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: TEXT, lineHeight: 1.5, marginBottom: 28 }}>
                  Taking the time to leave a review means the world to us — and helps other homeowners make a confident decision.
                </div>
                <button
                  onClick={() => {
                    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
                    setSlide(3);
                  }}
                  style={{
                    background: PRIMARY, color: ON_PRIMARY,
                    border: 'none', borderRadius: 10,
                    padding: '14px 32px', fontSize: 15, fontWeight: 600,
                    fontFamily: R.fontBody, cursor: 'pointer',
                  }}
                >Continue</button>
              </div>
            ) : (
              /* Slide 2 — Bad path: Acknowledgment (terminal) */
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 20, marginTop: 8 }}>
                  <CheckCircle size={40} color={GREEN} weight="fill" />
                </div>
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: TEXT, marginBottom: 10 }}>
                  We hear you.
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: TEXT, lineHeight: 1.5, marginBottom: 28 }}>
                  Our team will review your feedback and follow up. In the meantime, your app access is fully yours — your documents, warranties, and client portal are all here whenever you need them. We hope we can soon earn a recommendation from you to friends and family.
                </div>
                <button
                  onClick={() => { markComplete(); onDismiss(); }}
                  style={{
                    background: PRIMARY, color: ON_PRIMARY,
                    border: 'none', borderRadius: 10,
                    padding: '14px 32px', fontSize: 15, fontWeight: 600,
                    fontFamily: R.fontBody, cursor: 'pointer',
                  }}
                >Back to Dashboard</button>
              </div>
            )}
          </SlidePanel>

          {/* ── Slide 3: Referral nudge (good path only) ────────────────────── */}
          <SlidePanel>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <ShareNetwork size={40} color={PRIMARY} weight="fill" />
            </div>
            <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: TEXT, textAlign: 'center', marginBottom: 10 }}>
              Got anyone in mind?
            </div>
            <div style={{ fontFamily: R.fontBody, fontSize: 14, color: TEXT, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
              Share your personal link — they'll get to explore {branding.companyName} before committing to anything.
            </div>
            <button
              onClick={handleShare}
              style={{
                display: 'block', width: '100%',
                background: copied ? statusVar('success') : PRIMARY,
                // ⚠ THE LABEL FLIPS WITH THE FILL, AND A FIXED WHITE FAILED.
                // White on the success fill is 3.30:1 against a text floor of
                // 4.5. Black on it is 6.37:1 — and `success` is the SAME HEX IN
                // BOTH MODES (see statusTheme), so a fixed dark label here is
                // NOT mode-blind, which is the property the ON_DANGER literal in
                // ManageAccount could not claim.
                color: copied ? ON_SUCCESS : ON_PRIMARY,
                border: 'none', borderRadius: 10,
                padding: '14px', fontSize: 15, fontWeight: 600,
                fontFamily: R.fontBody, cursor: 'pointer',
                marginBottom: 14,
                transition: 'background 0.2s ease',
              }}
            >
              {copied ? 'Copied!' : 'Share My Link'}
            </button>
            {error && (
              <div style={{ marginBottom: 12, fontSize: 13, color: statusVar('dangerText'), textAlign: 'center' }}>
                {error}
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => {
                  markPromptResponded('positive');
                  setSlide(4);
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: R.fontBody, fontSize: 14, color: TEXT,
                  textDecoration: 'underline', padding: '4px 8px',
                }}
              >Maybe later</button>
            </div>
          </SlidePanel>

          {/* ── Slide 4: Close (good path terminal) ─────────────────────────── */}
          <SlidePanel>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 20, marginTop: 8 }}>
                <CheckCircle size={40} color={GREEN} weight="fill" />
              </div>
              <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: TEXT, marginBottom: 10 }}>
                You're all set!
              </div>
              <div style={{ fontFamily: R.fontBody, fontSize: 14, color: TEXT, lineHeight: 1.5, marginBottom: 28 }}>
                Thanks for being part of the {branding.companyName} community.
              </div>
              <button
                onClick={() => {
                  markPromptResponded('positive');
                  handleClose();
                }}
                style={{
                  background: PRIMARY, color: ON_PRIMARY,
                  border: 'none', borderRadius: 10,
                  padding: '14px 32px', fontSize: 15, fontWeight: 600,
                  fontFamily: R.fontBody, cursor: 'pointer',
                }}
              >Back to Dashboard</button>
            </div>
          </SlidePanel>

        </SlideRail>
      </div>
    </div>
  );
}
