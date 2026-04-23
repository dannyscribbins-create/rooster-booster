import { useState, useEffect, useCallback } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { safeAsync } from '../../utils/clientErrorReporter';

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 2)  return 'Just now';
  if (mins  < 60) return `${mins} minutes ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days  === 1) return 'Yesterday';
  return `${days} days ago`;
}

function SkeletonCard() {
  return (
    <div style={{
      background: AD.bgCardTint,
      border: `1px solid ${AD.border}`,
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 8,
      animation: 'pulse 1.4s ease-in-out infinite',
    }}>
      <div style={{ height: 12, width: '60%', background: AD.bgActive, borderRadius: 6, marginBottom: 10 }} />
      <div style={{ height: 10, width: '80%', background: AD.bgActive, borderRadius: 6, marginBottom: 6 }} />
      <div style={{ height: 10, width: '45%', background: AD.bgActive, borderRadius: 6 }} />
    </div>
  );
}

function MissingReferralCard({ msg, onMarkRead, onNavigate }) {
  const isUnread = !msg.read;

  const handleOpenReport = safeAsync(async () => {
    if (isUnread) {
      const token = sessionStorage.getItem('rb_admin_token');
      const r = await fetch(`${BACKEND_URL}/api/admin/messages/${msg.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) onMarkRead(msg.id, d.unreadCount);
    }
    onNavigate();
  }, 'AdminInboxSidebar.openReport');

  return (
    <div style={{
      position: 'relative',
      background: AD.bgCard,
      border: `1px solid ${AD.border}`,
      borderLeft: '4px solid #7C3AED',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 8,
    }}>
      {isUnread && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          width: 8, height: 8, borderRadius: '50%',
          background: '#7C3AED',
        }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: 16, marginBottom: 4 }}>
        <span style={{ fontFamily: AD.fontSans, fontWeight: 600, fontSize: 14, color: AD.textPrimary }}>
          {msg.referrer_name || 'Unknown referrer'}
        </span>
        <span style={{ fontFamily: AD.fontSans, fontSize: 12, color: AD.textTertiary, marginLeft: 8, flexShrink: 0 }}>
          {relativeTime(msg.created_at)}
        </span>
      </div>
      <p style={{ margin: '0 0 12px', fontFamily: AD.fontSans, fontSize: 13, color: AD.textSecondary }}>
        Reported missing: <strong style={{ color: AD.textPrimary }}>{msg.referred_name || '—'}</strong>
      </p>
      <button
        onClick={handleOpenReport}
        style={{
          background: 'rgba(124,58,237,0.15)',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 8,
          padding: '6px 12px',
          fontFamily: AD.fontSans,
          fontSize: 13,
          fontWeight: 500,
          color: '#a78bfa',
          cursor: 'pointer',
        }}
      >
        Open Report
      </button>
    </div>
  );
}

function SuggestionBoxCard({ msg, onMarkRead }) {
  const [expanded, setExpanded] = useState(false);
  const isUnread = !msg.read;
  const text = msg.message_text || '';
  const truncated = text.length > 100 && !expanded;

  const handleMarkRead = safeAsync(async () => {
    const token = sessionStorage.getItem('rb_admin_token');
    const r = await fetch(`${BACKEND_URL}/api/admin/messages/${msg.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.success) onMarkRead(msg.id, d.unreadCount);
  }, 'AdminInboxSidebar.markRead');

  return (
    <div style={{
      position: 'relative',
      background: AD.bgCard,
      border: `1px solid ${AD.border}`,
      borderLeft: '4px solid #DC2626',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 8,
    }}>
      {isUnread && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          width: 8, height: 8, borderRadius: '50%',
          background: '#DC2626',
        }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: 16, marginBottom: 8 }}>
        <span style={{ fontFamily: AD.fontSans, fontWeight: 600, fontSize: 14, color: AD.textPrimary }}>
          {msg.submitter_name || 'Anonymous'}
        </span>
        <span style={{ fontFamily: AD.fontSans, fontSize: 12, color: AD.textTertiary, marginLeft: 8, flexShrink: 0 }}>
          {relativeTime(msg.created_at)}
        </span>
      </div>
      <p style={{ margin: '0 0 12px', fontFamily: AD.fontSans, fontSize: 13, color: AD.textSecondary, lineHeight: 1.5 }}>
        {truncated ? text.slice(0, 100) : text}
        {text.length > 100 && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontFamily: AD.fontSans, fontSize: 13,
              color: AD.blueLight, cursor: 'pointer', marginLeft: 4,
            }}
          >
            {expanded ? '...show less' : '...show more'}
          </button>
        )}
      </p>
      {isUnread && (
        <button
          onClick={handleMarkRead}
          style={{
            background: AD.red2Bg,
            border: `1px solid rgba(220,38,38,0.25)`,
            borderRadius: 8,
            padding: '6px 12px',
            fontFamily: AD.fontSans,
            fontSize: 13,
            fontWeight: 500,
            color: AD.red2Text,
            cursor: 'pointer',
          }}
        >
          Mark Read
        </button>
      )}
    </div>
  );
}

export default function AdminInboxSidebar({ isOpen, onClose, onUnreadChange, onNavigate }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [readIds, setReadIds]   = useState(new Set());

  const fetchMessages = useCallback(safeAsync(async () => {
    setLoading(true);
    const token = sessionStorage.getItem('rb_admin_token');
    const r = await fetch(`${BACKEND_URL}/api/admin/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    if (Array.isArray(data)) setMessages(data);
    setLoading(false);
  }, 'AdminInboxSidebar.fetchMessages'), []);

  useEffect(() => {
    if (isOpen) fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleMarkRead(id, unreadCount) {
    setReadIds(prev => new Set([...prev, id]));
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    onUnreadChange(unreadCount);
  }

  function handleNavigateToReport() {
    onNavigate('referralReview', { initialTab: 'missing' });
    onClose();
  }

  const unreadCount = messages.filter(m => !m.read && !readIds.has(m.id)).length;

  if (!isOpen) return null;

  return (
    <>
      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } } @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 400,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0,
        width: 'min(320px, 100vw)',
        height: '100vh',
        background: AD.bgCard,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
        zIndex: 401,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.22s ease-out',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${AD.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: AD.fontDisplay, fontSize: 22, color: AD.textPrimary }}>Inbox</span>
            {unreadCount > 0 && (
              <span style={{
                background: AD.red,
                color: '#fff',
                fontSize: 12, fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 99,
                fontFamily: AD.fontSans,
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            title="Close inbox"
            style={{
              background: 'transparent', border: 'none',
              cursor: 'pointer', padding: 6, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: AD.textSecondary,
            }}
          >
            <i className="ph ph-x" style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Message list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 48, fontFamily: AD.fontSans, fontSize: 14, color: AD.textTertiary }}>
              No messages yet.
            </div>
          ) : (
            messages.map(msg => {
              if (msg.message_type === 'missing_referral') {
                return (
                  <MissingReferralCard
                    key={msg.id}
                    msg={{ ...msg, read: msg.read || readIds.has(msg.id) }}
                    onMarkRead={handleMarkRead}
                    onNavigate={handleNavigateToReport}
                  />
                );
              }
              if (msg.message_type === 'suggestion_box') {
                return (
                  <SuggestionBoxCard
                    key={msg.id}
                    msg={{ ...msg, read: msg.read || readIds.has(msg.id) }}
                    onMarkRead={handleMarkRead}
                  />
                );
              }
              return null;
            })
          )}
        </div>
      </div>
    </>
  );
}
