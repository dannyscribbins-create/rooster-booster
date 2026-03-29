import { R } from '../../constants/theme';

export default function AvatarCircle({ userName, profilePhoto, size, shadow, onClick, showCameraHint }) {
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
          background: R.red, color: "#fff",
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
          background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <i className="ph ph-camera" style={{ fontSize: 12, color: R.navy }} />
        </div>
      )}
    </div>
  );
}
