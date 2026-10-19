import { useEffect, useRef, useState } from 'react';
import { clinicalRequest } from '../../../lib/clinicalApi.js';

function LabResultModal({ order, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [resultValue, setResultValue] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (order && !dialogRef.current?.open) {
      setResultValue('');
      setResultNotes('');
      setError('');
      dialogRef.current?.showModal();
    } else if (!order && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [order]);

  function close() {
    if (!saving) onClose();
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await clinicalRequest('lab_complete', {
        order_id: order.id,
        result_value: resultValue,
        result_notes: resultNotes,
      });
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Could not save laboratory result.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      className="patient-form-dialog clinical-dialog clinical-small-dialog clinical-workspace-dialog laboratory-result-dialog"
      ref={dialogRef}
      aria-labelledby="lab-result-modal-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="patient-modal-card">
        <header className="patient-modal-header">
          <span className="patient-modal-icon" aria-hidden="true">⌕</span>
          <button className="staff-close-button" type="button" aria-label="Close" onClick={close} disabled={saving}>×</button>
        </header>
        <span className="workspace-overline">LABORATORY RESULT</span>
        <h2 className="patient-modal-title" id="lab-result-modal-title">Record result</h2>
        <p className="patient-modal-description">
          {order?.catalog_item?.name} · <strong>{order?.patient?.full_name}</strong>
        </p>
        {order?.request_notes && <p className="clinical-helper">Request note: {order.request_notes}</p>}
        {error && <p className="auth-notice auth-notice-error" role="alert">{error}</p>}
        <form className="patient-form" onSubmit={submit}>
          <label className="auth-field">
            <span>Result</span>
            <textarea required maxLength={5000} rows="4" value={resultValue} onChange={(event) => setResultValue(event.target.value)} />
          </label>
          <label className="auth-field">
            <span>Notes</span>
            <textarea maxLength={5000} rows="3" value={resultNotes} onChange={(event) => setResultNotes(event.target.value)} />
          </label>
          <footer className="patient-form-actions">
            <button className="auth-button auth-button-back" type="button" onClick={close} disabled={saving}>Cancel</button>
            <button className="auth-button auth-button-primary patient-submit-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save result'}</button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

export default LabResultModal;
