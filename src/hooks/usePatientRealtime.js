import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function usePatientRealtime(hospitalId, onChange) {
  const [status, setStatus] = useState('CLOSED');
  const [error, setError] = useState('');
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!supabase || !hospitalId) {
      setStatus('UNAVAILABLE');
      return undefined;
    }

    let active = true;
    let channel;
    setStatus('CONNECTING');
    setError('');

    supabase.realtime.setAuth().then(() => {
      if (!active) return;
      channel = supabase
        .channel(`hospital:${hospitalId}:patients`, { config: { private: true } })
        .on('broadcast', { event: 'patient_change' }, (payload) => onChangeRef.current?.(payload))
        .subscribe((nextStatus, subscribeError) => {
          if (!active) return;
          setStatus(nextStatus);
          if (subscribeError) {
            setError(subscribeError.message);
          } else if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
            setError(`Patient live updates failed with status ${nextStatus}.`);
          } else if (nextStatus === 'SUBSCRIBED') {
            setError('');
          }
        });
    }).catch((subscribeError) => {
      if (!active) return;
      setStatus('CHANNEL_ERROR');
      setError(subscribeError.message || 'Could not authorize patient live updates.');
    });

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [hospitalId]);

  return { status, error };
}
