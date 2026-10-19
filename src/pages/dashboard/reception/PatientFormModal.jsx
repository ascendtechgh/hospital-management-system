import { useEffect, useRef, useState } from 'react';
import { calculateAge, patientRequest } from '../../../lib/patientApi.js';
import { useLocalDate } from '../../../hooks/useLocalDate.js';

const emptyPatient = {
  full_name: '',
  date_of_birth: '',
  age_at_registration: '',
  sex: '',
  residence: '',
  address: '',
  parent_name: '',
  parent_phone: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  insurance_enabled: false,
  insurance_type: 'nhis',
  insurance_provider: '',
  insurance_number: '',
  insurance_expiry: '',
};

function PatientFormModal({ open, patient, insurers, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [form, setForm] = useState(emptyPatient);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = useLocalDate();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const age = calculateAge(form.date_of_birth, today);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyPatient,
      ...patient,
      date_of_birth: patient?.date_of_birth || '',
      age_at_registration:
        patient?.age_at_registration === null || patient?.age_at_registration === undefined
          ? ''
          : String(patient.age_at_registration),
      insurance_enabled: Boolean(patient?.insurance_enabled),
      insurance_type: patient?.insurance_type || 'nhis',
      insurance_provider: patient?.insurance_provider || '',
      insurance_expiry: patient?.insurance_expiry || '',
    });
    setError('');
  }, [open, patient]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function close() {
    if (!saving) onClose();
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await patientRequest(patient ? 'update' : 'create', {
        ...(patient ? { patient_id: patient.id } : {}),
        ...form,
        full_name: form.full_name.trim(),
        age_at_registration: form.date_of_birth ? null : Number(form.age_at_registration),
        insurance_provider:
          form.insurance_type === 'nhis' ? 'NHIS' : form.insurance_provider.trim(),
      });
      onSaved(result.patient);
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Could not save patient details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="patient-form-dialog"
      aria-labelledby="patient-form-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="patient-modal-card">
        <header className="patient-modal-header">
          <span className="patient-modal-icon" aria-hidden="true">＋</span>
          <button className="staff-close-button" type="button" aria-label="Close" onClick={close} disabled={saving}>
            ×
          </button>
        </header>
        <span className="workspace-overline">{patient ? 'PATIENT RECORD' : 'NEW REGISTRATION'}</span>
        <h2 className="patient-modal-title" id="patient-form-title">
          {patient ? 'Edit patient details' : 'Register a patient'}
        </h2>
        <p className="patient-modal-description">
          Add the patient’s details for their hospital record.
        </p>
        {error && <p className="auth-notice auth-notice-error" role="alert">{error}</p>}

        <form className="patient-form" onSubmit={submit}>
          <section className="patient-form-section">
            <h3>Personal details</h3>
            <label className="auth-field patient-field-wide">
              <span>Full name</span>
              <input
                autoComplete="name"
                maxLength={160}
                value={form.full_name}
                onChange={(event) => update('full_name', event.target.value)}
                required
              />
            </label>
            <div className="patient-form-row">
              <label className="auth-field">
                <span>Date of birth</span>
                <input
                  type="date"
                  max={todayString}
                  value={form.date_of_birth}
                  onChange={(event) => update('date_of_birth', event.target.value)}
                />
              </label>
              <label className="auth-field">
                <span>{form.date_of_birth ? 'Age' : 'Age (if no date of birth)'}</span>
                {form.date_of_birth ? (
                  <input value={age ?? ''} aria-label="Calculated age" readOnly />
                ) : (
                  <input
                    type="number"
                    min="0"
                    max="130"
                    value={form.age_at_registration}
                    onChange={(event) => update('age_at_registration', event.target.value)}
                    required={!form.date_of_birth}
                  />
                )}
              </label>
            </div>
            <label className="auth-field">
              <span>Sex</span>
              <select value={form.sex} onChange={(event) => update('sex', event.target.value)} required>
                <option value="" disabled>Select sex</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <div className="patient-form-row">
              <label className="auth-field">
                <span>Residence / town</span>
                <input maxLength={180} value={form.residence} onChange={(event) => update('residence', event.target.value)} />
              </label>
              <label className="auth-field">
                <span>Address</span>
                <input maxLength={500} value={form.address} onChange={(event) => update('address', event.target.value)} />
              </label>
            </div>
          </section>

          <section className="patient-form-section">
            <h3>Family & emergency contacts</h3>
            <div className="patient-form-row">
              <label className="auth-field">
                <span>Parent / guardian name</span>
                <input maxLength={160} value={form.parent_name} onChange={(event) => update('parent_name', event.target.value)} />
              </label>
              <label className="auth-field">
                <span>Parent / guardian number</span>
                <input type="tel" maxLength={40} value={form.parent_phone} onChange={(event) => update('parent_phone', event.target.value)} />
              </label>
              <label className="auth-field">
                <span>Emergency contact name</span>
                <input maxLength={160} value={form.emergency_contact_name} onChange={(event) => update('emergency_contact_name', event.target.value)} />
              </label>
              <label className="auth-field">
                <span>Emergency contact number</span>
                <input type="tel" maxLength={40} value={form.emergency_contact_phone} onChange={(event) => update('emergency_contact_phone', event.target.value)} />
              </label>
            </div>
          </section>

          <section className="patient-form-section patient-insurance-section">
            <label className="patient-insurance-toggle">
              <input
                type="checkbox"
                checked={form.insurance_enabled}
                onChange={(event) => update('insurance_enabled', event.target.checked)}
              />
              <span className="patient-insurance-check" aria-hidden="true" />
              <span>
                <strong>Patient has insurance</strong>
                <small>Coverage is checked when the patient is checked in.</small>
              </span>
            </label>
            {form.insurance_enabled && (
              <div className="patient-form-row patient-insurance-fields">
                <label className="auth-field">
                  <span>Insurance type</span>
                  <select
                    value={form.insurance_type}
                    onChange={(event) => {
                      const type = event.target.value;
                      setForm((current) => ({
                        ...current,
                        insurance_type: type,
                        insurance_provider: type === 'nhis' ? 'NHIS' : '',
                      }));
                    }}
                  >
                    <option value="nhis">NHIS</option>
                    <option value="other">Other insurance</option>
                  </select>
                </label>
                {form.insurance_type === 'other' && (
                  <label className="auth-field">
                    <span>Insurance provider</span>
                    <input
                      list="patient-insurer-options"
                      maxLength={120}
                      value={form.insurance_provider}
                      onChange={(event) => update('insurance_provider', event.target.value)}
                      placeholder="Choose or enter provider"
                      required
                    />
                    <datalist id="patient-insurer-options">
                      {insurers.filter((provider) => provider !== 'NHIS').map((provider) => (
                        <option key={provider} value={provider} />
                      ))}
                    </datalist>
                  </label>
                )}
                <label className="auth-field">
                  <span>Insurance number</span>
                  <input
                    maxLength={120}
                    value={form.insurance_number}
                    onChange={(event) => update('insurance_number', event.target.value)}
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>Expiry date</span>
                  <input
                    type="date"
                    value={form.insurance_expiry}
                    onChange={(event) => update('insurance_expiry', event.target.value)}
                    required
                  />
                </label>
              </div>
            )}
          </section>

          <footer className="patient-form-actions">
            <button className="auth-button auth-button-back" type="button" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button className="auth-button auth-button-primary patient-submit-button" type="submit" disabled={saving}>
              {saving ? 'Saving…' : patient ? 'Save changes' : 'Register patient'}
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

export default PatientFormModal;
