import { useState, useEffect, useCallback } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import AdminContactDetailDrawer from './AdminContactDetailDrawer';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SmallPill({ bg, color, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: bg, color,
      padding: '2px 6px', borderRadius: 4,
      fontSize: 10, fontFamily: AD.fontSans, fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'opted_out', label: 'Opted Out' },
  { id: 'app_user',  label: 'App User' },
];

const COL_STYLES = {
  name:     { width: '22%', paddingRight: 12 },
  email:    { width: '30%', paddingRight: 12 },
  status:   { width: '18%', paddingRight: 12 },
  sends:    { width: '10%', paddingRight: 12, textAlign: 'right' },
  lastSent: { width: '14%', textAlign: 'right' },
};

function ContactRow({ c, isLast, onClick }) {
  const [hovered, setHovered] = useState(false);
  const hasStatus = c.is_app_user || c.opted_out;

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderBottom: isLast ? 'none' : `1px solid ${AD.border}`,
        transition: 'background 0.1s',
        cursor: 'pointer',
      }}
    >
      <td style={{ ...COL_STYLES.name, padding: '12px 12px 12px 0' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AD.blueLight, fontFamily: "'Montserrat', sans-serif" }}>
          {c.name || '—'}
        </span>
      </td>
      <td style={{ ...COL_STYLES.email, padding: '12px 12px 12px 0' }}>
        <span style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          {c.email}
        </span>
      </td>
      <td style={{ ...COL_STYLES.status, padding: '12px 12px 12px 0' }}>
        {hasStatus ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {c.is_app_user && <SmallPill bg={AD.blueBg}  color={AD.blueText}  label="App User" />}
            {c.opted_out   && <SmallPill bg={AD.red2Bg}  color={AD.red2Text}  label="Opted Out" />}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>—</span>
        )}
      </td>
      <td style={{ ...COL_STYLES.sends, padding: '12px 12px 12px 0', textAlign: 'right' }}>
        <span style={{ fontSize: 12, color: AD.blueLight, fontFamily: "'Roboto Mono', monospace" }}>
          {c.total_sends || 0}
        </span>
      </td>
      <td style={{ ...COL_STYLES.lastSent, padding: '12px 0', textAlign: 'right' }}>
        <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
          {formatDate(c.last_sent_at)}
        </span>
      </td>
    </tr>
  );
}

export default function AdminContactsTab({ headers }) {
  const [contacts,          setContacts]          = useState([]);
  const [totalCount,        setTotalCount]        = useState(0);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState('');
  const [activeFilter,      setActiveFilter]      = useState('all');
  const [selectedContactId, setSelectedContactId] = useState(null);

  // Extract token from headers for the drawer (headers is { Authorization: 'Bearer ...' })
  const drawerToken = headers?.Authorization?.replace('Bearer ', '') || null;

  const fetchContacts = useCallback(async (filter) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filter !== 'all') params.set('filter', filter);
      const r = await fetch(`${BACKEND_URL}/api/admin/contacts?${params}`, { headers });
      if (!r.ok) throw new Error('Failed');
      const data = await r.json();
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
      setTotalCount(typeof data.total_count === 'number' ? data.total_count : 0);
    } catch {
      setError('Could not load contacts.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchContacts(activeFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  function handleFilter(filterId) {
    if (filterId === activeFilter) return;
    setActiveFilter(filterId);
  }

  const thStyle = {
    padding: '0 0 10px',
    fontSize: 11, fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600, textTransform: 'uppercase',
    color: AD.textTertiary, letterSpacing: '0.05em',
    borderBottom: `1px solid ${AD.borderStrong}`,
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const active = f.id === activeFilter;
          return (
            <button
              key={f.id}
              onClick={() => handleFilter(f.id)}
              style={{
                padding: '6px 14px', borderRadius: 20,
                background: active ? AD.navy : 'transparent',
                color: active ? '#fff' : AD.textSecondary,
                border: `1px solid ${active ? AD.navy : AD.border}`,
                fontSize: 11, fontFamily: AD.fontSans,
                cursor: 'pointer', fontWeight: active ? 600 : 400,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Count line */}
      {!loading && !error && (
        <p style={{ margin: '0 0 16px', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
          Showing {contacts.length.toLocaleString()} of {totalCount.toLocaleString()} contacts
        </p>
      )}

      {/* Loading */}
      {loading && (
        <p style={{ color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 15 }}>
          Loading contacts...
        </p>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <p style={{ color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 13, marginBottom: 12 }}>
            {error}
          </p>
          <button
            onClick={() => fetchContacts(activeFilter)}
            style={{
              padding: '8px 20px', borderRadius: 8,
              background: AD.navy, color: '#fff',
              border: 'none', fontSize: 13, fontFamily: AD.fontSans,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && contacts.length === 0 && (
        <p style={{ textAlign: 'center', color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 13, marginTop: 32 }}>
          No contacts yet. Contacts are added automatically when campaign batches are sent.
        </p>
      )}

      {!loading && !error && contacts.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, ...COL_STYLES.name,     textAlign: 'left' }}>Name</th>
              <th style={{ ...thStyle, ...COL_STYLES.email,    textAlign: 'left' }}>Email</th>
              <th style={{ ...thStyle, ...COL_STYLES.status,   textAlign: 'left' }}>Status</th>
              <th style={{ ...thStyle, ...COL_STYLES.sends,    textAlign: 'right' }}>Sends</th>
              <th style={{ ...thStyle, ...COL_STYLES.lastSent, textAlign: 'right' }}>Last Sent</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, idx) => (
              <ContactRow
                key={c.id}
                c={c}
                isLast={idx === contacts.length - 1}
                onClick={() => setSelectedContactId(c.id)}
              />
            ))}
          </tbody>
        </table>
      )}

      <AdminContactDetailDrawer
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
        token={drawerToken}
      />
    </div>
  );
}

