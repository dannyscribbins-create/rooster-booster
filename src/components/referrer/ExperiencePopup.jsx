import { useState, useEffect, useRef } from 'react';
import { Star, SmileyMeh, CheckCircle, ShareNetwork } from '@phosphor-icons/react';
import { R } from '../../constants/theme';
import { BACKEND_URL, CONTRACTOR_CONFIG } from '../../config/contractor';
import { safeAsync } from '../../utils/clientErrorReporter';

const AMBER = '#F59E0B';
const GREEN = '#16A34A';

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
  background: '#fff',
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
  const [slide,            setSlide]            = useState(0);
  const [direction,        setDirection]        = useState(null);
  const [text,             setText]             = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [error,            setError]            = useState(null);
  const [hasLeftForReview, setHasLeftForReview] = useState(false);
  const [copied,           setCopied]           = useState(false);
  const autoAdvanceTimer = useRef(null);
  const token = sessionStorage.getItem('rb_token');

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
    const reviewUrl = CONTRACTOR_CONFIG.reviewUrl;
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
      // Also mark experience prompt as negative (writes to suggestion_box_submissions + admin_messages)
      try {
        await fetch(`${BACKEND_URL}/api/referrer/experience-prompt/${prompt.id}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ response_type: 'negative', suggestion_text: text.trim() }),
        });
      } catch {
        // non-critical — feedback already saved
      }
      setSlide(2);
    } finally {
      setSubmitting(false);
    }
  });

  const handleShare = safeAsync(async () => {
    const referralLink = prompt.referral_link || window.location.origin;
    const message      = `I just finished my project with ${CONTRACTOR_CONFIG.name} and I'd like to introduce you to them. Download their app to learn more: ${referralLink}`;
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
    borderRadius: 12, border: `1.5px solid ${R.navy}`,
    background: '#fff', cursor: 'pointer',
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
              color: R.textMuted, fontSize: 22, lineHeight: 1, padding: '4px 6px',
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
            <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, textAlign: 'center', marginBottom: 10 }}>
              How'd everything go?
            </div>
            <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
              Your feedback helps {CONTRACTOR_CONFIG.name} keep delivering great work.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button
                onClick={() => { setDirection('positive'); setSlide(1); }}
                style={responseBtn}
              >
                <span style={{ fontSize: 28 }}>😊</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: R.navy }}>Great experience</span>
              </button>
              <button
                onClick={() => { setDirection('negative'); setSlide(1); }}
                style={responseBtn}
              >
                <span style={{ fontSize: 28 }}>😕</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: R.navy }}>Could be better</span>
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
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, textAlign: 'center', marginBottom: 10 }}>
                  Mind sharing your experience?
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
                  Reviews help other homeowners make a confident decision — and they mean a lot to the team.
                </div>
                <button
                  onClick={handleLeaveReview}
                  disabled={hasLeftForReview}
                  style={{
                    display: 'block', width: '100%',
                    background: hasLeftForReview ? R.bgPage : R.navy,
                    color: hasLeftForReview ? R.textMuted : '#fff',
                    border: hasLeftForReview ? `1.5px solid ${R.borderMed}` : 'none',
                    borderRadius: 10,
                    padding: '14px', fontSize: 15, fontWeight: 600,
                    fontFamily: R.fontBody,
                    cursor: hasLeftForReview ? 'not-allowed' : 'pointer',
                    marginBottom: 14,
                  }}
                >
                  {hasLeftForReview ? 'Waiting for your return…' : 'Leave a Google Review'}
                </button>
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => setSlide(3)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: R.fontBody, fontSize: 14, color: R.textMuted,
                      textDecoration: 'underline', padding: '4px 8px',
                    }}
                  >Skip for now</button>
                </div>
              </>
            ) : (
              /* Slide 1 — Bad path: Suggestion box */
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <SmileyMeh size={40} color={R.textMuted} weight="fill" />
                </div>
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, textAlign: 'center', marginBottom: 10 }}>
                  We're sorry to hear that.
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
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
                    borderRadius: 10, border: `1.5px solid ${R.borderMed}`,
                    padding: '12px', fontFamily: R.fontBody, fontSize: 14,
                    color: R.textPrimary, resize: 'vertical', outline: 'none',
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ fontSize: 12, color: R.textMuted, textAlign: 'right', marginBottom: 16, marginTop: 4 }}>
                  {text.length} / 2000
                </div>
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={!text.trim() || submitting}
                  style={{
                    display: 'block', width: '100%',
                    background: R.navy, color: '#fff',
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
                  <div style={{ marginTop: 10, fontSize: 13, color: R.red, textAlign: 'center' }}>
                    {error}
                  </div>
                )}
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button
                    onClick={() => setSlide(2)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: R.fontBody, fontSize: 14, color: R.textMuted,
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
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, marginBottom: 10 }}>
                  Thank you! 🙏
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, lineHeight: 1.5, marginBottom: 28 }}>
                  Taking the time to leave a review means the world to us — and helps other homeowners make a confident decision.
                </div>
                <button
                  onClick={() => {
                    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
                    setSlide(3);
                  }}
                  style={{
                    background: R.navy, color: '#fff',
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
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, marginBottom: 10 }}>
                  We hear you.
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, lineHeight: 1.5, marginBottom: 28 }}>
                  Our team will review your feedback and follow up. In the meantime, your app access is fully yours — your documents, warranties, and client portal are all here whenever you need them. We hope we can soon earn a recommendation from you to friends and family.
                </div>
                <button
                  onClick={() => { markComplete(); onDismiss(); }}
                  style={{
                    background: R.navy, color: '#fff',
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
              <ShareNetwork size={40} color={R.navy} weight="fill" />
            </div>
            <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, textAlign: 'center', marginBottom: 10 }}>
              Got anyone in mind?
            </div>
            <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
              Share your personal link — they'll get to explore {CONTRACTOR_CONFIG.name} before committing to anything.
            </div>
            <button
              onClick={handleShare}
              style={{
                display: 'block', width: '100%',
                background: copied ? GREEN : R.navy,
                color: '#fff',
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
              <div style={{ marginBottom: 12, fontSize: 13, color: R.red, textAlign: 'center' }}>
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
                  fontFamily: R.fontBody, fontSize: 14, color: R.textMuted,
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
              <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, marginBottom: 10 }}>
                You're all set!
              </div>
              <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, lineHeight: 1.5, marginBottom: 28 }}>
                Thanks for being part of the {CONTRACTOR_CONFIG.name} community.
              </div>
              <button
                onClick={() => {
                  markPromptResponded('positive');
                  handleClose();
                }}
                style={{
                  background: R.navy, color: '#fff',
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
