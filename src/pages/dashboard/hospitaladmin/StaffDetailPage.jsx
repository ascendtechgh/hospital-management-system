import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useRealtimeSubscription } from '../../../hooks/useRealtimeSubscription.js';
import { staffRequest } from '../../../lib/staffApi.js';

const staffRoles = [
  { value: 'consulting', label: 'Consulting' },
  { value: 'nurse', label: 'Nursing' },
  { value: 'labs', label: 'Laboratory' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'reception', label: 'Reception' },
];

function StaffDetailPage() {
  const { role, staffId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const basePath = `/dashboard/${profile?.role || role}`;
  const [staff, setStaff] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStaff = useCallback(async () => {
    if (!staffId || profile?.role !== 'hospitaladmin') {
      setLoading(false);
      return;
    }

    try {
      const result = await staffRequest('read', { staff_id: staffId });
      setStaff(result.staff);
      setForm({
        full_name: result.staff.full_name,
        email: result.staff.email,
        role: result.staff.role,
      });
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load the staff account.');
    } finally {
      setLoading(false);
    }
  }, [profile?.role, staffId]);

  useRealtimeSubscription({
    table: 'profiles',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: Boolean(profile?.hospital_id && profile.role === 'hospitaladmin'),
    onChange: () => {
      void loadStaff();
    },
  });

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  async function saveStaff(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await staffRequest('update', {
        staff_id: staffId,
        full_name: form.full_name,
        email: form.email,
        role: form.role,
      });
      setStaff(result.staff);
      setForm({
        full_name: result.staff.full_name,
        email: result.staff.email,
        role: result.staff.role,
      });
      setSuccess('Staff details saved.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save staff details.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStaff() {
    if (
      !window.confirm(
        `Delete ${staff?.full_name || 'this staff account'}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await staffRequest('delete', { staff_id: staffId });
      navigate(`${basePath}/staff`, {
        replace: true,
        state: { notice: 'Staff account deleted.' },
      });
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete the staff account.');
    } finally {
      setDeleting(false);
    }
  }

  if (profile?.role !== 'hospitaladmin') {
    return <Navigate to={basePath} replace />;
  }

  return (
    <section className="staff-detail-page">
      <Link className="staff-back-link" to={`${basePath}/staff`}>
        <span aria-hidden="true">←</span> Staff directory
      </Link>
      {loading ? (
        <div className="staff-state staff-detail-loading">
          <span className="auth-spinner" aria-hidden="true" />
          Loading staff details…
        </div>
      ) : error && !staff ? (
        <div className="staff-detail-error">
          <p className="auth-notice auth-notice-error" role="alert">
            {error}
          </p>
          <button
            className="auth-button auth-button-back"
            type="button"
            onClick={() => void loadStaff()}
          >
            Try again
          </button>
        </div>
      ) : staff ? (
        <>
          <div className="staff-detail-heading">
            <div className="staff-detail-person">
              <span className="staff-detail-avatar">
                {staff.full_name.trim().charAt(0).toUpperCase()}
              </span>
              <div>
                <span className="workspace-overline">STAFF ACCOUNT</span>
                <h1>{staff.full_name}</h1>
                <span className="staff-role-badge">
                  {staffRoles.find((item) => item.value === staff.role)?.label || staff.role}
                </span>
              </div>
            </div>
            <button
              className="staff-delete-button"
              type="button"
              onClick={() => void deleteStaff()}
              disabled={deleting || saving}
            >
              {deleting ? 'Deleting…' : 'Delete staff'}
            </button>
          </div>

          <article className="workspace-panel staff-detail-panel">
            <div className="staff-detail-section-heading">
              <div>
                <span className="workspace-overline">STAFF INFORMATION</span>
                <h2>Account details</h2>
              </div>
              <span className="staff-detail-id">ID · {staff.id.slice(0, 8)}</span>
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

            <form className="staff-detail-form" onSubmit={saveStaff}>
              <label className="auth-field">
                <span>Name</span>
                <input
                  name="full_name"
                  autoComplete="name"
                  maxLength={120}
                  value={form.full_name}
                  onChange={updateField('full_name')}
                  required
                />
              </label>
              <label className="auth-field">
                <span>Role</span>
                <select name="role" value={form.role} onChange={updateField('role')} required>
                  {staffRoles.map((staffRole) => (
                    <option key={staffRole.value} value={staffRole.value}>
                      {staffRole.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="auth-field staff-detail-wide">
                <span>Email address</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={form.email}
                  onChange={updateField('email')}
                  required
                />
              </label>
              <div className="staff-detail-meta staff-detail-wide">
                <span>
                  <small>Account created</small>
                  <strong>{formatDate(staff.created_at)}</strong>
                </span>
                <span>
                  <small>Hospital ID</small>
                  <strong>{staff.hospital_id}</strong>
                </span>
              </div>
              <div className="staff-detail-actions staff-detail-wide">
                <button
                  className="auth-button auth-button-back"
                  type="button"
                  onClick={() => navigate(`${basePath}/staff`)}
                  disabled={saving || deleting}
                >
                  Cancel
                </button>
                <button
                  className="auth-button auth-button-primary"
                  type="submit"
                  disabled={saving || deleting}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </article>
        </>
      ) : (
        <p className="auth-notice auth-notice-error">
          Staff account could not be loaded.
        </p>
      )}
    </section>
  );
}

function formatDate(dateValue) {
  if (!dateValue) {
    return '—';
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default StaffDetailPage;
