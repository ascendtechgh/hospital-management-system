import { useEffect, useRef, useState } from 'react';
import { patientRequest } from '../../../lib/patientApi.js';

const initialVitals = {
  systolic_blood_pressure: '',
  diastolic_blood_pressure: '',
  pulse_rate: '',
  temperature_c: '',
  respiratory_rate: '',
  oxygen_saturation: '',
  weight_kg: '',
  height_cm: '',
  notes: '',
};

function VitalsModal({ patient, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [values, setValues] = useState(initialVitals);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (patient && !dialogRef.current?.open) {
      setValues(initialVitals);
      setError('');
      dialogRef.current?.showModal();
    } else if (!patient && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [patient]);

  function close() {
    if (!saving) onClose();
  }

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { vital } = await patientRequest('vitals_create', {
        patient_id: patient.id,
        ...values,
      });
      onSaved(vital);
      onClose();
    } catch (saveError) {
      const message = saveError.message || '';
      setError(
        message.includes('Choose a supported patient action')
          ? 'Vitals saving is not available yet. The patient service needs to be updated by your administrator.'
          : message || 'Could not save vitals.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="patient-form-dialog vitals-form-dialog"
      aria-labelledby="vitals-modal-title"
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
          <span className="patient-modal-icon" aria-hidden="true">⌁</span>
          <button className="staff-close-button" type="button" aria-label="Close" onClick={close} disabled={saving}>×</button>
        </header>
        <span className="workspace-overline">NURSING OBSERVATION</span>
        <h2 className="patient-modal-title" id="vitals-modal-title">Check vitals</h2>
        <p className="patient-modal-description">
          Recording for <strong>{patient?.full_name}</strong>. Values are saved to this patient’s record.
        </p>
        {error && <p className="auth-notice auth-notice-error" role="alert">{error}</p>}
        <form className="patient-form" onSubmit={submit}>
          <section className="patient-form-section">
            <h3>Core observations</h3>
            <div className="patient-form-row vitals-field-grid">
              <NumberField label="Systolic BP" unit="mmHg" name="systolic_blood_pressure" value={values.systolic_blood_pressure} min="40" max="300" onChange={update} required />
              <NumberField label="Diastolic BP" unit="mmHg" name="diastolic_blood_pressure" value={values.diastolic_blood_pressure} min="20" max="200" onChange={update} required />
              <NumberField label="Pulse rate" unit="bpm" name="pulse_rate" value={values.pulse_rate} min="20" max="250" onChange={update} required />
              <NumberField label="Temperature" unit="°C" name="temperature_c" value={values.temperature_c} min="25" max="45" step="0.1" onChange={update} required />
              <NumberField label="Respiratory rate" unit="/min" name="respiratory_rate" value={values.respiratory_rate} min="4" max="80" onChange={update} required />
              <NumberField label="Oxygen saturation" unit="%" name="oxygen_saturation" value={values.oxygen_saturation} min="50" max="100" onChange={update} required />
            </div>
          </section>
          <section className="patient-form-section">
            <h3>Additional measurements <span>Optional</span></h3>
            <div className="patient-form-row">
              <NumberField label="Weight" unit="kg" name="weight_kg" value={values.weight_kg} min="0.2" max="500" step="0.01" onChange={update} />
              <NumberField label="Height" unit="cm" name="height_cm" value={values.height_cm} min="20" max="280" step="0.01" onChange={update} />
            </div>
          </section>
          <label className="auth-field">
            <span>Notes</span>
            <textarea maxLength={1000} rows="3" value={values.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Additional clinical observation (optional)" />
          </label>
          <footer className="patient-form-actions">
            <button className="auth-button auth-button-back" type="button" onClick={close} disabled={saving}>Cancel</button>
            <button className="auth-button auth-button-primary patient-submit-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save vitals'}</button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

function NumberField({ label, unit, name, value, min, max, step = '1', onChange, required = false }) {
  return (
    <label className="auth-field vitals-number-field">
      <span>{label}</span>
      <span className="vitals-input-wrap">
        <input
          type="number"
          name={name}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          required={required}
        />
        <small>{unit}</small>
      </span>
    </label>
  );
}

export default VitalsModal;
