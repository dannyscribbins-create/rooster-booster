import { useState } from 'react';
import { Star, SmileyMeh, CheckCircle } from '@phosphor-icons/react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import { safeAsync } from '../../utils/clientErrorReporter';

const AMBER  = '#F59E0B';
const GREEN  = '#16A34A';

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
  const [slide,      setSlide]      = useState(0);
  const [direction,  setDirection]  = useState(null);
  const [text,       setText]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  const token = sessionStorage.getItem('rb_token');

  const handlePositiveReview = safeAsync(async () => {
    if (submitting) return;
    if (prompt.google_place_id) {
      window.open(
        `https://search.google.com/local/writereview?placeid=${prompt.google_place_id}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
    setSubmitting(true);
    try {
      await fetch(`${BACKEND_URL}/api/referrer/experience-prompt/${prompt.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ response_type: 'positive' }),
      });
    } catch {
      // non-critical — slide to completion regardless
    } finally {
      setSubmitting(false);
    }
    setSlide(2);
  });

  const handleNegativeSubmit = safeAsync(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/referrer/experience-prompt/${prompt.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ response_type: 'negative', suggestion_text: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Something went wrong. Please try again.');
        return;
      }
      setSlide(2);
    } finally {
      setSubmitting(false);
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

  return (
    <div style={overlay}>
      <div style={card}>
        {slide === 2 && (
          <button
            onClick={onDismiss}
            aria-label="Close"
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              color: R.textMuted, fontSize: 22, lineHeight: 1, padding: '4px 6px',
              zIndex: 1,
            }}
          >
            ×
          </button>
        )}
        <SlideRail slide={slide}>

          {/* Slide 0 — Greeting */}
          <SlidePanel>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Star size={40} color={AMBER} weight="fill" />
            </div>
            <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, textAlign: 'center', marginBottom: 10 }}>
              How did we do?
            </div>
            <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
              We'd love to hear about your experience with us.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button
                onClick={() => { setDirection('positive'); setSlide(1); }}
                style={responseBtn}
              >
                <span style={{ fontSize: 28 }}>👍</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: R.navy }}>Great!</span>
              </button>
              <button
                onClick={() => { setDirection('negative'); setSlide(1); }}
                style={responseBtn}
              >
                <span style={{ fontSize: 28 }}>👎</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: R.navy }}>Not great</span>
              </button>
            </div>
          </SlidePanel>

          {/* Slide 1 — Response (positive or negative) */}
          <SlidePanel>
            {direction === 'positive' ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <Star size={40} color={AMBER} weight="fill" />
                </div>
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, textAlign: 'center', marginBottom: 10 }}>
                  That's awesome to hear!
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
                  Would you mind sharing your experience on Google? It really helps us grow.
                </div>
                {prompt.google_place_id ? (
                  <>
                    <button
                      onClick={handlePositiveReview}
                      disabled={submitting}
                      style={{
                        display: 'block', width: '100%',
                        background: R.navy, color: '#fff',
                        border: 'none', borderRadius: 10,
                        padding: '14px', fontSize: 15, fontWeight: 600,
                        fontFamily: R.fontBody, cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.7 : 1,
                        marginBottom: 14,
                      }}
                    >
                      Leave a Google Review
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled
                      style={{
                        display: 'block', width: '100%',
                        background: R.navy, color: '#fff',
                        border: 'none', borderRadius: 10,
                        padding: '14px', fontSize: 15, fontWeight: 600,
                        fontFamily: R.fontBody, cursor: 'not-allowed',
                        opacity: 0.4, marginBottom: 8,
                      }}
                    >
                      Leave a Google Review
                    </button>
                    <div style={{ fontSize: 12, color: R.textMuted, textAlign: 'center', marginBottom: 14 }}>
                      Review link not configured yet
                    </div>
                  </>
                )}
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={onDismiss}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: R.fontBody, fontSize: 14, color: R.textMuted,
                      textDecoration: 'underline', padding: '4px 8px',
                    }}
                  >
                    Maybe later
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <SmileyMeh size={40} color={R.textMuted} weight="fill" />
                </div>
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, textAlign: 'center', marginBottom: 10 }}>
                  We're sorry to hear that.
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
                  Please share your thoughts — we read every message and will follow up personally.
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
                  onClick={handleNegativeSubmit}
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
                  {submitting ? 'Sending…' : 'Send Feedback'}
                </button>
                {error && (
                  <div style={{ marginTop: 10, fontSize: 13, color: R.red, textAlign: 'center' }}>
                    {error}
                  </div>
                )}
              </>
            )}
          </SlidePanel>

          {/* Slide 2 — Completion */}
          <SlidePanel>
            <div style={{ textAlign: 'center', marginBottom: 20, marginTop: 8 }}>
              <CheckCircle size={40} color={GREEN} weight="fill" />
            </div>
            {direction === 'positive' ? (
              <>
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, textAlign: 'center', marginBottom: 10 }}>
                  Thank you so much!
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
                  Your review means the world to us and helps us serve more neighbors like you.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 20, color: R.navy, textAlign: 'center', marginBottom: 10 }}>
                  We appreciate your honesty.
                </div>
                <div style={{ fontFamily: R.fontBody, fontSize: 14, color: R.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
                  Our team will personally review your feedback and reach out to you directly.
                </div>
              </>
            )}
          </SlidePanel>

        </SlideRail>
      </div>
    </div>
  );
}
