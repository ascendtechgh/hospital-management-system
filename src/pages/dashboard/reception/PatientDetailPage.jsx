import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useLocalDate } from '../../../hooks/useLocalDate.js';
import { usePatientRealtime } from '../../../hooks/usePatientRealtime.js';
import {
  calculateAge,
  insuranceDaysRemaining,
  insuranceStatus,
  patientRequest,
} from '../../../lib/patientApi.js';
import { vitalsDateRange } from '../../../lib/vitalsDateRange.js';
import { clinicalRequest } from '../../../lib/clinicalApi.js';
import PatientFormModal from './PatientFormModal.jsx';
import VitalsModal from '../nurse/VitalsModal.jsx';
import ConsultationModal from '../consulting/ConsultationModal.jsx';

function PatientDetailPage() {
  const { role, patientId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useLocalDate();
  const basePath = `/dashboard/${profile?.role || role}`;
  const canManage = profile?.role === 'reception';
  const canTakeVitals = profile?.role === 'nurse';
  const canConsult = profile?.role === 'consulting';
  const tabs = ['details', 'vitals', 'consultations', 'labs', 'pharmacy'];
  const selectedTab = tabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'details';
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState([]);
  const [clinicalRecord, setClinicalRecord] = useState(null);
  const [clinicalCatalogs, setClinicalCatalogs] = useState(null);
  const [consultationDialogOpen, setConsultationDialogOpen] = useState(false);
  const [consultationToContinue, setConsultationToContinue] = useState(null);
  const [clinicalLoading, setClinicalLoading] = useState(true);
  const [clinicalError, setClinicalError] = useState('');
  const [vitalsLoading, setVitalsLoading] = useState(true);
  const [vitalsError, setVitalsError] = useState('');
  const [vitalsFilter, setVitalsFilter] = useState('all');
  const [vitalsDate, setVitalsDate] = useState('');
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [insurers, setInsurers] = useState(['NHIS']);

  const loadPatient = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const result = await patientRequest('read', { patient_id: patientId });
      setPatient(result.patient);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load patient record.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const loadInsurers = useCallback(async () => {
    if (!canManage) return;
    try {
      const result = await patientRequest('insurers');
      setInsurers(result.providers || ['NHIS']);
    } catch (loadError) {
      setActionError(loadError.message || 'Could not load insurance providers.');
    }
  }, [canManage]);

  const loadVitals = useCallback(async () => {
    if (!patientId) return;
    setVitalsLoading(true);
    try {
      const result = await patientRequest('vitals_list', { patient_id: patientId });
      setVitals(result.vitals || []);
      setVitalsError('');
    } catch (loadError) {
      setVitalsError(loadError.message || 'Could not load vitals history.');
    } finally {
      setVitalsLoading(false);
    }
  }, [patientId]);

  const loadClinicalRecord = useCallback(async () => {
    if (!patientId) return;
    setClinicalLoading(true);
    try {
      const record = await clinicalRequest('patient_record', { patient_id: patientId });
      setClinicalRecord(record);
      setClinicalError('');
    } catch (loadError) {
      setClinicalError(loadError.message || 'Could not load clinical history.');
    } finally {
      setClinicalLoading(false);
    }
  }, [patientId]);

  const realtime = usePatientRealtime(profile?.hospital_id, () => {
    void loadPatient();
    void loadVitals();
    void loadClinicalRecord();
  });

  useEffect(() => {
    void loadPatient();
    void loadInsurers();
    void loadVitals();
    void loadClinicalRecord();
  }, [loadClinicalRecord, loadInsurers, loadPatient, loadVitals]);

  const historyRange = useMemo(
    () => vitalsDateRange(vitalsFilter, vitalsDate, today),
    [today, vitalsDate, vitalsFilter],
  );
  const filteredVitals = useMemo(
    () => vitals.filter((record) => {
      const recordedDate = localDateString(new Date(record.recorded_at));
      return (!historyRange.from || recordedDate >= historyRange.from) &&
        (!historyRange.to || recordedDate <= historyRange.to);
    }),
    [historyRange, vitals],
  );

  if (profile?.role === 'superadmin' || !profile?.hospital_id) {
    return <Navigate to={basePath} replace />;
  }

  async function checkIn() {
    setCheckingIn(true);
    setActionError('');
    setNotice('');
    try {
      const result = await patientRequest('check_in', { patient_id: patientId });
      setPatient(result.patient);
      setNotice(
        result.patient.checked_in_insured
          ? 'Patient checked in with active insurance coverage.'
          : 'Patient checked in as non-insured. No insurance was active for this visit.',
      );
    } catch (checkInError) {
      setActionError(checkInError.message || 'Could not check in patient.');
    } finally {
      setCheckingIn(false);
    }
  }

  async function deletePatient() {
    if (!window.confirm(`Delete the patient record for ${patient.full_name}? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    setActionError('');
    try {
      await patientRequest('delete', { patient_id: patientId });
      navigate(`${basePath}/patients`, {
        replace: true,
        state: { notice: 'Patient record deleted.' },
      });
    } catch (deleteError) {
      setActionError(deleteError.message || 'Could not delete patient record.');
    } finally {
      setDeleting(false);
    }
  }

  function patientSaved(updatedPatient) {
    setPatient(updatedPatient);
    setNotice('Patient details saved.');
    void loadInsurers();
  }

  function vitalsSaved(vital) {
    setVitals((current) =>
      [vital, ...current].sort(
        (left, right) => new Date(right.recorded_at) - new Date(left.recorded_at),
      ),
    );
    setNotice('Vitals saved to the patient record.');
  }

  async function openConsultation(consultation = null) {
    setActionError('');
    try {
      const catalogs = clinicalCatalogs || await clinicalRequest('catalogs');
      setClinicalCatalogs(catalogs);
      setConsultationToContinue(consultation);
      setConsultationDialogOpen(true);
    } catch (catalogError) {
      setActionError(catalogError.message || 'Could not load consultation catalogs.');
    }
  }

  return (
    <section className="patient-detail-page">
      <Link className="staff-back-link" to={`${basePath}/patients`}>
        <span aria-hidden="true">←</span> Patient directory
      </Link>
      {realtime.error && <p className="auth-notice auth-notice-error" role="status">Live patient updates are unavailable: {realtime.error}</p>}
      {loading ? (
        <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading patient record…</div>
      ) : error ? (
        <div className="staff-detail-error"><p className="auth-notice auth-notice-error" role="alert">{error}</p><button className="auth-button auth-button-back" type="button" onClick={() => void loadPatient()}>Try again</button></div>
      ) : patient ? (
        <>
          <header className="patient-detail-header">
            <div className="patient-detail-identity">
              <span className="patient-detail-avatar">{patient.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</span>
              <div>
                <span className="workspace-overline">PATIENT RECORD</span>
                <h1>{patient.full_name}</h1>
                <span className="patient-detail-subtitle">
                  {calculateAge(patient.date_of_birth, today) ?? patient.age_at_registration ?? 'Age not provided'}
                  {calculateAge(patient.date_of_birth, today) != null || patient.age_at_registration != null
                    ? ' years'
                    : ''}
                  {' · '}{patient.sex === 'male' ? 'Male' : patient.sex === 'female' ? 'Female' : 'Not recorded'}
                </span>
              </div>
            </div>
            {(canManage || canTakeVitals) && (
              <div className="patient-detail-actions-top">
                {canManage && <button className="staff-secondary-button" type="button" onClick={() => setEditOpen(true)}>Edit patient</button>}
                {canTakeVitals && <button className="staff-primary-button" type="button" onClick={() => setVitalsModalOpen(true)}>Check vitals</button>}
                {canManage && !patient.checked_in_at && <button className="staff-primary-button" type="button" onClick={() => void checkIn()} disabled={checkingIn}>{checkingIn ? 'Checking in…' : 'Check in'}</button>}
                {canManage && <button className="staff-delete-button" type="button" onClick={() => void deletePatient()} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>}
              </div>
            )}
          </header>

          {actionError && <p className="auth-notice auth-notice-error" role="alert">{actionError}</p>}
          {notice && <p className="settings-success" role="status" aria-live="polite">{notice}</p>}

          <nav className="patient-detail-tabs" role="tablist" aria-label="Patient record sections">
            {tabs.map((tab) => {
              const count = tab === 'vitals'
                ? vitals.length
                : tab === 'consultations'
                  ? clinicalRecord?.consultations.length
                  : tab === 'labs'
                    ? clinicalRecord?.lab_orders.length
                    : tab === 'pharmacy'
                      ? clinicalRecord?.prescriptions.length
                      : null;
              return (
                <button
                  key={tab}
                  id={`patient-${tab}-tab`}
                  role="tab"
                  type="button"
                  aria-selected={selectedTab === tab}
                  aria-controls={`patient-${tab}-panel`}
                  tabIndex={selectedTab === tab ? 0 : -1}
                  onKeyDown={(event) => {
                    const currentIndex = tabs.indexOf(tab);
                    let nextIndex = null;
                    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    if (event.key === 'Home') nextIndex = 0;
                    if (event.key === 'End') nextIndex = tabs.length - 1;
                    if (nextIndex !== null) {
                      event.preventDefault();
                      const nextTab = tabs[nextIndex];
                      setSearchParams(nextTab === 'details' ? {} : { tab: nextTab });
                      document.getElementById(`patient-${nextTab}-tab`)?.focus();
                    }
                  }}
                  onClick={() => setSearchParams(tab === 'details' ? {} : { tab })}
                >
                  {tab === 'labs' ? 'Lab results' : tab === 'pharmacy' ? 'Pharmacy' : tab[0].toUpperCase() + tab.slice(1)}
                  {count !== null && count !== undefined && <span>{count}</span>}
                </button>
              );
            })}
          </nav>

          {selectedTab === 'details' ? (
          <div className="patient-detail-grid" id="patient-details-panel" role="tabpanel" aria-labelledby="patient-details-tab">
            <article className="workspace-panel patient-detail-panel">
              <div className="staff-detail-section-heading">
                <div><span className="workspace-overline">PATIENT INFORMATION</span><h2>Personal details</h2></div>
              </div>
              <dl className="patient-detail-fields">
                <DetailField label="Full name" value={patient.full_name} />
                <DetailField label="Date of birth" value={formatDateOnly(patient.date_of_birth)} />
                <DetailField label="Age" value={calculateAge(patient.date_of_birth, today) ?? patient.age_at_registration ?? 'Not provided'} />
                <DetailField label="Sex" value={patient.sex === 'male' ? 'Male' : patient.sex === 'female' ? 'Female' : 'Not recorded'} />
                <DetailField label="Residence" value={patient.residence} />
                <DetailField label="Address" value={patient.address} />
              </dl>
            </article>

            <article className="workspace-panel patient-detail-panel">
              <div className="staff-detail-section-heading">
                <div><span className="workspace-overline">CONTACTS</span><h2>Family & emergency</h2></div>
              </div>
              <dl className="patient-detail-fields">
                <DetailField label="Parent / guardian" value={patient.parent_name} />
                <DetailField label="Parent / guardian number" value={patient.parent_phone} />
                <DetailField label="Emergency contact" value={patient.emergency_contact_name} />
                <DetailField label="Emergency number" value={patient.emergency_contact_phone} />
              </dl>
            </article>

            <article className="workspace-panel patient-detail-panel patient-detail-insurance-panel">
              <div className="staff-detail-section-heading">
                <div><span className="workspace-overline">INSURANCE</span><h2>Coverage information</h2></div>
                <span className={`patient-insurance-badge is-${insuranceStatus(patient, today)}`}>
                  {insuranceLabel(insuranceStatus(patient, today))}
                </span>
              </div>
              {patient.insurance_enabled ? (
                <dl className="patient-detail-fields">
                  <DetailField label="Insurance type" value={patient.insurance_type === 'nhis' ? 'NHIS' : 'Other'} />
                  <DetailField label="Provider" value={patient.insurance_provider} />
                  <DetailField label="Insurance number" value={patient.insurance_number} />
                  <DetailField label="Expiry date" value={formatDateOnly(patient.insurance_expiry)} />
                  <DetailField label="Expiry countdown" value={formatCountdown(insuranceDaysRemaining(patient.insurance_expiry, today))} />
                </dl>
              ) : <p className="patient-no-insurance">No insurance was recorded for this patient.</p>}
              {patient.checked_in_at && (
                <div className="patient-checkin-coverage">
                  <strong>Coverage recorded for this check-in</strong>
                  <span>{patient.checked_in_insured ? `Insured · ${patient.checked_in_insurance_provider} · ${patient.checked_in_insurance_number}` : 'Non-insured visit'}</span>
                </div>
              )}
            </article>

            <article className="workspace-panel patient-detail-panel patient-checkin-panel">
              <div className="staff-detail-section-heading">
                <div><span className="workspace-overline">VISIT STATUS</span><h2>Reception check-in</h2></div>
              </div>
              {patient.checked_in_at ? (
                <div className="patient-checked-in-state">
                  <span className="patient-checkin-indicator" />
                  <div><strong>Checked in</strong><span>{formatDateTime(patient.checked_in_at)}</span></div>
                </div>
              ) : (
                <div className="patient-not-checked-in">
                  <strong>Not checked in</strong>
                  <span>This patient is not yet in the active hospital workflow.</span>
                  {canManage && <button className="staff-primary-button" type="button" onClick={() => void checkIn()} disabled={checkingIn}>{checkingIn ? 'Checking in…' : 'Check in patient'}</button>}
                </div>
              )}
            </article>
          </div>
          ) : selectedTab === 'vitals' ? (
            <section className="patient-vitals-tab" id="patient-vitals-panel" role="tabpanel" aria-labelledby="patient-vitals-tab">
              {vitalsError && <p className="auth-notice auth-notice-error" role="alert">{vitalsError}</p>}
              <section className="patient-current-vitals">
                <div className="nurse-vitals-section-heading">
                  <div>
                    <span className="workspace-overline">LATEST OBSERVATION</span>
                    <h2>Current vitals</h2>
                    <p>{vitals[0] ? `Recorded ${formatDateTime(vitals[0].recorded_at)}` : 'No vitals have been recorded yet.'}</p>
                  </div>
                  {canTakeVitals && <button className="staff-primary-button" type="button" onClick={() => setVitalsModalOpen(true)}>Take vitals</button>}
                </div>
                {vitalsLoading ? (
                  <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading vitals…</div>
                ) : vitals[0] ? (
                  <VitalsSummary vital={vitals[0]} />
                ) : (
                  <div className="patient-no-vitals">
                    <span className="staff-empty-icon">⌁</span>
                    <p>{canTakeVitals ? 'Record the first set of vitals for this patient.' : 'Vitals will appear here when nursing staff records them.'}</p>
                    {canTakeVitals && <button className="staff-primary-button" type="button" onClick={() => setVitalsModalOpen(true)}>Check vitals</button>}
                  </div>
                )}
              </section>

              <section className="patient-vitals-history-panel">
                <div className="nurse-vitals-section-heading nurse-history-heading">
                  <div>
                    <span className="workspace-overline">PATIENT HISTORY</span>
                    <h2>Vitals history</h2>
                  </div>
                  <DateFilter filter={vitalsFilter} setFilter={setVitalsFilter} selectedDate={vitalsDate} setSelectedDate={setVitalsDate} />
                </div>
                {vitalsLoading ? (
                  <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading history…</div>
                ) : filteredVitals.length ? (
                  <>
                    <VitalsTrendChart records={filteredVitals} />
                    <VitalsHistory records={filteredVitals} />
                  </>
                ) : (
                  <div className="staff-empty-state nurse-empty-state"><h3>No vitals for this period</h3><p>Select another date range or record a new observation.</p></div>
                )}
              </section>
            </section>
          ) : (
            <ClinicalHistoryPanel
              tab={selectedTab}
              record={clinicalRecord}
              loading={clinicalLoading}
              error={clinicalError}
              onRetry={() => void loadClinicalRecord()}
              canConsult={canConsult && Boolean(patient.checked_in_at)}
              onNewConsultation={() => void openConsultation()}
              onContinueConsultation={(consultation) => void openConsultation(consultation)}
            />
          )}

          {canManage && <PatientFormModal
            open={editOpen}
            patient={patient}
            insurers={insurers}
            onClose={() => setEditOpen(false)}
            onSaved={patientSaved}
          />}
          {canTakeVitals && (
            <VitalsModal
              patient={vitalsModalOpen ? patient : null}
              onClose={() => setVitalsModalOpen(false)}
              onSaved={vitalsSaved}
            />
          )}
          {canConsult && clinicalCatalogs && (
            <ConsultationModal
              patient={consultationDialogOpen ? patient : null}
              consultation={consultationToContinue}
              catalogs={clinicalCatalogs}
              onClose={() => {
                setConsultationDialogOpen(false);
                setConsultationToContinue(null);
              }}
              onSaved={() => void loadClinicalRecord()}
            />
          )}
        </>
      ) : <p className="auth-notice auth-notice-error">Patient record is unavailable.</p>}
    </section>
  );
}

function ClinicalHistoryPanel({
  tab,
  record,
  loading,
  error,
  onRetry,
  canConsult,
  onNewConsultation,
  onContinueConsultation,
}) {
  const consultations = record?.consultations || [];
  const labOrders = record?.lab_orders || [];
  const prescriptions = record?.prescriptions || [];
  const latestResult = labOrders
    .filter((order) => order.status === 'completed')
    .sort((left, right) => new Date(right.completed_at) - new Date(left.completed_at))[0];
  const latestConsultation = consultations[0];
  const latestPrescription = prescriptions[0];
  const isConsultations = tab === 'consultations';
  const isLabs = tab === 'labs';
  const title = isConsultations ? 'Consultations' : isLabs ? 'Laboratory results' : 'Pharmacy & dispensing';
  const latest = isConsultations ? latestConsultation : isLabs ? latestResult : latestPrescription;

  return (
    <section className="patient-clinical-tab" id={`patient-${tab}-panel`} role="tabpanel" aria-labelledby={`patient-${tab}-tab`}>
      {error && <p className="auth-notice auth-notice-error" role="alert">{error}<button className="staff-inline-button" type="button" onClick={onRetry}>Try again</button></p>}
      <section className="patient-current-vitals patient-clinical-current">
        <div className="nurse-vitals-section-heading">
          <div>
            <span className="workspace-overline">LATEST {isConsultations ? 'ENCOUNTER' : isLabs ? 'COMPLETED RESULT' : 'PRESCRIPTION'}</span>
            <h2>{title}</h2>
            <p>{latest ? `Updated ${formatDateTime(latest.created_at || latest.completed_at || latest.requested_at)}` : `No ${isLabs ? 'lab results' : isConsultations ? 'consultations' : 'prescriptions'} have been recorded.`}</p>
          </div>
          {isConsultations && canConsult && (
            <div className="clinical-header-counts">
              {latestConsultation && (
                <button className="staff-secondary-button" type="button" onClick={() => onContinueConsultation(latestConsultation)}>Continue latest</button>
              )}
              <button className="staff-primary-button" type="button" onClick={onNewConsultation}>New consultation</button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading {title.toLowerCase()}…</div>
        ) : latest ? (
          <ClinicalEntry tab={tab} entry={latest} featured canConsult={canConsult} onContinue={onContinueConsultation} />
        ) : (
          <div className="patient-no-vitals"><span className="staff-empty-icon">{isLabs ? '⌕' : '✚'}</span><p>Records will appear here as teams update the patient’s care.</p></div>
        )}
      </section>

      <section className="patient-vitals-history-panel patient-clinical-history">
        <div className="nurse-vitals-section-heading nurse-history-heading">
          <div><span className="workspace-overline">PATIENT HISTORY</span><h2>All {title.toLowerCase()}</h2></div>
          <span className="nurse-patient-count">
            {isConsultations ? consultations.length : isLabs ? labOrders.length : prescriptions.length} records
          </span>
        </div>
        {loading ? (
          <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading history…</div>
        ) : (isConsultations ? consultations : isLabs ? labOrders : prescriptions).length ? (
          <div className="clinical-history-list">
            {(isConsultations ? consultations : isLabs ? labOrders : prescriptions).map((entry) => (
              <ClinicalEntry
                key={entry.id}
                tab={tab}
                entry={entry}
                canConsult={canConsult}
                onContinue={onContinueConsultation}
              />
            ))}
          </div>
        ) : (
          <div className="staff-empty-state nurse-empty-state"><h3>No history yet</h3><p>Patient care records are added by the relevant hospital teams.</p></div>
        )}
      </section>
    </section>
  );
}

function ClinicalEntry({ tab, entry, featured = false, canConsult = false, onContinue }) {
  if (tab === 'consultations') {
    return (
      <article className={`clinical-history-entry${featured ? ' is-featured' : ''}`}>
        <div className="clinical-entry-heading">
          <strong>{formatDateTime(entry.created_at)}</strong>
          <div className="clinical-header-counts">
            {featured && <span className="clinical-status-badge">Latest</span>}
            {canConsult && <button className="staff-secondary-button" type="button" onClick={() => onContinue(entry)}>Continue</button>}
          </div>
        </div>
        {entry.chief_complaint && <p><b>Chief complaint</b>{entry.chief_complaint}</p>}
        {entry.diagnoses?.length > 0 && (
          <div className="clinical-diagnosis-chips">
            {entry.diagnoses.map((item) => (
              <span key={`${item.consultation_id}-${item.diagnosis_id}`}>
                {item.diagnosis?.name || 'Diagnosis'}{item.is_primary ? ' · Primary' : ''}
              </span>
            ))}
          </div>
        )}
        <div className="clinical-entry-text-grid">
          {entry.history && <p><b>History</b>{entry.history}</p>}
          {entry.examination && <p><b>Examination</b>{entry.examination}</p>}
          {entry.assessment && <p><b>Assessment</b>{entry.assessment}</p>}
          {entry.plan && <p><b>Plan</b>{entry.plan}</p>}
        </div>
      </article>
    );
  }

  if (tab === 'labs') {
    return (
      <article className={`clinical-history-entry${featured ? ' is-featured' : ''}`}>
        <div className="clinical-entry-heading">
          <strong>{entry.lab?.name || 'Laboratory test'} · {entry.lab?.category || ''}</strong>
          <span className={`clinical-status-badge is-${entry.status}`}>{entry.status.replace('_', ' ')}</span>
        </div>
        <p className="clinical-entry-meta">Requested {formatDateTime(entry.requested_at)}{entry.completed_at ? ` · Resulted ${formatDateTime(entry.completed_at)}` : ''}</p>
        {entry.request_notes && <p><b>Request note</b>{entry.request_notes}</p>}
        {entry.result_value && <p className="clinical-result-value"><b>Result</b>{entry.result_value}</p>}
        {entry.result_notes && <p><b>Laboratory notes</b>{entry.result_notes}</p>}
      </article>
    );
  }

  return (
    <article className={`clinical-history-entry${featured ? ' is-featured' : ''}`}>
      <div className="clinical-entry-heading">
        <strong>{entry.drug?.name || 'Medication'} · {entry.drug?.category || ''}</strong>
        <span className={`clinical-status-badge is-${entry.status}`}>{entry.status}</span>
      </div>
      <p>{entry.dose} · {entry.route || 'Route not specified'} · {entry.frequency} · {entry.duration}</p>
      <p className="clinical-entry-meta">Prescribed {formatDateTime(entry.created_at)} · Quantity {entry.quantity} · Dispensed {entry.dispensed_quantity}</p>
      {entry.instructions && <p><b>Instructions</b>{entry.instructions}</p>}
      {entry.dispensations?.length > 0 && (
        <div className="clinical-dispensation-list">
          <b>Dispensing history</b>
          {entry.dispensations.map((dispense) => (
            <span key={dispense.id}>{dispense.quantity} dispensed · {formatDateTime(dispense.dispensed_at)}{dispense.notes ? ` · ${dispense.notes}` : ''}</span>
          ))}
        </div>
      )}
    </article>
  );
}

function DetailField({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || '—'}</dd></div>;
}

function VitalsSummary({ vital }) {
  const readings = [
    ['Blood pressure', `${vital.systolic_blood_pressure}/${vital.diastolic_blood_pressure}`, 'mmHg'],
    ['Pulse', vital.pulse_rate, 'bpm'],
    ['Temperature', vital.temperature_c, '°C'],
    ['Respiratory rate', vital.respiratory_rate, '/min'],
    ['Oxygen saturation', vital.oxygen_saturation, '%'],
    ['Weight', vital.weight_kg, 'kg'],
    ['Height', vital.height_cm, 'cm'],
  ];
  return (
    <div className="patient-current-vitals-grid">
      {readings.map(([label, value, unit]) => (
        <div className="patient-vital-reading" key={label}>
          <span>{label}</span>
          <strong>{value ?? '—'}{value !== null && value !== undefined ? <small> {unit}</small> : ''}</strong>
        </div>
      ))}
      {vital.notes && <p className="patient-vitals-notes"><strong>Notes</strong>{vital.notes}</p>}
    </div>
  );
}

function VitalsTrendChart({ records }) {
  const measurements = [
    { key: 'pulse_rate', label: 'Pulse', unit: 'bpm', color: '#3478d4' },
    { key: 'temperature_c', label: 'Temperature', unit: '°C', color: '#d0783a' },
    { key: 'oxygen_saturation', label: 'Oxygen saturation', unit: '%', color: '#268b77' },
  ];
  const chartRecords = records
    .slice()
    .sort((left, right) => new Date(left.recorded_at) - new Date(right.recorded_at))
    .slice(-8);

  return (
    <div className="vitals-trend-grid" aria-label="Recent vitals trends">
      {measurements.map((measurement) => {
        const points = chartRecords
          .flatMap((record) => {
            const rawValue = record[measurement.key];
            const value = Number(rawValue);
            return rawValue === null || rawValue === undefined || rawValue === '' ||
              !Number.isFinite(value)
              ? []
              : [{ value, recordedAt: record.recorded_at }];
          });
        const min = Math.min(...points.map((point) => point.value));
        const max = Math.max(...points.map((point) => point.value));
        const span = max - min || 1;
        const coordinates = points.map((point, index) => ({
          x: points.length < 2 ? 120 : 8 + (index / (points.length - 1)) * 224,
          y: 61 - ((point.value - min) / span) * 48,
        }));
        const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
        const latest = points[points.length - 1];
        const chartDescription = points
          .map((point) => `${formatDateTime(point.recordedAt)}: ${point.value} ${measurement.unit}`)
          .join('; ');

        return (
          <figure className="vitals-trend-card" key={measurement.key}>
            <figcaption>
              <span>{measurement.label}</span>
              <strong>{latest ? `${latest.value} ${measurement.unit}` : 'No readings'}</strong>
            </figcaption>
            {points.length > 1 ? (
              <svg
                className="vitals-trend-chart"
                viewBox="0 0 240 72"
                role="img"
                aria-label={`${measurement.label} readings over time. ${chartDescription}`}
              >
                <line x1="8" y1="65" x2="232" y2="65" />
                <polyline points={line} style={{ stroke: measurement.color }} />
                {coordinates.map((point, index) => (
                  <circle
                    key={`${points[index].recordedAt}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    style={{ fill: measurement.color }}
                  />
                ))}
              </svg>
            ) : (
              <p className="vitals-trend-empty">
                {points.length ? 'Trend appears after another reading.' : 'No readings recorded.'}
              </p>
            )}
            {points.length > 1 && (
              <div className="vitals-trend-footer">
                <span>{min}–{max} {measurement.unit} observed</span>
                <span>{formatShortDate(points[0].recordedAt)} – {formatShortDate(latest.recordedAt)}</span>
              </div>
            )}
          </figure>
        );
      })}
      <p className="vitals-trend-disclaimer">
        Charts show relative changes across the displayed readings; they are not diagnostic reference ranges.
      </p>
    </div>
  );
}

function DateFilter({ filter, setFilter, selectedDate, setSelectedDate }) {
  return (
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
  );
}

function VitalsHistory({ records }) {
  return (
    <div className="staff-table-wrap">
      <table className="staff-table vitals-history-table">
        <thead>
          <tr>
            <th scope="col">Recorded</th>
            <th scope="col">Blood pressure</th>
            <th scope="col">Pulse</th>
            <th scope="col">Temp.</th>
            <th scope="col">Resp.</th>
            <th scope="col">SpO₂</th>
            <th scope="col">Weight</th>
            <th scope="col">Height</th>
          </tr>
        </thead>
        <tbody>
          {records.map((vital) => (
            <tr key={vital.id}>
              <td>{formatDateTime(vital.recorded_at)}</td>
              <td>{vital.systolic_blood_pressure}/{vital.diastolic_blood_pressure} <small>mmHg</small></td>
              <td>{vital.pulse_rate} <small>bpm</small></td>
              <td>{vital.temperature_c}°C</td>
              <td>{vital.respiratory_rate} <small>/min</small></td>
              <td>{vital.oxygen_saturation}%</td>
              <td>{vital.weight_kg ? `${vital.weight_kg} kg` : '—'}</td>
              <td>{vital.height_cm ? `${vital.height_cm} cm` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function insuranceLabel(status) {
  return status === 'active' ? 'Active' : status === 'nearing' ? 'Nearing expiry' : status === 'expired' ? 'Expired' : 'Uninsured';
}

function formatCountdown(days) {
  if (days === null) return 'No expiry date';
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

function formatDateOnly(value) {
  if (!value) return 'Not provided';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default PatientDetailPage;
