import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase, supabaseConfigError } from '../lib/supabase.js';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const profileRequest = useRef(0);
  const currentUserId = useRef(null);
  const loadedProfileUserId = useRef(null);
  const pendingProfileRequests = useRef(new Map());

  const reloadProfile = useCallback(async (activeSession) => {
    if (!supabase || !activeSession) {
      loadedProfileUserId.current = null;
      setProfile(null);
      return null;
    }

    const userId = activeSession.user.id;
    const existingRequest = pendingProfileRequests.current.get(userId);
    if (existingRequest?.requestId === profileRequest.current) {
      return existingRequest.promise;
    }

    const requestId = ++profileRequest.current;
    const promise = (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, hospital_id')
        .eq('id', userId)
        .maybeSingle();

      if (requestId !== profileRequest.current) {
        return null;
      }

      if (error) {
        loadedProfileUserId.current = null;
        setAuthError(error.message);
        setProfile(null);
        return null;
      }

      if (!data) {
        loadedProfileUserId.current = null;
        setAuthError(
          'Your account profile could not be found. Check that the Supabase migrations have been applied.',
        );
        setProfile(null);
        return null;
      }

      setAuthError(null);
      loadedProfileUserId.current = userId;
      setProfile(data);
      return data;
    })();

    pendingProfileRequests.current.set(userId, { requestId, promise });
    try {
      return await promise;
    } finally {
      if (pendingProfileRequests.current.get(userId)?.promise === promise) {
        pendingProfileRequests.current.delete(userId);
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let receivedAuthEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      receivedAuthEvent = true;
      const nextUserId = nextSession?.user?.id ?? null;
      const profileAlreadyLoaded =
        nextUserId !== null && loadedProfileUserId.current === nextUserId;
      currentUserId.current = nextUserId;
      setSession(nextSession);
      if (!nextSession) {
        profileRequest.current += 1;
        loadedProfileUserId.current = null;
        setProfile(null);
        setAuthError(null);
        setLoading(false);
        return;
      }

      setAuthError(null);
      setLoading(!profileAlreadyLoaded);
      if (event === 'TOKEN_REFRESHED' && profileAlreadyLoaded) {
        return;
      }

      window.setTimeout(() => {
        void reloadProfile(nextSession).finally(() => {
          if (currentUserId.current === nextSession.user.id) {
            setLoading(false);
          }
        });
      }, 0);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (receivedAuthEvent) {
        return;
      }
      if (error) {
        setAuthError(error.message);
        setLoading(false);
        return;
      }
      setSession(data.session);
      currentUserId.current = data.session?.user?.id ?? null;
      if (!data.session) {
        loadedProfileUserId.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }
      void reloadProfile(data.session).finally(() => setLoading(false));
    });

    return () => subscription.unsubscribe();
  }, [reloadProfile]);

  const profileRealtime = useRealtimeSubscription({
    table: 'profiles',
    filter: session?.user?.id ? `id=eq.${session.user.id}` : null,
    enabled: Boolean(session?.user?.id),
    onChange: () => {
      void reloadProfile(session);
    },
  });

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      authError,
      realtimeStatus: session ? profileRealtime.status : 'CLOSED',
      realtimeError: profileRealtime.error,
      reloadProfile,
      signOut: async () => {
        if (!supabase) {
          throw new Error(supabaseConfigError);
        }
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    }),
    [authError, loading, profile, profileRealtime.error, profileRealtime.status, reloadProfile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
