import { Link } from 'react-router-dom';

export default function AuthLayout({ children, mode }) {
  return (
    <main className={`auth-shell auth-shell-${mode}`}>
      <section className={`auth-panel auth-panel-${mode}`}>
        <div className="auth-card">
          {children}
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
