import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription.js';
import { usePatientRealtime } from '../../hooks/usePatientRealtime.js';
import { staffRequest } from '../../lib/staffApi.js';
import { patientRequest } from '../../lib/patientApi.js';

const departmentWorkspaces = {
  hospitaladmin: {
    title: 'Hospital operations',
    description: 'Manage staff accounts and review the active patient directory.',
    actions: [
      { label: 'Manage staff', to: '/dashboard/hospitaladmin/staff' },
      { label: 'Patient directory', to: '/dashboard/hospitaladmin/patients' },
    ],
  },
  consulting: {
    title: 'Clinical care',
    description: 'Continue a visit or review a checked-in patient’s clinical record.',
    actions: [
      { label: 'Consultation queue', to: '/dashboard/consulting/consultations' },
      { label: 'Patient records', to: '/dashboard/consulting/patients' },
    ],
  },
  nurse: {
    title: 'Nursing',
    description: 'Record observations for patients currently in the hospital.',
    actions: [
      { label: 'Check vitals', to: '/dashboard/nurse/vitals' },
      { label: 'Patient records', to: '/dashboard/nurse/patients' },
    ],
  },
  labs: {
    title: 'Laboratory',
    description: 'Process requested tests and record results against patient records.',
    actions: [
      { label: 'Laboratory queue', to: '/dashboard/labs/lab-orders' },
      { label: 'Patient records', to: '/dashboard/labs/patients' },
    ],
  },
  pharmacy: {
    title: 'Pharmacy',
    description: 'Review prescriptions and record dispensing for checked-in patients.',
    actions: [
      { label: 'Prescription queue', to: '/dashboard/pharmacy/dispensing' },
      { label: 'Patient records', to: '/dashboard/pharmacy/patients' },
    ],
  },
  reception: {
    title: 'Reception',
    description: 'Register patients, review records, and check arrivals into care.',
    actions: [
      { label: 'Patient directory', to: '/dashboard/reception/patients' },
    ],
  },
};

function DashboardHome({ role: dashboardRole }) {
  const { profile, user } = useAuth();
  const {
    hospital,
    hospitalLoading,
    hospitalRealtimeStatus,
    hospitalRealtimeError,
    notificationRealtimeStatus,
    notificationRealtimeError,
    unreadCount,
  } = useOutletContext();
  const activeRole = dashboardRole || profile?.role;
  const isHospitalAdmin = activeRole === 'hospitaladmin';
  const canViewPatients = activeRole && activeRole !== 'superadmin';
  const basePath = `/dashboard/${profile?.role || activeRole}`;
  const department = departmentWorkspaces[activeRole];
  const [staffCount, setStaffCount] = useState(null);
  const [staffError, setStaffError] = useState('');
  const [checkedInPatients, setCheckedInPatients] = useState([]);
  const [patientError, setPatientError] = useState('');
  const activePatients = checkedInPatients
    .filter((patient) => patient.checked_in_at)
    .sort((left, right) => new Date(right.checked_in_at) - new Date(left.checked_in_at));
  const workspaceName = hospital?.name || (profile?.role === 'superadmin' ? 'AscendHMS' : 'Your hospital');
  const lastLogin = user?.last_sign_in_at
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(user.last_sign_in_at))
    : 'This session';

  const loadStaffCount = useCallback(async () => {
    if (!isHospitalAdmin) {
      return;
    }

    try {
      const result = await staffRequest('list');
      setStaffCount(result.staff?.length ?? 0);
      setStaffError('');
    } catch (error) {
      setStaffError(error.message || 'Could not load staff count.');
    }
  }, [isHospitalAdmin]);

  useEffect(() => {
    void loadStaffCount();
  }, [loadStaffCount]);

  useRealtimeSubscription({
    table: 'profiles',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: isHospitalAdmin && Boolean(profile?.hospital_id),
    onChange: () => {
      void loadStaffCount();
    },
  });

  const loadCheckedInPatients = useCallback(async () => {
    if (!canViewPatients) return;
    try {
      const result = await patientRequest('list');
      setCheckedInPatients(result.patients || []);
      setPatientError('');
    } catch (error) {
      setPatientError(error.message || 'Could not load checked-in patients.');
    }
  }, [canViewPatients]);

  useEffect(() => {
    void loadCheckedInPatients();
  }, [loadCheckedInPatients]);

  usePatientRealtime(profile?.hospital_id, () => {
    void loadCheckedInPatients();
  });

  return (
    <div className="dashboard-home">
      <section
        className={`dashboard-stat-grid${isHospitalAdmin ? ' has-staff-stat' : ''}${canViewPatients ? ' has-patients-stat' : ''}`}
        aria-label="Workspace summary"
      >
        <article className="dashboard-stat-card">
          <span className="stat-icon stat-icon-blue">⌂</span>
          <span className="stat-label">HOSPITAL WORKSPACE</span>
          <strong className="stat-value">
            {hospitalLoading ? 'Loading…' : workspaceName}
          </strong>
          <small>{hospital?.id || (profile?.role === 'superadmin' ? 'Platform administration' : 'Workspace')}</small>
        </article>
        <article className="dashboard-stat-card">
          <span className="stat-icon stat-icon-violet">◎</span>
          <span className="stat-label">SIGNED-IN ACCOUNT</span>
          <strong className="stat-value">{profile?.full_name || 'Account'}</strong>
          <small>{user?.email}</small>
        </article>
        <article className="dashboard-stat-card">
          <span className="stat-icon stat-icon-cyan">⌁</span>
          <span className="stat-label">LIVE CONNECTION</span>
          <strong className="stat-value">
            {hospitalRealtimeStatus === 'SUBSCRIBED' ||
            notificationRealtimeStatus === 'SUBSCRIBED'
              ? 'Connected'
              : hospitalRealtimeError || notificationRealtimeError
                ? 'Unavailable'
                : 'Connecting'}
          </strong>
          <small>
            {unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Waiting for workspace updates'}
          </small>
        </article>
        {isHospitalAdmin && (
          <Link
            className="dashboard-stat-card dashboard-staff-stat"
            to="/dashboard/hospitaladmin/staff"
          >
            <span className="stat-icon stat-icon-staff">◉</span>
            <span className="stat-label">HOSPITAL STAFF</span>
            <strong className="stat-value">
              {staffCount === null ? '—' : staffCount}
            </strong>
            <small>{staffError || 'Manage team accounts'} <span aria-hidden="true">→</span></small>
          </Link>
        )}
        {canViewPatients && (
          <Link
            className="dashboard-stat-card dashboard-patients-stat"
            to={`${basePath}/patients`}
          >
            <span className="stat-icon stat-icon-patients">◎</span>
            <span className="stat-label">CHECKED-IN PATIENTS</span>
            <strong className="stat-value">{patientError ? '—' : activePatients.length}</strong>
            <small>{patientError || 'View active patients'} <span aria-hidden="true">→</span></small>
          </Link>
        )}
      </section>

      {staffError && (
        <p className="auth-notice auth-notice-error dashboard-staff-error" role="status">
          Staff summary unavailable: {staffError}
        </p>
      )}

      <section
        className={`dashboard-lower-grid${department ? ' has-department' : ''}`}
      >
        <article className="workspace-panel workspace-details-panel">
          <div className="workspace-panel-heading">
            <div>
              <span className="workspace-overline">YOUR WORKSPACE</span>
              <h2>{hospital ? hospital.name : profile?.role === 'superadmin' ? 'AscendHMS platform' : 'Workspace details'}</h2>
            </div>
            {hospital && <span className="workspace-status"><i /> Active</span>}
          </div>
          {hospitalLoading ? (
            <div className="workspace-loading">
              <span className="auth-spinner" aria-hidden="true" />
              Loading workspace details…
            </div>
          ) : hospital ? (
            <dl className="workspace-details">
              <div>
                <dt>Hospital ID</dt>
                <dd>{hospital.id}</dd>
              </div>
              <div>
                <dt>Contact number</dt>
                <dd>{hospital.phone}</dd>
              </div>
              <div>
                <dt>Hospital email</dt>
                <dd>{hospital.email}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{hospital.address}</dd>
              </div>
            </dl>
          ) : profile?.role === 'superadmin' ? (
            <div className="workspace-superadmin-note">
              <span>◎</span>
              <p>
                You’re signed in as a platform administrator. This account
                isn’t scoped to a hospital.
              </p>
            </div>
          ) : (
            <p className="workspace-empty">
              Hospital details aren’t available right now. Refresh to try again.
            </p>
          )}
        </article>

        {department && (
          <article className="workspace-panel department-workspace-panel">
            <span className="workspace-overline">YOUR WORKFLOW</span>
            <h2>{department.title}</h2>
            <p className="department-workspace-description">{department.description}</p>
            <nav className="department-action-list" aria-label={`${department.title} shortcuts`}>
              {department.actions.map((action) => (
                <Link key={action.label} to={action.to}>
                  <span>{action.label}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </nav>
          </article>
        )}

        {canViewPatients && (
          <article className="workspace-panel checked-in-patients-panel">
            <div className="workspace-panel-heading">
              <div>
                <span className="workspace-overline">ACTIVE HOSPITAL FLOW</span>
                <h2>Checked-in patient flow</h2>
              </div>
              <Link className="dashboard-text-link" to={`${basePath}/patients`}>View all →</Link>
            </div>
            {patientError ? (
              <p className="workspace-empty">Patient list unavailable: {patientError}</p>
            ) : activePatients.length ? (
              <ul className="checked-in-patient-list">
                {activePatients.slice(0, 4).map((patient) => (
                  <li key={patient.id}>
                    <span className="checked-in-patient-avatar">{patient.full_name.trim().charAt(0).toUpperCase()}</span>
                    <span className="checked-in-patient-summary">
                      <strong>{patient.full_name}</strong>
                      <small>{patient.sex === 'male' ? 'Male' : 'Female'} · Checked in {formatDateTime(patient.checked_in_at)}</small>
                      <small className={patient.checked_in_insured ? 'is-insured' : 'is-non-insured'}>
                        {patient.checked_in_insured
                          ? `Insured · ${patient.checked_in_insurance_provider || 'Provider recorded'}`
                          : 'Non-insured visit'}
                      </small>
                    </span>
                    <Link to={`${basePath}/patients/${patient.id}`} aria-label={`View ${patient.full_name}`}>→</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="workspace-empty">
                {hospitalLoading ? 'Loading patients…' : 'No patients have been checked in yet.'}
              </p>
            )}
          </article>
        )}

        <article className="workspace-panel account-panel">
          <span className="workspace-overline">YOUR ACCOUNT</span>
          <h2>Account overview</h2>
          <div className="account-detail-list">
            <div>
              <span className="account-detail-icon">◎</span>
              <span>
                <small>Role</small>
                <strong>{profile?.role}</strong>
              </span>
            </div>
            <div>
              <span className="account-detail-icon">◷</span>
              <span>
                <small>Last signed in</small>
                <strong>{lastLogin}</strong>
              </span>
            </div>
          </div>
          <Link
            className="dashboard-text-link"
            to={`/dashboard/${profile?.role}/profile`}
          >
            View account profile <span aria-hidden="true">→</span>
          </Link>
        </article>
      </section>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return 'time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default DashboardHome;
