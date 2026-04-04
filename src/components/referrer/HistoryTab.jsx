// DEPRECATED: content moved to ProfileTab.jsx in Session 23. Safe to delete after Session 23 is fully verified.
import { R } from '../../constants/theme';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';

// ─── History ──────────────────────────────────────────────────────────────────
export default function History({ pipeline }) {
  const earned = pipeline.filter(p => p.payout).map(p => ({
    id: p.id, desc: `Referral Bonus — ${p.name}`, amount: p.payout,
  }));
  const totalEarned = earned.reduce((sum, h) => sum + h.amount, 0);

  return (
    <Screen>
      {/* Navy header band */}
      <div style={{
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
        padding: "52px 24px 28px",
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: R.fontMono, letterSpacing: "0.14em", textTransform: "uppercase" }}>ROOSTER BOOSTER</p>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: "#fff", letterSpacing: "-0.02em" }}>History</h1>
        <p style={{ margin: "4px 0 0", fontSize: 15, color: "rgba(255,255,255,0.6)" }}>Earnings & payouts</p>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        {/* Summary cards */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Earned",   val: `$${totalEarned.toLocaleString()}`, color: R.green,    bg: R.greenBg,  icon: "ph-trend-up" },
            { label: "Total Paid Out", val: "$0",                               color: R.navy,     bg: R.bgBlueLight, icon: "ph-check-circle" },
          ].map((s, i) => (
            <AnimCard key={s.label} delay={i * 80} screenKey="history" style={{ flex: 1 }}>
              <div style={{
                background: R.bgCard, border: `1px solid ${R.border}`,
                borderRadius: 14, padding: "16px",
                boxShadow: R.shadow,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: s.bg, display: "flex", alignItems: "center",
                  justifyContent: "center", marginBottom: 10,
                }}>
                  <i className={`ph ${s.icon}`} style={{ fontSize: 16, color: s.color }} />
                </div>
                <p style={{ margin: 0, fontSize: 12, color: R.textMuted, fontFamily: R.fontMono, textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, fontFamily: R.fontSans, color: s.color }}>{s.val}</p>
              </div>
            </AnimCard>
          ))}
        </div>

        {/* Earnings list */}
        {earned.length === 0 ? (
          <AnimCard delay={160} screenKey="history">
            <div style={{
              background: R.bgCard, border: `1px solid ${R.border}`,
              borderRadius: 14, padding: "36px 20px", textAlign: "center",
              boxShadow: R.shadow,
            }}>
              <i className="ph ph-coins" style={{ fontSize: 36, color: R.blueLight, display: "block", marginBottom: 10 }} />
              <p style={{ margin: 0, color: R.textSecondary, fontSize: 15, lineHeight: 1.6 }}>
                No earnings yet — referrals pay out once the invoice is paid!
              </p>
            </div>
          </AnimCard>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {earned.map((item, idx) => (
              <AnimCard key={item.id} delay={160 + idx * 60}>
                <div style={{
                  background: R.bgCard, border: `1px solid ${R.border}`,
                  borderRadius: 14, padding: "16px 18px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  boxShadow: R.shadow,
                  transition: "box-shadow 0.2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = R.shadowMd}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = R.shadow}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: R.greenBg, display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <i className="ph ph-money" style={{ fontSize: 22, color: R.green }} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: R.textPrimary }}>{item.desc}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: R.textMuted }}>Paid referral bonus</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 900, color: R.green, fontFamily: R.fontMono }}>
                    +${item.amount.toLocaleString()}
                  </span>
                </div>
              </AnimCard>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
