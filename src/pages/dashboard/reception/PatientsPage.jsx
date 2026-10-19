import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { usePatientRealtime } from '../../../hooks/usePatientRealtime.js';
import { useLocalDate } from '../../../hooks/useLocalDate.js';
import {
  calculateAge,
  patientRequest,
} from '../../../lib/patientApi.js';
import PatientFormModal from './PatientFormModal.jsx';
import PatientCard, { InsuranceBadge } from '../patients/PatientCard.jsx';

function PatientsPage() {
  const { role } = useParams();
  const { profile } = useAuth();
  const location = useLocation();
  const today = useLocalDate();
  const basePath = `/dashboard/${profile?.role || role}`;
  const canManage = profile?.role === 'reception';
  const [patients, setPatients] = useState([]);
  const [insurers, setInsurers] = useState(['NHIS']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('cards');
  const [modalOpen, setModalOpen] = useState(false);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const result = await patientRequest('list');
      setPatients(result.patients || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load patients.');
    } finally {
      setLoading(false);
    }

  }, []);

  const loadInsurers = useCallback(async () => {
    try {
      const result = await patientRequest('insurers');
      setInsurers(result.providers || ['NHIS']);
    } catch (loadError) {
      setError(loadError.message || 'Could not load insurance providers.');
    }
  }, []);

  const realtime = usePatientRealtime(profile?.hospital_id, () => {
    void loadPatients();
    void loadInsurers();
  });

  useEffect(() => {
    if (
      profile?.role === 'reception' ||
      profile?.role === 'hospitaladmin' ||
      profile?.role === 'nurse'
    ) {
      void loadPatients();
      if (canManage) void loadInsurers();
    }
  }, [canManage, loadInsurers, loadPatients, profile?.role]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) =>
      [
        patient.full_name,
        patient.residence,
        patient.address,
        patient.insurance_provider,
        patient.insurance_number,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [patients, search]);
  const checkedInCount = patients.filter((patient) => patient.checked_in_at).length;
  const insuredCount = patients.filter((patient) => patient.checked_in_insured).length;

  const hospitalRoles = new Set([
    'hospitaladmin',
    'consulting',
    'nurse',
    'labs',
    'pharmacy',
    'reception',
  ]);
  if (!hospitalRoles.has(profile?.role)) {
    return <Navigate to={basePath} replace />;
  }

  function openRegistration() {
    setModalOpen(true);
  }

  function handleSaved(patient) {
    setPatients((current) => {
      const existing = current.some((item) => item.id === patient.id);
      return existing
        ? current.map((item) => item.id === patient.id ? patient : item)
        : [patient, ...current];
    });
    void loadInsurers();
  }

  return (
    <section className="patients-page">
      <header className="patients-page-heading">
        <div>
          <span className="workspace-overline">{canManage ? 'RECEPTION' : 'HOSPITAL OVERVIEW'}</span>
          <h1>Patients</h1>
        </div>
        {canManage && (
          <button className="staff-primary-button" type="button" onClick={openRegistration}>
            <span aria-hidden="true">+</span> Register patient
          </button>
        )}
      </header>

      <div className="patients-stats" aria-label="Patient summary">
        <article className="patient-stat-card">
          <span className="patient-stat-icon">◎</span>
          <span><small>REGISTERED PATIENTS</small><strong>{loading ? '—' : patients.length}</strong></span>
        </article>
        <article className="patient-stat-card">
          <span className="patient-stat-icon patient-stat-icon-green">↗</span>
          <span><small>CHECKED IN</small><strong>{loading ? '—' : checkedInCount}</strong></span>
        </article>
        <article className="patient-stat-card">
          <span className="patient-stat-icon patient-stat-icon-violet">▤</span>
          <span><small>INSURED AT CHECK-IN</small><strong>{loading ? '—' : insuredCount}</strong></span>
        </article>
      </div>

      {realtime.error && (
        <p className="auth-notice auth-notice-error" role="status">
          Live patient updates are unavailable: {realtime.error}
        </p>
      )}
      {location.state?.notice && (
        <p className="settings-success" role="status">{location.state.notice}</p>
      )}
      {error && (
        <p className="auth-notice auth-notice-error" role="alert">
          {error}
          <button className="staff-inline-button" type="button" onClick={() => void loadPatients()}>
            Try again
          </button>
        </p>
      )}

      <section className="patients-directory">
        <div className="patients-toolbar">
          <div>
            <h2>Patient directory</h2>
            <span>{loading ? 'Loading patients…' : `${filteredPatients.length} patient${filteredPatients.length === 1 ? '' : 's'}`}</span>
          </div>
          <div className="staff-directory-actions">
            <label className="staff-search">
              <span className="sr-only">Search patients</span>
              <span aria-hidden="true">⌕</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patients" />
            </label>
            <div className="staff-view-toggle" role="group" aria-label="Patient directory view">
              <button className={view === 'cards' ? 'is-active' : ''} type="button" aria-label="Card view" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>▦</button>
              <button className={view === 'list' ? 'is-active' : ''} type="button" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}>☷</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading patients…</div>
        ) : filteredPatients.length ? (
          view === 'cards' ? (
            <div className="patient-card-grid">
              {filteredPatients.map((patient) => (
                <PatientCard key={patient.id} patient={patient} basePath={basePath} today={today} />
              ))}
            </div>
          ) : (
            <div className="staff-table-wrap">
              <table className="staff-table patient-table">
                <thead><tr>
                  <th scope="col">Patient</th><th scope="col">Age</th><th scope="col">Sex</th>
                  <th scope="col">Insurance</th><th scope="col">Check-in</th><th scope="col"><span className="sr-only">Details</span></th>
                </tr></thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td><Link className="patient-table-name" to={`${basePath}/patients/${patient.id}`}>{patient.full_name}</Link></td>
                      <td>{calculateAge(patient.date_of_birth, today) ?? patient.age_at_registration ?? '—'}</td>
                      <td>{patient.sex === 'male' ? 'Male' : patient.sex === 'female' ? 'Female' : 'Not recorded'}</td>
                      <td><InsuranceBadge patient={patient} today={today} /></td>
                      <td>{patient.checked_in_at ? 'Checked in' : 'Not checked in'}</td>
                      <td><Link className="staff-row-link" to={`${basePath}/patients/${patient.id}`}>Details →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="staff-empty-state">
            <span className="staff-empty-icon">◎</span>
            <h3>{search ? 'No matching patients' : 'No patients registered yet'}</h3>
            <p>{search ? 'Try another name, residence or insurance number.' : 'Register a patient to start building your hospital directory.'}</p>
            {!search && canManage && <button className="staff-primary-button" type="button" onClick={openRegistration}><span aria-hidden="true">+</span> Register first patient</button>}
          </div>
        )}
      </section>

      {canManage && (
        <PatientFormModal
          open={modalOpen}
          insurers={insurers}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}

export default PatientsPage;
