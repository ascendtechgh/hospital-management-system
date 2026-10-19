import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useLocalDate } from '../../../hooks/useLocalDate.js';
import { usePatientRealtime } from '../../../hooks/usePatientRealtime.js';
import { patientRequest } from '../../../lib/patientApi.js';
import { vitalsDateRange } from '../../../lib/vitalsDateRange.js';
import PatientCard from '../patients/PatientCard.jsx';
import VitalsModal from './VitalsModal.jsx';

function VitalsPage() {
  const { role } = useParams();
  const { profile } = useAuth();
  const today = useLocalDate();
  const basePath = `/dashboard/${profile?.role || role}`;
  const [patients, setPatients] = useState([]);
  const [vitals, setVitals] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingVitals, setLoadingVitals] = useState(true);
  const [error, setError] = useState('');
  const [vitalsError, setVitalsError] = useState('');
  const [filter, setFilter] = useState('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const loadPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const result = await patientRequest('list');
      setPatients(result.patients || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load checked-in patients.');
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  const range = useMemo(
    () => vitalsDateRange(filter, selectedDate, today),
    [filter, selectedDate, today],
  );

  const loadVitals = useCallback(async () => {
    setLoadingVitals(true);
    try {
      const result = await patientRequest('vitals_list', range);
      setVitals(result.vitals || []);
      setVitalsError('');
    } catch (loadError) {
      setVitalsError(loadError.message || 'Could not load vitals history.');
    } finally {
      setLoadingVitals(false);
    }
  }, [range]);

  const realtime = usePatientRealtime(profile?.hospital_id, () => {
    void loadPatients();
    void loadVitals();
  });

  useEffect(() => {
    if (profile?.role === 'nurse') {
      void loadPatients();
      void loadVitals();
    }
  }, [loadPatients, loadVitals, profile?.role]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) =>
      `${patient.full_name} ${patient.residence || ''} ${patient.address || ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [patients, search]);

  if (profile?.role !== 'nurse') {
    return <Navigate to={basePath} replace />;
  }

  function handleSaved() {
    setSelectedPatient(null);
    void loadVitals();
    void loadPatients();
  }

  return (
    <section className="nurse-vitals-page">
      <header className="patients-page-heading">
        <div>
          <span className="workspace-overline">NURSING WORKSPACE</span>
          <h1>Check vitals</h1>
        </div>
        <Link className="staff-secondary-button" to={`${basePath}/patients`}>Patient directory</Link>
      </header>

      {realtime.error && (
        <p className="auth-notice auth-notice-error" role="status">
          Live patient and vitals updates are unavailable: {realtime.error}
        </p>
      )}
      {error && (
        <p className="auth-notice auth-notice-error" role="alert">
          {error}
          <button className="staff-inline-button" type="button" onClick={() => void loadPatients()}>Try again</button>
        </p>
      )}

      <section className="nurse-vitals-queue">
        <div className="nurse-vitals-section-heading">
          <div>
            <span className="workspace-overline">READY FOR OBSERVATION</span>
            <h2>Checked-in patients</h2>
            <p>Select a patient to record their current vitals.</p>
          </div>
          <span className="nurse-patient-count">{loadingPatients ? '—' : `${patients.length} patients`}</span>
        </div>
        {loadingPatients ? (
          <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading checked-in patients…</div>
        ) : filteredPatients.length ? (
          <>
            <label className="staff-search nurse-patient-search">
              <span className="sr-only">Search checked-in patients</span>
              <span aria-hidden="true">⌕</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a checked-in patient" />
            </label>
            <div className="patient-card-grid">
              {filteredPatients.map((patient) => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  basePath={basePath}
                  today={today}
                  action={
                    <button
                      className="patient-card-vitals-action"
                      type="button"
                      onClick={() => setSelectedPatient(patient)}
                    >
                      Check vitals <span aria-hidden="true">→</span>
                    </button>
                  }
                />
              ))}
            </div>
          </>
        ) : (
          <div className="staff-empty-state nurse-empty-state">
            <span className="staff-empty-icon">⌁</span>
            <h3>{search ? 'No matching patients' : 'No checked-in patients'}</h3>
            <p>{search ? 'Try searching by a different name or location.' : 'Patients checked in by reception will appear here for nursing observations.'}</p>
          </div>
        )}
      </section>

      <section className="nurse-vitals-history">
        <div className="nurse-vitals-section-heading nurse-history-heading">
          <div>
            <span className="workspace-overline">OBSERVATION RECORDS</span>
            <h2>Vitals history</h2>
            <p>Review readings by day or browse the full history.</p>
          </div>
          <label className="vitals-date-filter">
            <span className="sr-only">Filter vitals by date</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_month">Last month</option>
              <option value="date">Choose a day</option>
              <option value="all">All history</option>
            </select>
            {filter === 'date' && (
              <input
                aria-label="Choose vitals history date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            )}
          </label>
        </div>

        {vitalsError && <p className="auth-notice auth-notice-error" role="alert">{vitalsError}</p>}
        {loadingVitals ? (
          <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading vitals history…</div>
        ) : vitals.length ? (
          <div className="staff-table-wrap">
            <table className="staff-table vitals-history-table">
              <thead>
                <tr><th scope="col">Patient</th><th scope="col">Recorded</th><th scope="col">Blood pressure</th><th scope="col">Pulse</th><th scope="col">Temp.</th><th scope="col">Resp.</th><th scope="col">SpO₂</th><th scope="col"><span className="sr-only">Patient details</span></th></tr>
              </thead>
              <tbody>
                {vitals.map((vital) => (
                  <tr key={vital.id}>
                    <td><Link className="patient-table-name" to={`${basePath}/patients/${vital.patient_id}`}>{vital.patient?.full_name || 'Patient'}</Link></td>
                    <td>{formatDateTime(vital.recorded_at)}</td>
                    <td>{vital.systolic_blood_pressure}/{vital.diastolic_blood_pressure} <small>mmHg</small></td>
                    <td>{vital.pulse_rate} <small>bpm</small></td>
                    <td>{vital.temperature_c}°C</td>
                    <td>{vital.respiratory_rate} <small>/min</small></td>
                    <td>{vital.oxygen_saturation}%</td>
                    <td><Link className="staff-row-link" to={`${basePath}/patients/${vital.patient_id}?tab=vitals`}>History →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="staff-empty-state nurse-empty-state">
            <h3>No vitals for this period</h3>
            <p>Recorded observations will appear here as soon as a nurse saves them.</p>
          </div>
        )}
      </section>

      <VitalsModal
        patient={selectedPatient}
        onClose={() => setSelectedPatient(null)}
        onSaved={handleSaved}
      />
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default VitalsPage;
