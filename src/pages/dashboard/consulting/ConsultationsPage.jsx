import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useLocalDate } from '../../../hooks/useLocalDate.js';
import { usePatientRealtime } from '../../../hooks/usePatientRealtime.js';
import { patientRequest, calculateAge } from '../../../lib/patientApi.js';
import { clinicalRequest } from '../../../lib/clinicalApi.js';
import ConsultationModal from './ConsultationModal.jsx';

function ConsultationsPage() {
  const { role } = useParams();
  const { profile } = useAuth();
  const today = useLocalDate();
  const basePath = `/dashboard/${profile?.role || role}`;
  const [patients, setPatients] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [patientError, setPatientError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const result = await patientRequest('list');
      setPatients(result.patients || []);
      setPatientError('');
    } catch (error) {
      setPatientError(error.message || 'Could not load checked-in patients.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalogs = useCallback(async () => {
    try {
      setCatalogs(await clinicalRequest('catalogs'));
      setCatalogError('');
    } catch (error) {
      setCatalogError(error.message || 'Could not load clinical catalogs.');
    }
  }, []);

  const realtime = usePatientRealtime(profile?.hospital_id, () => {
    void loadPatients();
  });

  useEffect(() => {
    if (profile?.role === 'consulting') {
      void loadPatients();
      void loadCatalogs();
    }
  }, [loadCatalogs, loadPatients, profile?.role]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query
      ? patients.filter((patient) =>
        `${patient.full_name} ${patient.residence || ''} ${patient.address || ''}`
          .toLocaleLowerCase().includes(query))
      : patients;
  }, [patients, search]);

  if (profile?.role !== 'consulting') return <Navigate to={basePath} replace />;

  return (
    <section className="clinical-page consultations-page">
      {realtime.error && <p className="auth-notice auth-notice-error" role="status">Live patient updates are unavailable: {realtime.error}</p>}
      {catalogError && <p className="auth-notice auth-notice-error" role="alert">{catalogError} Catalogs must be deployed before consultations can be saved.</p>}
      {patientError && (
        <p className="auth-notice auth-notice-error" role="alert">
          {patientError}<button className="staff-inline-button" type="button" onClick={() => void loadPatients()}>Try again</button>
        </p>
      )}

      <section className="consultations-directory" aria-label="Checked-in patients">
        <div className="consultations-directory-toolbar">
          <div>
            <span className="workspace-overline">PATIENT QUEUE</span>
            <h2>Ready for consultation</h2>
          </div>
          <label className="staff-search clinical-search">
            <span className="sr-only">Search checked-in patients</span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.3 4.3" />
            </svg>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or residence" />
          </label>
        </div>

        {loading ? (
          <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading checked-in patients…</div>
        ) : filteredPatients.length ? (
          <div className="clinical-patient-list">
            {filteredPatients.map((patient) => {
              const age = calculateAge(patient.date_of_birth, today) ?? patient.age_at_registration;
              const sex = patient.sex === 'male' ? 'Male' : patient.sex === 'female' ? 'Female' : 'Not recorded';
              const residence = patient.residence || patient.address;
              return (
                <article className="clinical-patient-row" key={patient.id}>
                  <div className="clinical-patient-card-heading">
                    <span className="consultations-ready-indicator"><i aria-hidden="true" /> Ready</span>
                  </div>
                  <div className="clinical-patient-identity">
                    <span className="patient-avatar" aria-hidden="true">
                      {patient.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}
                    </span>
                    <div>
                      <strong>{patient.full_name}</strong>
                      <span>{age ?? 'Age not provided'}{age !== null && age !== undefined ? ' years' : ''} <i aria-hidden="true">·</i> {sex}</span>
                      {residence && <small>{residence}</small>}
                    </div>
                  </div>
                  <div className="clinical-patient-actions">
                    <Link className="staff-secondary-button" to={`${basePath}/patients/${patient.id}?tab=consultations`}>Record history <span aria-hidden="true">↗</span></Link>
                    <button className="staff-primary-button" type="button" onClick={() => setSelectedPatient(patient)} disabled={!catalogs}>New consultation <span aria-hidden="true">→</span></button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="staff-empty-state consultations-empty-state">
            <span className="staff-empty-icon">✚</span>
            <h3>{search ? 'No matching patients' : 'No checked-in patients'}</h3>
            <p>{search ? 'Try another name or residence.' : 'Patients checked in by reception will appear here for consultation.'}</p>
          </div>
        )}
      </section>
      {catalogs && (
        <ConsultationModal
          patient={selectedPatient}
          catalogs={catalogs}
          onClose={() => setSelectedPatient(null)}
          onSaved={() => {
            void loadPatients();
          }}
        />
      )}
    </section>
  );
}

export default ConsultationsPage;
