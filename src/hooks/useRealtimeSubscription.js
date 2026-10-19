import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useRealtimeSubscription({
  table,
  filter,
  enabled = true,
  onChange,
}) {
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState('CONNECTING');
  const [error, setError] = useState(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || !supabase) {
      setStatus(enabled ? 'UNAVAILABLE' : 'CLOSED');
      return undefined;
    }

    setStatus('CONNECTING');
    setError(null);

    const channel = supabase
      .channel(`realtime:${table}:${filter || 'all'}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => onChangeRef.current?.(payload),
      )
      .subscribe((nextStatus, subscribeError) => {
        setStatus(nextStatus);
        if (subscribeError) {
          setError(subscribeError.message);
        } else if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
          setError(`Realtime subscription failed with status ${nextStatus}.`);
        } else if (nextStatus === 'SUBSCRIBED') {
          setError(null);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, filter, table]);

  return { status, error };
}
