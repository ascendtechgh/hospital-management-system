import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

function SettingsPage() {
  const { profile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function updatePassword(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }
      setPassword('');
      setConfirmPassword('');
      setSuccess('Your password has been updated.');
    } catch (updateError) {
      setError(updateError.message || 'We couldn’t update your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dashboard-subpage">
      <div className="subpage-heading">
        <span className="workspace-overline">ACCOUNT</span>
        <h1>Settings</h1>
        <p>Manage your sign-in security and account preferences.</p>
      </div>
      <article className="workspace-panel settings-panel">
        <div className="settings-panel-heading">
          <span className="settings-icon">⌑</span>
          <div>
            <h2>Password &amp; security</h2>
            <p>Change the password for your personal account.</p>
          </div>
        </div>
        {error && (
          <p className="auth-notice auth-notice-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="settings-success" role="status" aria-live="polite">
            {success}
          </p>
        )}
        <form className="settings-password-form" onSubmit={updatePassword}>
          <label className="auth-field">
            <span>New password</span>
            <div className="auth-password-wrap">
              <input
                type={revealed ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
          <label className="auth-field">
            <span>Confirm new password</span>
            <input
              type={revealed ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
          <button className="auth-button auth-button-primary settings-save" type="submit" disabled={busy}>
            {busy ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      </article>
      <article className="workspace-panel settings-identity">
        <span className="settings-icon settings-icon-muted">◎</span>
        <div>
          <h2>Account identity</h2>
          <p>
            Signed in as <strong>{profile?.full_name}</strong> · {profile?.role}
          </p>
        </div>
        <Link className="dashboard-text-link" to={`../${profile?.role}/profile`}>
          View profile <span aria-hidden="true">→</span>
        </Link>
      </article>
      <Link
        className="dashboard-text-link subpage-back-link"
        to={`/dashboard/${profile?.role}`}
      >
        <span aria-hidden="true">←</span> Back to dashboard
      </Link>
    </section>
  );
}

export default SettingsPage;
