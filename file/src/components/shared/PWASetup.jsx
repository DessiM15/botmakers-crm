'use client';

import { useEffect, useState } from 'react';

const PWASetup = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — non-critical
      });
    }

    // Listen for install prompt
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);

      // Only show banner if user hasn't dismissed it
      const dismissed = localStorage.getItem('pwa-banner-dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', '1');
  };

  if (!showBanner) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#033457',
        color: '#fff',
        borderRadius: '12px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        maxWidth: '420px',
        width: 'calc(100% - 32px)',
        fontSize: '13px',
      }}
    >
      <img
        src='/icons/icon-192.png'
        alt=''
        style={{ width: 36, height: 36, borderRadius: 8 }}
      />
      <div style={{ flex: 1 }}>
        <div className='fw-semibold' style={{ marginBottom: 2 }}>
          Install Botmakers
        </div>
        <div style={{ opacity: 0.7, fontSize: '12px' }}>
          Add to your home screen for quick access
        </div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          background: '#03FF00',
          color: '#033457',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 14px',
          fontWeight: 700,
          fontSize: '12px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          fontSize: '18px',
          padding: '0 4px',
          lineHeight: 1,
        }}
        aria-label='Dismiss'
      >
        &times;
      </button>
    </div>
  );
};

export default PWASetup;
