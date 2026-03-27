'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS, timeAgo } from '@/lib/utils/notification-helpers';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'leads', label: 'Leads' },
  { key: 'projects', label: 'Projects' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'clients', label: 'Clients' },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

const NotificationCenter = () => {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, filter, category });
      const res = await fetch(`/api/notifications/history?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch {
      toast.error('Failed to load notifications');
    }
    setLoading(false);
  }, [page, filter, category]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Listen for real-time notification events
  useEffect(() => {
    const handleNewNotification = () => {
      fetchNotifications();
    };
    window.addEventListener('crm:new-notification', handleNewNotification);
    return () => window.removeEventListener('crm:new-notification', handleNewNotification);
  }, [fetchNotifications]);

  const handleCategoryChange = (key) => {
    setCategory(key);
    setPage(1);
  };

  const handleFilterChange = (key) => {
    setFilter(key);
    setPage(1);
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch {
      toast.error('Failed to mark all as read');
    }
    setMarkingAll(false);
  };

  const handleToggleRead = async (e, notification) => {
    e.stopPropagation();
    const action = notification.isRead ? 'mark_unread' : 'mark_read';
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notificationId: notification.id }),
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, isRead: !n.isRead } : n
        )
      );
    } catch {
      toast.error('Failed to update notification');
    }
  };

  const handleClick = async (notification) => {
    if (!notification.isRead) {
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read', notificationId: notification.id }),
        });
      } catch {
        // Silently fail
      }
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <h4 className="text-white fw-semibold mb-0">Notifications</h4>
          {total > 0 && (
            <span
              className="badge fw-medium"
              style={{ background: '#0d6efd22', color: '#0d6efd', fontSize: '12px' }}
            >
              {total} total
            </span>
          )}
        </div>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={handleMarkAllRead}
          disabled={markingAll}
        >
          {markingAll ? (
            <span className="spinner-border spinner-border-sm me-1" />
          ) : (
            <Icon icon="mdi:check-all" className="me-1" style={{ fontSize: '16px' }} />
          )}
          Mark all as read
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <div className="d-flex flex-wrap align-items-center gap-4">
            <div className="d-flex align-items-center gap-2">
              <span className="text-secondary-light text-xs fw-medium text-uppercase" style={{ letterSpacing: '0.5px' }}>
                Category:
              </span>
              <div className="d-flex gap-1 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    className={`btn btn-sm ${category === c.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                    style={{ fontSize: '12px', padding: '3px 10px' }}
                    onClick={() => handleCategoryChange(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="text-secondary-light text-xs fw-medium text-uppercase" style={{ letterSpacing: '0.5px' }}>
                Status:
              </span>
              <div className="d-flex gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                    style={{ fontSize: '12px', padding: '3px 10px' }}
                    onClick={() => handleFilterChange(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification List */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <span className="spinner-border spinner-border-sm text-secondary-light" />
              <p className="text-secondary-light text-sm mt-2 mb-0">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-5">
              <Icon
                icon="mdi:bell-check-outline"
                className="text-secondary-light mb-3"
                style={{ fontSize: '48px' }}
              />
              <p className="text-secondary-light text-sm mb-0">No notifications found</p>
            </div>
          ) : (
            notifications.map((n) => {
              const icon = NOTIFICATION_ICONS[n.type] || 'mdi:bell-outline';
              const color = NOTIFICATION_COLORS[n.type] || '#6c757d';
              return (
                <div
                  key={n.id}
                  className="d-flex align-items-center gap-3 px-3 py-2"
                  style={{
                    cursor: n.link ? 'pointer' : 'default',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: n.isRead ? 'transparent' : 'rgba(13,110,253,0.06)',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => handleClick(n)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(13,110,253,0.06)'; }}
                >
                  {/* Unread dot */}
                  <div className="flex-shrink-0" style={{ width: '8px' }}>
                    {!n.isRead && (
                      <div
                        className="rounded-circle"
                        style={{ width: '8px', height: '8px', background: '#0d6efd' }}
                      />
                    )}
                  </div>

                  {/* Icon */}
                  <div
                    className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                    style={{
                      width: '32px',
                      height: '32px',
                      background: `${color}22`,
                      color,
                    }}
                  >
                    <Icon icon={icon} style={{ fontSize: '16px' }} />
                  </div>

                  {/* Content */}
                  <div className="flex-grow-1 min-w-0">
                    <p className={`text-sm mb-0 ${n.isRead ? 'text-secondary-light' : 'text-white fw-medium'}`} style={{ lineHeight: 1.4 }}>
                      {n.title}
                    </p>
                    {n.body && n.body !== n.title && (
                      <p className="text-secondary-light mb-0" style={{ fontSize: '12px', lineHeight: 1.3 }}>
                        {n.body.length > 120 ? n.body.slice(0, 120) + '...' : n.body}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <span className="text-secondary-light flex-shrink-0" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {timeAgo(n.createdAt)}
                  </span>

                  {/* Toggle read/unread */}
                  <button
                    className="btn btn-sm p-1 text-secondary-light flex-shrink-0"
                    onClick={(e) => handleToggleRead(e, n)}
                    title={n.isRead ? 'Mark as unread' : 'Mark as read'}
                    style={{ lineHeight: 1 }}
                  >
                    <Icon
                      icon={n.isRead ? 'mdi:eye-off-outline' : 'mdi:eye-outline'}
                      style={{ fontSize: '16px' }}
                    />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-3">
          <ul className="pagination pagination-sm justify-content-center mb-0">
            <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
              <button
                className="page-link"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
            </li>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <li key={pageNum} className={`page-item ${page === pageNum ? 'active' : ''}`}>
                  <button className="page-link" onClick={() => setPage(pageNum)}>
                    {pageNum}
                  </button>
                </li>
              );
            })}
            <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
              <button
                className="page-link"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}
    </>
  );
};

export default NotificationCenter;
