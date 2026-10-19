import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { supabase, supabaseConfigError } from '../../lib/supabase.js';
import AuthLayout from './AuthLayout.jsx';

const initialHospital = {
  name: '',
  phone: '',
  email: '',
  address: '',
};

function FormNotice({ children, type = 'error' }) {
  if (!children) {
    return null;
  }

  return (
    <p className={`auth-notice auth-notice-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

function PasswordField({ value, onChange, revealed, onToggle }) {
  return (
    <div className="auth-password-wrap">
      <input
        name="password"
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <button
        className="password-toggle"
        type="button"
        onClick={onToggle}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        aria-pressed={revealed}
      >
        {revealed ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function HospitalDetailsForm({ hospital, setHospital, busy, onBack, onSubmit }) {
  const update = (field) => (event) =>
    setHospital((current) => ({ ...current, [field]: event.target.value }));

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="auth-field">
        <span>Hospital name</span>
        <input
          name="hospital_name"
          value={hospital.name}
          onChange={update('name')}
          autoComplete="organization"
          maxLength={120}
          required
        />
      </label>
      <div className="auth-field-row">
        <label className="auth-field">
          <span>Hospital phone</span>
          <input
            name="hospital_phone"
            type="tel"
            inputMode="tel"
            value={hospital.phone}
            onChange={update('phone')}
            autoComplete="tel"
            maxLength={40}
            required
          />
        </label>
        <label className="auth-field">
          <span>Hospital email</span>
          <input
            name="hospital_email"
            type="email"
            value={hospital.email}
            onChange={update('email')}
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
      </div>
      <label className="auth-field">
        <span>Hospital address</span>
        <textarea
          name="hospital_address"
          value={hospital.address}
          onChange={update('address')}
          autoComplete="street-address"
          maxLength={500}
          rows={2}
          required
        />
      </label>
      <div className="auth-form-actions">
        {onBack && (
          <button className="auth-button auth-button-back" type="button" onClick={onBack}>
            Back
          </button>
        )}
        <button className="auth-button auth-button-primary" type="submit" disabled={busy}>
          {busy ? 'Creating workspace…' : 'Create hospital workspace'}
          {!busy && <span aria-hidden="true">→</span>}
        </button>
      </div>
    </form>
  );
}

export default function SignUpForm({ setupOnly = false }) {
  const navigate = useNavigate();
  const { session, profile, loading, reloadProfile } = useAuth();
  const [step, setStep] = useState(setupOnly ? 2 : 1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [hospital, setHospital] = useState(initialHospital);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (loading || !session || !profile) {
      return;
    }

    if (profile.role !== 'hospitaladmin' || profile.hospital_id) {
      navigate(
        profile.role === 'superadmin'
          ? '/dashboard/superadmin'
          : `/dashboard/${profile.role}`,
        { replace: true },
      );
      return;
    }

    setStep(2);
    if (!setupOnly) {
      setNotice('You’re signed in. Continue by setting up your hospital.');
    }
  }, [loading, navigate, profile, session, setupOnly]);

  async function createAccount(event) {
    event.preventDefault();
    if (!supabase) {
      setError(supabaseConfigError);
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!data.session) {
        setNotice(
          'Your account was created, but Supabase did not start a session. Sign in to continue with hospital setup.',
        );
        return;
      }

      setCreatedSession(data.session);
      setStep(2);
      setNotice('');
    } catch (signupError) {
      setError(signupError.message || 'We couldn’t create your account.');
    } finally {
      setBusy(false);
    }
  }

  async function createHospital(event) {
    event.preventDefault();
    const activeSession = session ?? createdSession;
    if (!supabase || !activeSession) {
      setError(
        supabaseConfigError ||
          'Your session has expired. Sign in again to finish setting up your hospital.',
      );
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const { error: hospitalError } = await supabase.rpc(
        'create_hospital_for_current_user',
        {
          p_name: hospital.name.trim(),
          p_phone: hospital.phone.trim(),
          p_email: hospital.email.trim().toLowerCase(),
          p_address: hospital.address.trim(),
        },
      );

      if (hospitalError) {
        throw hospitalError;
      }

      const updatedProfile = await reloadProfile(activeSession);
      if (!updatedProfile?.hospital_id) {
        throw new Error(
          'The hospital was created, but your administrator profile did not refresh. Reload the page or sign in again.',
        );
      }

      navigate('/dashboard/hospitaladmin', { replace: true });
    } catch (setupError) {
      setError(setupError.message || 'We couldn’t create the hospital workspace.');
    } finally {
      setBusy(false);
    }
  }

  if (!setupOnly && !loading && session && !profile && step === 1) {
    return (
      <AuthLayout mode="signup">
        <FormNotice type="info">
          Your account is signed in, but its profile hasn’t loaded. Verify that
          the Supabase migrations are applied, then refresh this page.
        </FormNotice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout mode="signup">
      <div className="auth-heading">
        <span className="auth-kicker">
          {setupOnly ? 'HOSPITAL WORKSPACE' : 'GET STARTED'}
        </span>
        <h2>
          {setupOnly
            ? 'Finish setting up your hospital.'
            : step === 1
              ? 'Create your account.'
              : 'Set up your hospital.'}
        </h2>
        <p>
          {setupOnly
            ? 'Add your hospital details to open your administrator workspace.'
            : step === 1
              ? 'Start with your hospital administrator details.'
              : 'Your account is ready. Now create your hospital workspace.'}
        </p>
      </div>

      {!setupOnly && (
        <div className="signup-progress" aria-label={`Step ${step} of 2`}>
          <div className={`signup-progress-step${step >= 1 ? ' is-current' : ''}`}>
            <span>01</span> Your details
          </div>
          <span className="signup-progress-line" />
          <div className={`signup-progress-step${step >= 2 ? ' is-current' : ''}`}>
            <span>02</span> Your hospital
          </div>
        </div>
      )}

      <FormNotice>{supabaseConfigError}</FormNotice>
      <FormNotice>{error}</FormNotice>
      {notice && (
        <p className="auth-notice auth-notice-success" role="status" aria-live="polite">
          {notice}
        </p>
      )}

      {!setupOnly && step === 1 ? (
        <form className="auth-form" onSubmit={createAccount}>
          <label className="auth-field">
            <span>Full name</span>
            <input
              name="full_name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              maxLength={120}
              required
            />
          </label>
          <label className="auth-field">
            <span>Phone number</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              maxLength={40}
              required
            />
          </label>
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
            <PasswordField
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              revealed={revealed}
              onToggle={() => setRevealed((current) => !current)}
            />
            <small>Use at least 8 characters.</small>
          </label>
          <button className="auth-button auth-button-primary" type="submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Continue'}
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </form>
      ) : (
        <HospitalDetailsForm
          hospital={hospital}
          setHospital={setHospital}
          busy={busy}
          onBack={
            !setupOnly && !session && !createdSession
              ? () => {
                  setError('');
                  setStep(1);
                }
              : null
          }
          onSubmit={createHospital}
        />
      )}
    </AuthLayout>
  );
}
