import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { supabase, supabaseConfigError } from '../../lib/supabase.js';

function SignInPage() {
  const navigate = useNavigate();
  const { session, profile, loading, reloadProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && session && profile) {
      if (profile.role === 'hospitaladmin' && !profile.hospital_id) {
        navigate('/setup-hospital', { replace: true });
      } else {
        navigate(`/dashboard/${profile.role}`, { replace: true });
      }
    }
  }, [loading, navigate, profile, session]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!supabase) {
      setError(supabaseConfigError);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        throw signInError;
      }

      const profile = await reloadProfile(data.session);
      if (!profile) {
        throw new Error(
          'You’re signed in, but your profile could not be loaded. Check that the migrations have been applied.',
        );
      }

      if (profile.role === 'hospitaladmin' && !profile.hospital_id) {
        navigate('/setup-hospital', { replace: true });
      } else {
        navigate(`/dashboard/${profile.role}`, { replace: true });
      }
    } catch (signInError) {
      setError(signInError.message || 'We couldn’t sign you in.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AuthLayout mode="signin">
        <span className="auth-spinner" aria-label="Checking your session" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout mode="signin">
      <div className="auth-heading">
        <span className="auth-kicker">WELCOME BACK</span>
      </div>
      {supabaseConfigError && (
        <p className="auth-notice auth-notice-error" role="alert">
          {supabaseConfigError}
        </p>
      )}
      {error && (
        <p className="auth-notice auth-notice-error" role="alert">
          {error}
        </p>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>Email address</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <div className="auth-password-wrap">
            <input
              name="password"
              type={revealed ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setRevealed((current) => !current)}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
            >
              {revealed ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        <button className="auth-button auth-button-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
          {!busy && <span aria-hidden="true">→</span>}
        </button>
      </form>
    </AuthLayout>
  );
}

export default SignInPage;
