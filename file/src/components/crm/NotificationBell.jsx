'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS, timeAgo } from '@/lib/utils/notification-helpers';

const NotificationBell = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setCount(data.count || 0);
    } catch {
      // Silently fail
    }
  }, []);

  // Initial fetch + poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Listen for real-time notification events
  useEffect(() => {
    const handleNewNotification = () => {
      fetchNotifications();
    };
    window.addEventListener('crm:new-notification', handleNewNotification);
    return () => window.removeEventListener('crm:new-notification', handleNewNotification);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleMarkRead = async (notificationId, link) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', notificationId }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
    if (link) {
      setOpen(false);
      router.push(link);
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      setNotifications([]);
      setCount(0);
    } catch {
      // Silently fail
    }
    setLoading(false);
  };

  return (
    <div className="position-relative" ref={dropdownRef}>
      <button
        type="button"
        className="d-flex justify-content-center align-items-center rounded-circle position-relative bg-transparent border-0"
        style={{ width: '40px', height: '40px' }}
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Icon
          icon="mdi:bell-outline"
          className="text-white"
          style={{ fontSize: '22px' }}
        />
        {count > 0 && (
          <span
            className="position-absolute d-flex align-items-center justify-content-center rounded-circle text-white fw-bold"
            style={{
              top: '2px',
              right: '2px',
              width: '18px',
              height: '18px',
              fontSize: '10px',
              background: '#dc3545',
            }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="position-absolute shadow-lg"
          style={{
            top: '48px',
            right: 0,
            width: '360px',
            maxHeight: '420px',
            background: '#111b2e',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)',
            zIndex: 1050,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="d-flex align-items-center justify-content-between px-3 py-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <h6 className="text-white fw-semibold mb-0 text-sm">Notifications</h6>
            {count > 0 && (
              <button
                className="btn btn-link text-primary p-0 text-xs text-decoration-none"
                onClick={handleMarkAllRead}
                disabled={loading}
              >
                {loading ? 'Clearing...' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="text-center py-4">
                <Icon
                  icon="mdi:bell-check-outline"
                  className="text-secondary-light mb-2"
                  style={{ fontSize: '32px' }}
                />
                <p className="text-secondary-light text-xs mb-0">All caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const icon = NOTIFICATION_ICONS[n.type] || 'mdi:bell-outline';
                const color = NOTIFICATION_COLORS[n.type] || '#6c757d';
                return (
                  <div
                    key={n.id}
                    className="d-flex align-items-start gap-3 px-3 py-2"
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: 'rgba(13,110,253,0.04)',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => handleMarkRead(n.id, n.link)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(13,110,253,0.04)'; }}
                  >
                    <div
                      className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0 mt-1"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: `${color}22`,
                        color,
                      }}
                    >
                      <Icon icon={icon} style={{ fontSize: '16px' }} />
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <p className="text-white text-xs fw-medium mb-0" style={{ lineHeight: 1.4 }}>
                        {n.title}
                      </p>
                      {n.body && n.body !== n.title && (
                        <p
                          className="text-secondary-light mb-0"
                          style={{ fontSize: '11px', lineHeight: 1.3 }}
                        >
                          {n.body.length > 80 ? n.body.slice(0, 80) + '...' : n.body}
                        </p>
                      )}
                      <span className="text-secondary-light" style={{ fontSize: '10px' }}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            className="text-center py-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <button
              className="btn btn-link text-primary p-0 text-xs text-decoration-none"
              onClick={() => { setOpen(false); router.push('/notifications'); }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
