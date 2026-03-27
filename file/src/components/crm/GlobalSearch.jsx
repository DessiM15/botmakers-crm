'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';

const TYPE_CONFIG = {
  lead: { icon: 'mdi:account-star-outline', color: '#03FF00', label: 'Leads' },
  client: { icon: 'mdi:account-tie', color: '#198754', label: 'Clients' },
  project: { icon: 'solar:folder-with-files-outline', color: '#0dcaf0', label: 'Projects' },
  proposal: { icon: 'mdi:file-document-edit-outline', color: '#0d6efd', label: 'Proposals' },
  invoice: { icon: 'mdi:receipt-text-outline', color: '#ffc107', label: 'Invoices' },
};

const GlobalSearch = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // Open/close with Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-focus input when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const navigate = useCallback(
    (link) => {
      setOpen(false);
      router.push(link);
    },
    [router]
  );

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex].link);
    }
  };

  // Group results by type
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  // Flat index tracking for keyboard nav
  let flatIndex = -1;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 2000,
        }}
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 560,
          background: '#111b2e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          zIndex: 2001,
          overflow: 'hidden',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="d-flex align-items-center px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Icon
            icon="mdi:magnify"
            className="text-secondary-light me-2"
            style={{ fontSize: 20 }}
          />
          <input
            ref={inputRef}
            type="text"
            className="form-control bg-transparent text-white border-0 shadow-none"
            placeholder="Search leads, clients, projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ fontSize: 15 }}
          />
          {loading && (
            <span className="spinner-border spinner-border-sm text-secondary-light" />
          )}
          <kbd
            className="ms-2 text-secondary-light"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
          {!query || query.length < 2 ? (
            <div className="text-center py-4">
              <span className="text-secondary-light text-sm">Type to search across your CRM...</span>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="text-center py-4">
              <Icon icon="mdi:search-web" className="text-secondary-light mb-2" style={{ fontSize: 32 }} />
              <p className="text-secondary-light text-sm mb-0">No results found</p>
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => {
              const cfg = TYPE_CONFIG[type];
              return (
                <div key={type}>
                  <div
                    className="px-3 py-1"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#6c757d',
                    }}
                  >
                    {cfg?.label || type}
                  </div>
                  {items.map((item) => {
                    flatIndex++;
                    const idx = flatIndex;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`${type}-${item.id}`}
                        className="d-flex align-items-center gap-3 w-100 border-0 text-start"
                        style={{
                          padding: '8px 12px',
                          background: isSelected ? 'rgba(3,52,87,0.5)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onClick={() => navigate(item.link)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <Icon
                          icon={cfg?.icon || 'mdi:circle'}
                          style={{ fontSize: 18, color: cfg?.color || '#6c757d', flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className="text-white text-sm fw-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div className="text-secondary-light" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                        <Icon
                          icon="mdi:chevron-right"
                          className="ms-auto text-secondary-light"
                          style={{ fontSize: 16, flexShrink: 0 }}
                        />
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: 11,
            color: '#6c757d',
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <kbd style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>↑↓</kbd>
            <span>Navigate</span>
            <kbd style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>↵</kbd>
            <span>Open</span>
          </div>
          <div className="d-flex align-items-center gap-1">
            <kbd style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>⌘K</kbd>
            <span>Toggle</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default GlobalSearch;
