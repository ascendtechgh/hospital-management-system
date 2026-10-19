import { Link } from 'react-router-dom';

export default function AuthLayout({ children, mode }) {
  return (
    <main className={`auth-shell auth-shell-${mode}`}>
      <aside className="auth-showcase">
        <Link className="auth-brand" to="/" aria-label="AscendHMS homepage">
          <img src="/branding/ascendhms-logo.png" alt="AscendHMS" />
        </Link>
        <div className="auth-showcase-content">
          <span className="auth-showcase-kicker">A connected hospital</span>
          <h1>
            Better care starts with
            <span> working as one.</span>
          </h1>
          <p>
            One secure workspace for the people, patients and everyday work
            that keep your hospital moving.
          </p>
          <div className="auth-showcase-note">
            <span className="auth-showcase-check">✓</span>
            <span>
              <strong>One patient record.</strong>
              <small>Every team, in sync.</small>
            </span>
          </div>
        </div>
        <span className="auth-showcase-footer">
          ASCENDHMS <i /> BY ASCEND TECHNOLOGIES
        </span>
        <span className="auth-orb auth-orb-one" />
        <span className="auth-orb auth-orb-two" />
      </aside>

      <section className={`auth-panel auth-panel-${mode}`}>
        <Link className="auth-mobile-brand" to="/" aria-label="AscendHMS homepage">
          <img src="/branding/ascendhms-logo.png" alt="AscendHMS" />
        </Link>
        <div className="auth-panel-caption" aria-hidden="true">
          <span className="auth-panel-caption-mark">A</span>
          <span>{mode === 'signup' ? 'HOSPITAL WORKSPACE SETUP' : 'HOSPITAL STAFF PORTAL'}</span>
        </div>
        <div className="auth-card">
          {children}
          <p className="auth-legal">
            By continuing, you agree to use your hospital workspace
            responsibly.
          </p>
        </div>
        <p className="auth-panel-footer">
          {mode === 'signup' ? (
            <>
              Already have an account? <Link to="/login">Sign in</Link>
            </>
          ) : (
            <>
              New to AscendHMS? <Link to="/signup">Set up your hospital</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
