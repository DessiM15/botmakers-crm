'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'react-toastify';

/**
 * Side-effect-only component that subscribes to Supabase Realtime
 * for new in-app notifications and dispatches CustomEvents + toasts.
 * Renders nothing.
 */
const RealtimeNotificationProvider = () => {
  const channelRef = useRef(null);
  const supabaseRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      // Fetch current user ID
      let userId;
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.id || !mounted) return;
        userId = data.id;
      } catch {
        return;
      }

      // Create browser Supabase client directly (avoids importing server-side db/client)
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      supabaseRef.current = supabase;

      const channel = supabase
        .channel('crm-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'in_app_notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new;
            if (!row) return;

            // Show toast
            toast.info(row.title || 'New notification', {
              autoClose: 5000,
              onClick: () => {
                if (row.link) {
                  window.location.href = row.link;
                }
              },
            });

            // Dispatch event for NotificationBell
            window.dispatchEvent(
              new CustomEvent('crm:new-notification', {
                detail: {
                  id: row.id,
                  type: row.type,
                  title: row.title,
                  body: row.body,
                  link: row.link,
                  createdAt: row.created_at,
                },
              })
            );
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    setup();

    return () => {
      mounted = false;
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return null;
};

export default RealtimeNotificationProvider;
