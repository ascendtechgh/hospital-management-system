import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useRealtimeSubscription } from '../../../hooks/useRealtimeSubscription.js';
import { staffRequest } from '../../../lib/staffApi.js';

const staffRoles = [
  { value: 'consulting', label: 'Consulting' },
  { value: 'nurse', label: 'Nursing' },
  { value: 'labs', label: 'Laboratory' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'reception', label: 'Reception' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'billing_claims', label: 'Billing & Claims' },
];

const roleLabels = Object.fromEntries(
  staffRoles.map(({ value, label }) => [value, label]),
);

function StaffPage() {
  const { role } = useParams();
  const { profile } = useAuth();
  const location = useLocation();
  const basePath = `/dashboard/${profile?.role || role}`;
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('cards');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    role: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const createDialogRef = useRef(null);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) {
      return;
    }

    if (showCreate && !dialog.open) {
      dialog.showModal();
    } else if (!showCreate && dialog.open) {
      dialog.close();
    }
  }, [showCreate]);

  function closeCreateDialog() {
    if (!saving) {
      setShowCreate(false);
    }
  }

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const result = await staffRequest('list');
      setStaff(result.staff || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load staff.');
    } finally {
      setLoading(false);
    }
  }, []);

  const realtime = useRealtimeSubscription({
    table: 'profiles',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: Boolean(profile?.hospital_id && profile.role === 'hospitaladmin'),
    onChange: () => {
      void loadStaff();
    },
  });

  useEffect(() => {
    if (profile?.role === 'hospitaladmin') {
      void loadStaff();
    }
  }, [loadStaff, profile?.role]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return staff;
    }
    return staff.filter((member) =>
      `${member.full_name} ${member.email} ${roleLabels[member.role] || member.role}`
        .toLowerCase()
        .includes(query),
    );
  }, [search, staff]);

  async function createStaff(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      await staffRequest('create', {
        full_name: newStaff.full_name,
        role: newStaff.role,
        email: newStaff.email,
        password: newStaff.password,
      });
      setNewStaff({ full_name: '', role: '', email: '', password: '' });
      setShowPassword(false);
      setShowCreate(false);
      await loadStaff();
    } catch (createError) {
      setFormError(createError.message || 'Could not create the staff account.');
    } finally {
      setSaving(false);
    }
  }

  if (profile?.role !== 'hospitaladmin') {
    return <Navigate to={basePath} replace />;
  }

  const departments = new Set(staff.map((member) => member.role)).size;

  return (
    <section className="staff-page">
      <div className="staff-page-heading">
        <div>
          <span className="workspace-overline">HOSPITAL TEAM</span>
          <h1>Staff</h1>
        </div>
        <button
          className="staff-primary-button"
          type="button"
          onClick={() => {
            setFormError('');
            setShowCreate(true);
          }}
        >
          <span aria-hidden="true">+</span>
          Add staff
        </button>
      </div>

      <div className="staff-stats" aria-label="Staff summary">
        <article className="staff-stat">
          <span className="staff-stat-icon staff-stat-icon-blue">◎</span>
          <span>
            <small>TOTAL STAFF</small>
            <strong>{loading ? '—' : staff.length}</strong>
          </span>
        </article>
        <article className="staff-stat">
          <span className="staff-stat-icon staff-stat-icon-violet">▦</span>
          <span>
            <small>TEAMS</small>
            <strong>{loading ? '—' : departments}</strong>
          </span>
        </article>
        <article className="staff-stat">
          <span
            className={`staff-stat-icon ${realtime.status === 'SUBSCRIBED' ? 'staff-stat-icon-blue' : 'staff-stat-icon-neutral'}`}
          >
            ⌁
          </span>
          <span>
            <small>LIVE UPDATES</small>
            <strong className="staff-stat-status">
              {realtime.status === 'SUBSCRIBED'
                ? 'Connected'
                : realtime.error
                  ? 'Unavailable'
                  : 'Connecting'}
            </strong>
          </span>
        </article>
      </div>

      {realtime.error && (
        <p className="auth-notice auth-notice-error" role="status">
          Staff updates are unavailable: {realtime.error}
        </p>
      )}
      {location.state?.notice && (
        <p className="settings-success" role="status" aria-live="polite">
          {location.state.notice}
        </p>
      )}
      {error && (
        <p className="auth-notice auth-notice-error" role="alert">
          {error}
          <button className="staff-inline-button" type="button" onClick={() => void loadStaff()}>
            Try again
          </button>
        </p>
      )}

      <dialog
        className="staff-create-dialog"
        ref={createDialogRef}
        aria-labelledby="staff-create-title"
        aria-describedby="staff-create-description"
        onCancel={(event) => {
          event.preventDefault();
          closeCreateDialog();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeCreateDialog();
          }
        }}
      >
        <div className="staff-modal-card">
          <div className="staff-modal-header">
            <span className="staff-modal-icon" aria-hidden="true">+</span>
            <button
              className="staff-close-button"
              type="button"
              aria-label="Close add staff form"
              onClick={closeCreateDialog}
              disabled={saving}
            >
              ×
            </button>
          </div>
          <span className="workspace-overline">NEW ACCOUNT</span>
          <h2 className="staff-modal-title" id="staff-create-title">Add a staff member</h2>
          <p className="staff-modal-description" id="staff-create-description">
            Create a hospital account and assign the right team role.
          </p>
          {formError && (
            <p className="auth-notice auth-notice-error" role="alert">
              {formError}
            </p>
          )}
          <form className="staff-form-grid" onSubmit={createStaff}>
            <label className="auth-field">
              <span>Name</span>
              <input
                name="full_name"
                autoComplete="name"
                maxLength={120}
                value={newStaff.full_name}
                onChange={(event) =>
                  setNewStaff((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="auth-field">
              <span>Role</span>
              <select
                name="role"
                value={newStaff.role}
                onChange={(event) =>
                  setNewStaff((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                required
              >
                <option value="" disabled>
                  Select role
                </option>
                {staffRoles.map((staffRole) => (
                  <option key={staffRole.value} value={staffRole.value}>
                    {staffRole.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={newStaff.email}
                onChange={(event) =>
                  setNewStaff((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <div className="auth-password-wrap">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={newStaff.password}
                  onChange={(event) =>
                    setNewStaff((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <div className="staff-form-actions">
              <button
                className="auth-button auth-button-back"
                type="button"
                onClick={closeCreateDialog}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="auth-button auth-button-primary staff-create-submit"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Creating account…' : 'Create staff account'}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      <section className={`staff-directory${view === 'cards' ? ' is-card-view' : ' is-list-view'}`}>
        <div className="staff-directory-toolbar">
          <div className="staff-directory-title">
            <h2>Team directory</h2>
            <span className="staff-directory-count">
              {loading ? 'Loading staff…' : `${filteredStaff.length} staff member${filteredStaff.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="staff-directory-actions">
            <label className="staff-search">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.2 4.2" />
              </svg>
              <input
                aria-label="Find a team member"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, or role"
              />
            </label>
            <div className="staff-view-toggle" role="group" aria-label="Directory view">
              <button
                className={view === 'cards' ? 'is-active' : ''}
                type="button"
                aria-label="Card view"
                aria-pressed={view === 'cards'}
                onClick={() => setView('cards')}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <rect x="2.5" y="2.5" width="6" height="6" rx="1.4" />
                  <rect x="11.5" y="2.5" width="6" height="6" rx="1.4" />
                  <rect x="2.5" y="11.5" width="6" height="6" rx="1.4" />
                  <rect x="11.5" y="11.5" width="6" height="6" rx="1.4" />
                </svg>
              </button>
              <button
                className={view === 'list' ? 'is-active' : ''}
                type="button"
                aria-label="List view"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 4.5h9M7.5 10h9m-9 5.5h9" />
                  <circle cx="3.5" cy="4.5" r=".75" />
                  <circle cx="3.5" cy="10" r=".75" />
                  <circle cx="3.5" cy="15.5" r=".75" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="staff-state">
            <span className="auth-spinner" aria-hidden="true" />
            Loading staff…
          </div>
        ) : filteredStaff.length ? (
          view === 'cards' ? (
            <div className="staff-card-grid">
              {filteredStaff.map((member) => (
                <StaffCard
                  key={member.id}
                  member={member}
                  basePath={basePath}
                />
              ))}
            </div>
          ) : (
            <div className="staff-table-wrap">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th scope="col">Staff member</th>
                    <th scope="col">Role</th>
                    <th scope="col">Email</th>
                    <th scope="col">Added</th>
                    <th scope="col">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <span className="staff-table-person">
                          <StaffAvatar name={member.full_name} />
                          <strong>{member.full_name}</strong>
                        </span>
                      </td>
                      <td>
                        <span className="staff-role-badge">
                          {roleLabels[member.role] || member.role}
                        </span>
                      </td>
                      <td>{member.email}</td>
                      <td>{formatDate(member.created_at)}</td>
                      <td>
                        <Link
                          className="staff-row-link"
                          to={`${basePath}/staff/${member.id}`}
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="staff-empty-state">
            <span className="staff-empty-icon">◎</span>
            <h3>{search ? 'No matching staff' : 'No staff accounts yet'}</h3>
            <p>
              {search
                ? 'Try another name, email address or role.'
                : 'Add a staff account to begin building your hospital team.'}
            </p>
            {!search && (
              <button
                className="staff-primary-button"
                type="button"
                onClick={() => setShowCreate(true)}
              >
                <span aria-hidden="true">+</span> Add first staff member
              </button>
            )}
          </div>
        )}
      </section>
    </section>
  );
}

function StaffAvatar({ name }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return <span className="staff-avatar">{initials || 'S'}</span>;
}

function StaffCard({ member, basePath }) {
  return (
    <article className="staff-card">
      <div className="staff-card-top">
        <StaffAvatar name={member.full_name} />
        <span className="staff-role-badge">
          {roleLabels[member.role] || member.role}
        </span>
      </div>
      <h3>{member.full_name}</h3>
      <p className="staff-card-email">{member.email}</p>
      <div className="staff-card-footer">
        <span>Added {formatDate(member.created_at)}</span>
        <Link to={`${basePath}/staff/${member.id}`} aria-label={`View ${member.full_name}`}>
          Details <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default StaffPage;
