import { R } from '../../constants/theme';

export default function AvatarCircle({ userName, profilePhoto, size, shadow, onClick, showCameraHint, bg }) {
  const initials = userName.split(" ").map(n => n[0]).join("");
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(e); } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ position: "relative", width: size, height: size, flexShrink: 0, cursor: onClick ? "pointer" : "default" }}
    >
      {profilePhoto ? (
        <img
          src={profilePhoto}
          alt={userName}
          style={{
            width: size, height: size, borderRadius: "50%",
            objectFit: "cover", boxShadow: shadow, display: "block",
          }}
        />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: "50%",
          // The fill was `R.red` — the RETIRED ACCENT RED, sitting in the
          // ACTION-colour slot. ⚠ IT WAS INVISIBLE TO EVERY LITERAL SWEEP:
          // HARDCODED_ACCENT_INVENTORY.md never listed this file, and could not
          // have, because the value arrives through `R` and theme.js is
          // needle-exempt. A hex needle cannot see a hex it never reads.
          background: bg || 'var(--rm-primary, #F26A1B)',
          // ⚠ onPrimary IS ONLY CORRECT FOR THE DEFAULT FILL, AND THE `bg` PROP
          // IS WHY. onPrimary answers about `--rm-primary`; when a caller
          // supplies its own fill the component cannot know a readable
          // foreground for it. RankingsTab passes `bg={R.navy}` on warmup rows,
          // where white is right and near-black would not be. So the override
          // path keeps white and the default path gets the derived answer.
          // ⚠ THIS IS A DEFECT IN THE PROP CONTRACT, NOT A STYLE CHOICE — a
          // caller-supplied fill with no matching foreground is unsolvable here.
          // It resolves when RankingsTab migrates and stops passing a raw tone.
          color: bg ? '#fff' : 'var(--rm-on-primary, #000000)',
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.34, fontWeight: 700, fontFamily: R.fontMono,
          boxShadow: shadow,
        }}>
          {initials}
        </div>
      )}
      {showCameraHint && (
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          width: 22, height: 22, borderRadius: "50%",
          // The hint badge sits ON the avatar, which sits on a card — so it is a
          // SURFACE, and in dark mode it must stop being white.
          background: 'var(--rm-surface, #FFFFFF)', boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          {/* Was R.navy — the RETIRED ACCENT NAVY, and reached through `R`
              rather than as a literal, so no hex sweep could ever have found it. */}
          <i className="ph ph-camera" style={{ fontSize: 12, color: 'var(--rm-text, #1C2D4D)' }} />
        </div>
      )}
    </div>
  );
}
