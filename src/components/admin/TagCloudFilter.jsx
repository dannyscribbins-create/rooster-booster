import { AD, TAG_COLORS } from '../../constants/adminTheme';

// ── TagPill ───────────────────────────────────────────────────────────────────
// Shared pill component used in both TagCloudFilter and AdminContactDetailDrawer.
export function TagPill({ tag, source, onRemove }) {
  const colors = TAG_COLORS[tag] || TAG_COLORS.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 99,
      background: colors.bg, color: colors.text,
      border: `1px solid ${colors.border}`,
      fontSize: 11, fontFamily: AD.fontSans, fontWeight: 500,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {tag}
      {onRemove && source === 'admin' && (
        <button
          onClick={onRemove}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, lineHeight: 1, color: colors.text,
            display: 'flex', alignItems: 'center',
            opacity: 0.7,
          }}
        >
          <i className="ph ph-x" style={{ fontSize: 9 }} />
        </button>
      )}
    </span>
  );
}

// ── TagCloudFilter ────────────────────────────────────────────────────────────
// tagSummary:       [{ tag, source, contact_count }]
// selectedTags:     string[]
// onSelectionChange:(tags: string[]) => void
// logic:            'AND' | 'OR'
// onLogicChange:    (logic: 'AND' | 'OR') => void
// showCounts:       boolean
export default function TagCloudFilter({ tagSummary = [], selectedTags = [], onSelectionChange, logic = 'AND', onLogicChange, showCounts = true }) {
  function toggleTag(tag) {
    if (selectedTags.includes(tag)) {
      onSelectionChange(selectedTags.filter(t => t !== tag));
    } else {
      onSelectionChange([...selectedTags, tag]);
    }
  }

  if (tagSummary.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {tagSummary.map(({ tag, contact_count }) => {
          const isSelected = selectedTags.includes(tag);
          const colors = TAG_COLORS[tag] || TAG_COLORS.default;
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 99,
                background: isSelected ? colors.bg : 'transparent',
                color: isSelected ? colors.text : AD.textSecondary,
                border: `1px solid ${isSelected ? colors.border : AD.border}`,
                fontSize: 12, fontFamily: AD.fontSans,
                cursor: 'pointer', fontWeight: isSelected ? 600 : 400,
                transition: 'all 0.12s', whiteSpace: 'nowrap',
              }}
            >
              {tag}
              {showCounts && (
                <span style={{ fontSize: 10, opacity: 0.65 }}>
                  {contact_count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedTags.length >= 2 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>Match:</span>
          {['AND', 'OR'].map(l => (
            <button
              key={l}
              onClick={() => onLogicChange(l)}
              style={{
                padding: '2px 8px', borderRadius: 5,
                background: logic === l ? AD.navy : 'transparent',
                color: logic === l ? '#fff' : AD.textSecondary,
                border: `1px solid ${logic === l ? AD.navy : AD.border}`,
                fontSize: 11, fontFamily: AD.fontSans, cursor: 'pointer',
                fontWeight: logic === l ? 600 : 400,
              }}
            >
              {l}
            </button>
          ))}
          <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
            {logic === 'AND' ? '— must have all' : '— must have any'}
          </span>
        </div>
      )}

      {selectedTags.length > 0 && (
        <button
          onClick={() => onSelectionChange([])}
          style={{
            display: 'block', marginTop: 6,
            fontSize: 11, color: AD.textTertiary,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, fontFamily: AD.fontSans,
            textDecoration: 'underline',
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
