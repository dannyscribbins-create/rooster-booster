/**
 * Converts tag_group_visibility from old flat boolean shape to new object shape.
 * Old shape: { "assigned_rep": false }  → missing key or true = visible
 * New shape: { "assigned_rep": { enabled: false, hidden_values: [] } }
 * Missing key in either shape means fully visible (opt-out model preserved).
 */
function normalizeTagGroupVisibility(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const result = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') {
      result[key] = { enabled: value, hidden_values: [] };
    } else if (value && typeof value === 'object' && 'enabled' in value) {
      result[key] = {
        enabled: !!value.enabled,
        hidden_values: Array.isArray(value.hidden_values) ? value.hidden_values : [],
      };
    }
  }
  return result;
}

module.exports = { normalizeTagGroupVisibility };
