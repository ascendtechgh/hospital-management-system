import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabaseConfigError } from '../lib/supabase.js';

function RouteMessage({ children }) {
  return (
    <main className="route-message">
      <div className="route-message-card">{children}</div>
    </main>
  );
}

export default function ProtectedRoute({ children, requiredRole }) {
  const { session, profile, loading, authError } = useAuth();

  if (supabaseConfigError) {
    return <RouteMessage>{supabaseConfigError}</RouteMessage>;
  }

  if (loading) {
    return (
      <RouteMessage>
        <span className="auth-spinner" aria-hidden="true" />
        <span>Checking your workspace…</span>
      </RouteMessage>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (authError) {
    return <RouteMessage>{authError}</RouteMessage>;
  }

  if (!profile) {
    return <RouteMessage>We couldn't load your account profile.</RouteMessage>;
  }

  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to={`/dashboard/${profile.role}`} replace />;
  }

  if (profile.role !== 'superadmin' && !profile.hospital_id) {
    if (profile.role === 'hospitaladmin') {
      return <Navigate to="/setup-hospital" replace />;
    }
    return (
      <RouteMessage>
        Your staff account hasn’t been assigned to a hospital yet. Contact your
        hospital administrator.
      </RouteMessage>
    );
  }

  return children ?? <Outlet />;
}
