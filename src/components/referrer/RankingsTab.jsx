import { useState, useEffect, useRef } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import { SHOUT_BUCKETS } from '../../constants/shouts';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';

// ─── Constants ────────────────────────────────────────────────────────────────
const PERIODS = [
  { label: "Monthly",   value: "monthly"   },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly",    value: "yearly"    },
  { label: "All-Time",  value: "alltime"   },
];

const MEDAL = {
  1: { border: "#FFD700", bg: "rgba(255,215,0,0.10)",   emoji: "🥇" },
  2: { border: "#C0C0C0", bg: "rgba(192,192,192,0.10)", emoji: "🥈" },
  3: { border: "#CD7F32", bg: "rgba(205,127,50,0.10)",  emoji: "🥉" },
};

// ─── RankingsTab ──────────────────────────────────────────────────────────────
export default function RankingsTab({ token }) {
  const [period, setPeriod]           = useState("yearly");
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);

  // Shout bubble state
  const [activeShoutIndex, setActiveShoutIndex] = useState(null);
  const [showBubble, setShowBubble]             = useState(false);
  const [activeShoutText, setActiveShoutText]   = useState('');
  const shoutIndexRef = useRef(-1);

  function fetchLeaderboard(p) {
    setLoading(true);
    setError(false);
    fetch(`${BACKEND_URL}/api/referrer/leaderboard?period=${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }

  useEffect(() => {
    fetchLeaderboard(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // Shout bubble interval — cycles through leaderboard rows every 5s, visible 3s
  useEffect(() => {
    if (!data || !data.shouts_enabled || !data.top10 || data.top10.length === 0) return;

    const entries = data.top10;
    const userRankIndex = (data.userRank && data.userRank.rank <= 10) ? data.userRank.rank - 1 : -1;

    shoutIndexRef.current = -1;
    setActiveShoutIndex(null);
    setShowBubble(false);

    let hideTimeout = null;

    const tick = () => {
      // Advance to next valid index, skipping opted-out user row
      let next = (shoutIndexRef.current + 1) % entries.length;
      let attempts = 0;
      while (attempts < entries.length) {
        if (next === userRankIndex && data.shout_opt_out) {
          next = (next + 1) % entries.length;
          attempts++;
        } else {
          break;
        }
      }
      if (attempts >= entries.length) return; // all rows opted out

      shoutIndexRef.current = next;
      const row = entries[next];

      // Determine shout text for this row
      let text;
      if (row.is_warmup) {
        text = row.shout;
      } else if (next === userRankIndex && data.pinned_shout) {
        text = data.pinned_shout;
      } else {
        const rank = next + 1;
        const bucket = rank === 1 ? SHOUT_BUCKETS.rank1
          : rank <= 3 ? SHOUT_BUCKETS.rank2_3
          : rank <= 7 ? SHOUT_BUCKETS.rank4_7
          : SHOUT_BUCKETS.rank8_10;
        text = bucket[Math.floor(Math.random() * bucket.length)];
      }

      setActiveShoutIndex(next);
      setActiveShoutText(text);
      setShowBubble(true);

      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => setShowBubble(false), 3000);
    };

    const interval = setInterval(tick, 5000);

    return () => {
      clearInterval(interval);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Prize array for the active period
  const prizes = period === "quarterly"
    ? (data?.quarterly_prizes ?? [])
    : period === "yearly"
      ? (data?.yearly_prizes ?? [])
      : [];
  const showPrizes = (period === "quarterly" || period === "yearly") && !loading && !error;

  // User is outside the top 10 if userRank exists and rank > 10
  const userOutsideTop10 = data?.userRank && data.userRank.rank > 10;

  // ── Header (always rendered) ─────────────────────────────────────────────────
  const header = (
    <div style={{
      background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
      padding: "52px 24px 28px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(211,227,240,0.08)" }} />
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: R.fontMono, letterSpacing: "0.14em", textTransform: "uppercase" }}>ROOSTER BOOSTER</p>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <i className="ph ph-trophy-fill" style={{ fontSize: 24, color: "#fbbf24" }} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: "#fff", letterSpacing: "-0.02em" }}>Rankings</h1>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 15, color: "rgba(255,255,255,0.6)" }}>Top referrers this period</p>
    </div>
  );

  // ── Leaderboard disabled ─────────────────────────────────────────────────────
  if (!loading && !error && data?.leaderboard_enabled === false) {
    return (
      <Screen>
        {header}
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <i className="ph ph-trophy" style={{ fontSize: 40, color: R.blueLight, display: "block", marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 16, color: R.textSecondary, lineHeight: 1.6 }}>
            Rankings are not available right now.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      <div style={{ padding: "16px 20px 100px" }}>

        {/* ── Time Filter Pills ──────────────────────────────────────────────── */}
        <AnimCard delay={60} screenKey="rankings">
          <div style={{
            display: "flex", gap: 8, marginBottom: 16,
            overflowX: "auto", paddingBottom: 2,
          }}>
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  background: period === p.value ? R.navy : R.bgCard,
                  border: `1.5px solid ${period === p.value ? R.navy : R.border}`,
                  borderRadius: 999, padding: "8px 18px",
                  color: period === p.value ? "#fff" : R.navy,
                  fontSize: 13, fontWeight: period === p.value ? 700 : 500,
                  cursor: "pointer", fontFamily: R.fontBody,
                  whiteSpace: "nowrap",
                  transition: "background 0.2s, border-color 0.2s, color 0.2s",
                }}
              >{p.label}</button>
            ))}
          </div>
        </AnimCard>

        {/* ── Warm-Up Motivational Banner ───────────────────────────────────── */}
        {data?.warmup_mode_enabled && (!data.userRank || data.userRank.converted_count === 0) && (
          <AnimCard delay={90} screenKey="rankings">
            <div style={{
              background: R.blueLight,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 16,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: R.navy, lineHeight: 1.6 }}>
                Every top referrer started at zero. Make your first referral and claim your spot.
              </p>
            </div>
          </AnimCard>
        )}

        {/* ── Prize Display Card ─────────────────────────────────────────────── */}
        {/* STRIPE HOOK: when Stripe ACH is live, prize display will show payout status for winners at period end */}
        {showPrizes && (
          <AnimCard delay={120} screenKey="rankings">
            <div style={{
              background: `linear-gradient(135deg, rgba(1,40,84,0.06) 0%, rgba(211,227,240,0.35) 100%)`,
              border: `1.5px solid ${R.border}`,
              borderRadius: 16, overflow: "hidden",
              boxShadow: R.shadow, marginBottom: 16,
            }}>
              {/* Card header */}
              <div style={{
                padding: "14px 18px 12px",
                borderBottom: `1px solid ${R.border}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <i className="ph ph-gift" style={{ fontSize: 18, color: R.navy }} />
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: R.fontSans, color: R.textPrimary }}>
                  Prizes This Period
                </span>
              </div>

              {/* Prize rows */}
              <div style={{ padding: "12px 18px" }}>
                {prizes.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 14, color: R.textMuted, fontStyle: "italic" }}>
                    Prizes coming soon — stay tuned!
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {prizes.map((prize, idx) => {
                      const medal = MEDAL[idx + 1];
                      const rank = idx + 1;
                      const hasAmount = prize?.amount && parseFloat(prize.amount) > 0;
                      if (!medal) return null;
                      return (
                        <div key={rank} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px",
                          background: medal.bg,
                          borderRadius: 10,
                          borderLeft: `3px solid ${medal.border}`,
                        }}>
                          <span style={{ fontSize: 20 }}>{medal.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: R.textPrimary, fontFamily: R.fontBody }}>
                              {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"} Place
                            </span>
                            {prize?.description && (
                              <span style={{ fontSize: 14, color: R.textSecondary }}> — {prize.description}</span>
                            )}
                          </div>
                          {hasAmount && (
                            <span style={{ fontSize: 15, fontWeight: 800, color: R.navy, fontFamily: R.fontMono }}>
                              ${parseFloat(prize.amount).toLocaleString()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </AnimCard>
        )}

        {/* ── Leaderboard List ───────────────────────────────────────────────── */}
        <AnimCard delay={showPrizes ? 200 : 120} screenKey="rankings">
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow,
          }}>

            {/* Loading */}
            {loading && (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <i className="ph ph-circle-notch" style={{ fontSize: 32, color: R.textMuted, animation: "spin 0.8s linear infinite" }} />
                <p style={{ color: R.textMuted, fontSize: 14, marginTop: 10 }}>Loading rankings...</p>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <i className="ph ph-warning-circle" style={{ fontSize: 36, color: R.red, display: "block", marginBottom: 10 }} />
                <p style={{ color: R.textSecondary, fontSize: 14, marginBottom: 16 }}>
                  Could not load rankings. Check your connection.
                </p>
                <button
                  onClick={() => fetchLeaderboard(period)}
                  style={{
                    background: R.navy, color: "#fff", border: "none",
                    borderRadius: 10, padding: "10px 22px",
                    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: R.fontBody,
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && data?.top10?.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <i className="ph ph-chart-bar" style={{ fontSize: 36, color: R.blueLight, display: "block", marginBottom: 10 }} />
                <p style={{ margin: 0, color: R.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                  No conversions yet this period — be the first!
                </p>
              </div>
            )}

            {/* Top 10 rows */}
            {!loading && !error && data?.top10?.length > 0 && (
              <>
                {data.top10.map((row, i) => {
                  const medal = MEDAL[row.rank];
                  const bubbleActive = data.shouts_enabled && activeShoutIndex === i && showBubble;
                  return (
                    <div key={row.rank} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 18px",
                      borderBottom: `1px solid ${R.border}`,
                      borderLeft: medal ? `3px solid ${medal.border}` : "3px solid transparent",
                      background: medal ? medal.bg : "transparent",
                      transition: "background 0.15s",
                    }}>
                      {/* Rank number */}
                      <span style={{
                        fontSize: 18, fontWeight: 900,
                        fontFamily: R.fontMono, color: R.navy,
                        minWidth: 28, textAlign: "center",
                      }}>
                        {row.rank}
                      </span>

                      {/* Name + trophy for 1st + display badge + shout bubble */}
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: R.textPrimary }}>
                          {row.first_name}
                        </span>
                        {row.rank === 1 && (
                          <i className="ph ph-trophy-fill" style={{ fontSize: 14, color: "#fbbf24" }} />
                        )}
                        {row.display_badge && (
                          <span style={{ fontSize: 14, marginLeft: 5 }}>{row.display_badge.emoji}</span>
                        )}
                        <div style={{
                          marginLeft: 8,
                          background: "#fff", border: "1px solid #012854",
                          borderRadius: 12, padding: "6px 10px",
                          fontSize: 12, color: "#333",
                          opacity: bubbleActive ? 1 : 0,
                          transition: "opacity 200ms",
                          pointerEvents: "none",
                          whiteSpace: "nowrap",
                        }}>
                          {activeShoutText}
                        </div>
                      </div>

                      {/* Jobs count */}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, fontFamily: R.fontMono, color: R.navy }}>
                          {row.converted_count}
                        </span>
                        <span style={{ fontSize: 12, color: R.textMuted, fontFamily: R.fontBody }}>jobs</span>
                      </div>
                    </div>
                  );
                })}

                {/* User's own rank — below divider if outside top 10 */}
                {userOutsideTop10 && (
                  <>
                    {/* Divider */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 18px",
                      background: R.bgPage,
                      borderTop: `1px solid ${R.border}`,
                      borderBottom: `1px solid ${R.border}`,
                    }}>
                      <div style={{ flex: 1, height: 1, background: R.border }} />
                      <span style={{ fontSize: 11, color: R.textMuted, fontFamily: R.fontMono, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        Your Ranking
                      </span>
                      <div style={{ flex: 1, height: 1, background: R.border }} />
                    </div>

                    {/* User row */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 18px",
                      borderLeft: `3px solid ${R.red}`,
                      background: "rgba(204,0,0,0.04)",
                    }}>
                      <span style={{
                        fontSize: 18, fontWeight: 900,
                        fontFamily: R.fontMono, color: R.red,
                        minWidth: 28, textAlign: "center",
                      }}>
                        {data.userRank.rank}
                      </span>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: R.textPrimary }}>You</span>
                        {data.userRank.display_badge && (
                          <span style={{ fontSize: 14, marginLeft: 5 }}>{data.userRank.display_badge.emoji}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, fontFamily: R.fontMono, color: R.red }}>
                          {data.userRank.converted_count}
                        </span>
                        <span style={{ fontSize: 12, color: R.textMuted, fontFamily: R.fontBody }}>jobs</span>
                      </div>
                    </div>
                  </>
                )}

                {/* User has zero conversions */}
                {!loading && !error && !data.userRank && (
                  <div style={{
                    padding: "14px 18px",
                    borderTop: `1px solid ${R.border}`,
                    background: R.bgPage,
                    textAlign: "center",
                  }}>
                    <p style={{ margin: 0, fontSize: 13, color: R.textMuted, fontStyle: "italic" }}>
                      Complete your first referral to appear on the leaderboard
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </AnimCard>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}
