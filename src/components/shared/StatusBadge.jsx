import { R, STATUS_CONFIG } from '../../constants/theme';

// Status badge
export default function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 12, padding: "4px 10px", borderRadius: 999,
      background: s.bg, color: s.color,
      fontFamily: R.fontMono, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}
