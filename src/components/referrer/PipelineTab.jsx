import { useState } from 'react';
import { R } from '../../constants/theme';
import { STATUS_CONFIG } from '../../constants/theme';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import StatusBadge from '../shared/StatusBadge';

// ─── Pipeline ─────────────────────────────────────────────────────────────────
export default function Pipeline({ pipeline, loading }) {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "lead", "inspection", "sold", "closed"];
  const filterLabels = {
    all: "All", lead: "Lead", inspection: "Inspection", sold: "Sold", closed: "Not Sold",
  };
  const filtered = filter === "all" ? pipeline : pipeline.filter(p => p.status === filter);

  return (
    <Screen>
      {/* Header with navy band */}
      <div style={{
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
        padding: "52px 24px 24px",
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: R.fontMono, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          ROOSTER BOOSTER
        </p>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: "#fff", letterSpacing: "-0.02em" }}>
          My Pipeline
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 15, color: "rgba(255,255,255,0.6)" }}>
          {pipeline.length} total referral{pipeline.length !== 1 ? "s" : ""}
        </p>

        {/* Stat chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {[
            { label: "Sent",   val: pipeline.length, color: "rgba(255,255,255,0.9)", bg: "rgba(255,255,255,0.12)" },
            { label: "Active", val: pipeline.filter(p => p.status === "lead" || p.status === "inspection").length, color: "#93c5fd", bg: "rgba(147,197,253,0.15)" },
            { label: "Sold",   val: pipeline.filter(p => p.status === "sold").length, color: "#86efac", bg: "rgba(134,239,172,0.15)" },
          ].map((s, i) => (
            <AnimCard key={s.label} delay={i * 60} screenKey="pipeline" style={{ flex: 1 }}>
              <div style={{
                background: s.bg, borderRadius: 12,
                padding: "12px 10px", textAlign: "center",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: s.color, fontFamily: R.fontSans }}>{s.val}</p>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: R.fontMono, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
              </div>
            </AnimCard>
          ))}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{
        padding: "14px 20px 10px", display: "flex",
        gap: 8, overflowX: "auto",
        background: R.bgCard, borderBottom: `1px solid ${R.border}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? R.navy : R.bgPage,
            border: `1.5px solid ${filter === f ? R.navy : R.border}`,
            borderRadius: 999, padding: "7px 16px",
            color: filter === f ? "#fff" : R.textSecondary,
            fontSize: 12, fontWeight: filter === f ? 700 : 500,
            cursor: "pointer", fontFamily: R.fontBody,
            whiteSpace: "nowrap", transition: "background 0.2s, border-color 0.2s, color 0.2s",
          }}>{filterLabels[f]}</button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ padding: "32px 20px", textAlign: "center" }}>
          <i className="ph ph-circle-notch" style={{ fontSize: 32, color: R.textMuted, animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: R.textMuted, fontSize: 15, marginTop: 10 }}>Loading pipeline...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <i className="ph ph-funnel" style={{ fontSize: 36, color: R.blueLight, display: "block", marginBottom: 10 }} />
          <p style={{ color: R.textSecondary, fontSize: 15 }}>No referrals in this category yet.</p>
        </div>
      ) : (
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((ref, idx) => {
            const s = STATUS_CONFIG[ref.status];
            return (
              <AnimCard key={ref.id} delay={idx * 55}>
                <div style={{
                  background: R.bgCard, borderRadius: 14,
                  padding: "16px 18px",
                  borderLeft: `3px solid ${s.dot}`,
                  boxShadow: R.shadow,
                  transition: "box-shadow 0.2s, transform 0.2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = R.shadowMd; e.currentTarget.style.transform = "translateX(3px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = R.shadow; e.currentTarget.style.transform = "translateX(0)"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: s.bg, color: s.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, fontFamily: R.fontMono, flexShrink: 0,
                      }}>
                        {ref.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: R.textPrimary }}>{ref.name}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                      <StatusBadge status={ref.status} />
                      {ref.payout && (
                        <span style={{ fontSize: 15, fontWeight: 800, color: R.green, fontFamily: R.fontMono }}>
                          +${ref.payout}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </AnimCard>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}
