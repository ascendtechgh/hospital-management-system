import { useEffect, useRef, useState } from 'react';
import { clinicalRequest, groupByCategory } from '../../../lib/clinicalApi.js';

const emptyNotes = {
  chief_complaint: '',
  history: '',
  examination: '',
  assessment: '',
  plan: '',
};

function ConsultationModal({
  patient,
  catalogs,
  consultation = null,
  existingLabOrders = [],
  existingPrescriptions = [],
  onClose,
  onSaved,
}) {
  const dialogRef = useRef(null);
  const [consultationId, setConsultationId] = useState(null);
  const [notes, setNotes] = useState(emptyNotes);
  const [diagnoses, setDiagnoses] = useState([]);
  const [diagnosisId, setDiagnosisId] = useState('');
  const [labOrders, setLabOrders] = useState([]);
  const [labCode, setLabCode] = useState('');
  const [labPriority, setLabPriority] = useState('routine');
  const [labNotes, setLabNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescription, setPrescription] = useState(emptyPrescription());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('notes');
  const tabs = [
    { id: 'notes', label: 'Notes' },
    { id: 'diagnoses', label: 'Diagnoses', count: diagnoses.length },
    { id: 'labs', label: 'Labs', count: existingLabOrders.length + labOrders.length },
    { id: 'drugs', label: 'Drugs', count: existingPrescriptions.length + prescriptions.length },
  ];

  useEffect(() => {
    if (patient && !dialogRef.current?.open) {
      setConsultationId(consultation?.id || null);
      setNotes(consultation ? {
        chief_complaint: consultation.chief_complaint || '',
        history: consultation.history || '',
        examination: consultation.examination || '',
        assessment: consultation.assessment || '',
        plan: consultation.plan || '',
      } : emptyNotes);
      setDiagnoses((consultation?.diagnoses || []).map((item) => ({
        diagnosis_id: item.diagnosis_id,
        is_primary: item.is_primary,
        notes: item.notes || '',
        label: item.diagnosis?.name || 'Diagnosis',
        icd10_code: item.diagnosis?.icd10_code || '',
        clinical_status: item.clinical_status || 'Confirmed',
      })));
      setDiagnosisId('');
      setLabOrders([]);
      setLabCode('');
      setLabPriority('routine');
      setLabNotes('');
      setPrescriptions([]);
      setPrescription(emptyPrescription());
      setError('');
      setNotice('');
      setActiveTab('notes');
      dialogRef.current?.showModal();
    } else if (!patient && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [consultation, patient]);

  function close() {
    if (!saving) onClose();
  }

  function addDiagnosis() {
    const id = Number(diagnosisId);
    if (!id || diagnoses.some((item) => item.diagnosis_id === id)) return;
    setDiagnoses((current) => [...current, {
      diagnosis_id: id,
      is_primary: current.length === 0 && !consultation?.diagnoses?.some((item) => item.is_primary),
      notes: '',
      label: catalogs.diagnoses.find((item) => item.id === id)?.name || 'Diagnosis',
      icd10_code: catalogs.diagnoses.find((item) => item.id === id)?.icd10_code || '',
      clinical_status: 'Confirmed',
    }]);
    setDiagnosisId('');
  }

  function addLabOrder() {
    if (!labCode || labOrders.some((item) => item.lab_code === labCode)) return;
    const lab = catalogs.labs.find((item) => item.code === labCode);
    setLabOrders((current) => [...current, {
      lab_code: labCode,
      priority: labPriority,
      request_notes: labNotes.trim(),
      label: lab?.name || labCode,
    }]);
    setLabCode('');
    setLabNotes('');
    setLabPriority('routine');
  }

  function addPrescription() {
    if (!prescription.drug_code || !prescription.dose.trim() ||
      !prescription.frequency.trim() || !prescription.duration.trim() ||
      !Number.isInteger(Number(prescription.quantity)) || Number(prescription.quantity) < 1) {
      setError('Complete the medication, prescribed dose, frequency, duration, and quantity before adding it.');
      return;
    }
    const drug = catalogs.drugs.find((item) => item.code === prescription.drug_code);
    setPrescriptions((current) => [...current, {
      ...prescription,
      quantity: Number(prescription.quantity),
      label: drug?.name || prescription.drug_code,
    }]);
    setPrescription(emptyPrescription());
    setError('');
  }

  async function saveProgress() {
    setError('');
    try {
      const result = await clinicalRequest('consultation_save', {
        patient_id: patient.id,
        consultation_id: consultationId || undefined,
        ...notes,
        diagnoses: diagnoses.map(({ diagnosis_id, is_primary, clinical_status, notes: diagnosisNotes }) => ({
          diagnosis_id,
          is_primary,
          clinical_status,
          notes: diagnosisNotes,
        })),
      });
      setConsultationId(result.consultation_id);
      setNotice('Consultation progress saved. You can add tests or prescriptions now, or return later.');
      onSaved(result.consultation_id);
      return result.consultation_id;
    } catch (saveError) {
      setError(saveError.message || 'Could not save consultation.');
      return null;
    }
  }

  async function submitProgress(event) {
    event.preventDefault();
    setSaving(true);
    await saveProgress();
    setSaving(false);
  }

  async function saveLabRequests() {
    if (!labOrders.length) return;
    setSaving(true);
    setError('');
    try {
      const id = await saveProgress();
      if (!id) return;
      const result = await clinicalRequest('lab_orders_add', {
        patient_id: patient.id,
        consultation_id: id,
        lab_orders: labOrders.map(({ lab_code, priority, request_notes }) => ({
          lab_code,
          priority,
          request_notes,
        })),
      });
      setLabOrders([]);
      setNotice(`${result.count} lab request${result.count === 1 ? '' : 's'} sent to the laboratory queue.`);
      onSaved(id);
    } catch (saveError) {
      setError(saveError.message || 'Could not send laboratory requests.');
    } finally {
      setSaving(false);
    }
  }

  async function savePrescriptions() {
    if (!prescriptions.length) return;
    setSaving(true);
    setError('');
    try {
      const id = await saveProgress();
      if (!id) return;
      const result = await clinicalRequest('prescriptions_add', {
        patient_id: patient.id,
        consultation_id: id,
        prescriptions: prescriptions.map(({
          drug_code, dose, route, frequency, duration, quantity, instructions,
        }) => ({ drug_code, dose, route, frequency, duration, quantity, instructions })),
      });
      setPrescriptions([]);
      setNotice(`${result.count} prescription${result.count === 1 ? '' : 's'} sent to pharmacy.`);
      onSaved(id);
    } catch (saveError) {
      setError(saveError.message || 'Could not send prescriptions.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="patient-form-dialog clinical-dialog clinical-encounter-dialog"
      aria-labelledby="consultation-modal-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="patient-modal-card">
        <header className="patient-modal-header">
          <div className="clinical-encounter-heading">
            <span className="patient-modal-icon" aria-hidden="true">✚</span>
            <span><strong>{patient?.full_name}</strong><small>Patient encounter</small></span>
          </div>
          <button className="staff-close-button" type="button" aria-label="Close" onClick={close} disabled={saving}>×</button>
        </header>
        <div className="clinical-encounter-title">
          <span className="workspace-overline">CLINICAL ENCOUNTER</span>
          <h2 className="patient-modal-title" id="consultation-modal-title">{consultationId ? 'Continue consultation' : 'New consultation'}</h2>
        </div>
        {error && <p className="auth-notice auth-notice-error" role="alert">{error}</p>}
        {notice && <p className="settings-success" role="status" aria-live="polite">{notice}</p>}
        <form className="patient-form" onSubmit={submitProgress}>
          <nav className="clinical-encounter-tabs" role="tablist" aria-label="Encounter sections">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                id={`encounter-${tab.id}-tab`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`encounter-${tab.id}-panel`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => {
                  let nextIndex = null;
                  if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
                  if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
                  if (event.key === 'Home') nextIndex = 0;
                  if (event.key === 'End') nextIndex = tabs.length - 1;
                  if (nextIndex !== null) {
                    event.preventDefault();
                    const nextTab = tabs[nextIndex];
                    setActiveTab(nextTab.id);
                    document.getElementById(`encounter-${nextTab.id}-tab`)?.focus();
                  }
                }}
              >
                {tab.label}
                {tab.count > 0 && <span>{tab.count}</span>}
              </button>
            ))}
          </nav>

          {activeTab === 'notes' && <section className="patient-form-section clinical-encounter-tab-panel" id="encounter-notes-panel" role="tabpanel" aria-labelledby="encounter-notes-tab">
            <h3>Consultation notes</h3>
            <div className="clinical-form-grid">
              <TextArea label="Chief complaint" value={notes.chief_complaint} onChange={(value) => setNotes((current) => ({ ...current, chief_complaint: value }))} />
              <TextArea label="History" value={notes.history} onChange={(value) => setNotes((current) => ({ ...current, history: value }))} />
              <TextArea label="Examination" value={notes.examination} onChange={(value) => setNotes((current) => ({ ...current, examination: value }))} />
              <TextArea label="Assessment" value={notes.assessment} onChange={(value) => setNotes((current) => ({ ...current, assessment: value }))} />
              <TextArea label="Plan" value={notes.plan} onChange={(value) => setNotes((current) => ({ ...current, plan: value }))} />
            </div>
          </section>}

          {activeTab === 'diagnoses' && <section className="patient-form-section clinical-encounter-tab-panel" id="encounter-diagnoses-panel" role="tabpanel" aria-labelledby="encounter-diagnoses-tab">
            <h3>Diagnoses <span>Multiple allowed</span></h3>
            <div className="clinical-add-row">
              <label className="auth-field">
                <span>Diagnosis catalog</span>
                <select value={diagnosisId} onChange={(event) => setDiagnosisId(event.target.value)}>
                  <option value="">Choose a diagnosis</option>
                  {Object.entries(groupByCategory(catalogs.diagnoses)).map(([category, items]) => (
                    <optgroup key={category} label={category}>
                      {items.map((item) => <option key={item.id} value={item.id}>{item.icd10_code ? `${item.icd10_code} · ` : ''}{item.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <button className="staff-secondary-button" type="button" onClick={addDiagnosis} disabled={!diagnosisId}>Add</button>
            </div>
            {diagnoses.length > 0 && <div className="clinical-diagnosis-list">{diagnoses.map((item, index) => <article className="clinical-diagnosis-row" key={item.diagnosis_id}><div className="clinical-diagnosis-name"><strong>{item.label}</strong><small>{item.icd10_code || 'ICD-10 code not assigned'}</small></div><label><span>Designation</span><select value={item.is_primary ? 'primary' : 'secondary'} onChange={(event) => setDiagnoses((current) => current.map((diagnosis, rowIndex) => ({ ...diagnosis, is_primary: event.target.value === 'primary' && rowIndex === index })))}><option value="primary">Primary</option><option value="secondary">Secondary</option></select></label><label><span>Clinical status</span><select value={item.clinical_status || 'Confirmed'} onChange={(event) => setDiagnoses((current) => current.map((diagnosis, rowIndex) => rowIndex === index ? { ...diagnosis, clinical_status: event.target.value } : diagnosis))}><option>Suspected</option><option>Confirmed</option><option>Differential</option></select></label><button className="staff-secondary-button" type="button" onClick={() => setDiagnoses((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></article>)}</div>}
          </section>}

          {activeTab === 'labs' && <section className="patient-form-section clinical-encounter-tab-panel" id="encounter-labs-panel" role="tabpanel" aria-labelledby="encounter-labs-tab">
            <h3>Laboratory requests</h3>
            {existingLabOrders.length > 0 && (
              <div className="clinical-encounter-saved-lines">
                <h4>Already sent to laboratory</h4>
                <SelectedItems items={existingLabOrders.map((item) => ({
                  lab_code: item.lab_code,
                  label: item.lab?.name || item.lab_code,
                  priority: item.priority,
                }))} />
              </div>
            )}
            <div className="clinical-add-row">
              <label className="auth-field">
                <span>Test</span>
                <select value={labCode} onChange={(event) => setLabCode(event.target.value)}>
                  <option value="">Choose a laboratory test</option>
                  {Object.entries(groupByCategory(catalogs.labs)).map(([category, items]) => (
                    <optgroup key={category} label={category}>
                      {items.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="auth-field">
                <span>Priority</span>
                <select value={labPriority} onChange={(event) => setLabPriority(event.target.value)}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
            <div className="clinical-add-row">
              <label className="auth-field clinical-grow">
                <span>Request notes</span>
                <input value={labNotes} maxLength={1000} onChange={(event) => setLabNotes(event.target.value)} />
              </label>
                <button className="staff-secondary-button" type="button" onClick={addLabOrder} disabled={!labCode}>Add test</button>
            </div>
            <SelectedItems items={labOrders} onRemove={(index) => setLabOrders((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
            <p className="clinical-helper">Lab stock is displayed to staff but is not deducted when a request is placed.</p>
              <button className="staff-primary-button clinical-section-save" type="button" onClick={() => void saveLabRequests()} disabled={saving || !labOrders.length}>
                {saving ? 'Saving…' : 'Send lab requests'}
              </button>
          </section>}

          {activeTab === 'drugs' && <section className="patient-form-section clinical-encounter-tab-panel" id="encounter-drugs-panel" role="tabpanel" aria-labelledby="encounter-drugs-tab">
            <h3>Prescriptions</h3>
            {existingPrescriptions.length > 0 && (
              <div className="clinical-encounter-saved-lines">
                <h4>Already sent to pharmacy</h4>
                <SelectedItems items={existingPrescriptions.map((item) => ({
                  drug_code: item.drug_code,
                  label: item.drug?.name || item.drug_code,
                  quantity: item.quantity,
                }))} />
              </div>
            )}
            <label className="auth-field">
              <span>Medicine</span>
              <select value={prescription.drug_code} onChange={(event) => setPrescription((current) => ({ ...current, drug_code: event.target.value }))}>
                <option value="">Choose a pharmacy item</option>
                {Object.entries(groupByCategory(catalogs.drugs)).map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="clinical-form-grid clinical-form-grid-3">
              <TextInput label="Dose" value={prescription.dose} onChange={(value) => setPrescription((current) => ({ ...current, dose: value }))} required />
              <TextInput label="Route" value={prescription.route} onChange={(value) => setPrescription((current) => ({ ...current, route: value }))} />
              <TextInput label="Frequency" value={prescription.frequency} onChange={(value) => setPrescription((current) => ({ ...current, frequency: value }))} required />
              <TextInput label="Duration" value={prescription.duration} onChange={(value) => setPrescription((current) => ({ ...current, duration: value }))} required />
              <TextInput label="Quantity" type="number" min="1" value={prescription.quantity} onChange={(value) => setPrescription((current) => ({ ...current, quantity: value }))} required />
              <TextInput label="Instructions" value={prescription.instructions} onChange={(value) => setPrescription((current) => ({ ...current, instructions: value }))} />
            </div>
            <button className="staff-secondary-button" type="button" onClick={addPrescription} disabled={!prescription.drug_code}>Add prescription</button>
            <SelectedItems items={prescriptions} onRemove={(index) => setPrescriptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
            <button className="staff-primary-button clinical-section-save" type="button" onClick={() => void savePrescriptions()} disabled={saving || !prescriptions.length}>
              {saving ? 'Saving…' : 'Send prescriptions to pharmacy'}
            </button>
          </section>}
          <footer className="patient-form-actions">
            <button className="auth-button auth-button-back" type="button" onClick={close} disabled={saving}>Done for now</button>
            <button className="auth-button auth-button-primary patient-submit-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save progress'}</button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

function emptyPrescription() {
  return { drug_code: '', dose: '', route: '', frequency: '', duration: '', quantity: '', instructions: '' };
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <textarea value={value} maxLength={5000} rows="2" onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextInput({ label, value, onChange, ...attributes }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input value={value} maxLength={1000} onChange={(event) => onChange(event.target.value)} {...attributes} />
    </label>
  );
}

function SelectedItems({ items, onRemove }) {
  if (!items.length) return null;
  return (
    <ul className="clinical-selected-items">
      {items.map((item, index) => (
        <li key={`${item.code || item.diagnosis_id || item.drug_code}-${index}`}>
          <span>{item.label}</span>
          {item.priority && <small>{item.priority}</small>}
          {item.quantity && <small>Qty {item.quantity}</small>}
          <button type="button" aria-label={`Remove ${item.label}`} onClick={() => onRemove(index)}>×</button>
        </li>
      ))}
    </ul>
  );
}

export default ConsultationModal;
