import { useEffect, useRef, useState } from 'react';
import { clinicalRequest } from '../../../lib/clinicalApi.js';
import { recordFulfilledService } from '../../../lib/billingLedger.js';

function DispenseModal({ prescription, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [billingNotice, setBillingNotice] = useState('');
  const remaining = prescription
    ? prescription.quantity - prescription.dispensed_quantity
    : 0;

  useEffect(() => {
    if (prescription && !dialogRef.current?.open) {
      setQuantity(String(Math.min(remaining, prescription.inventory?.quantity_on_hand || 0) || ''));
      setNotes('');
      setError('');
      setBillingNotice('');
      dialogRef.current?.showModal();
    } else if (!prescription && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [prescription, remaining]);

  function close() {
    if (!saving) onClose();
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await clinicalRequest('dispense', {
        prescription_id: prescription.id,
        quantity: Number(quantity),
        notes,
      });
      try {
        const dispensedTotal = Number(prescription.dispensed_quantity || 0) + Number(quantity);
        const billing = recordFulfilledService({
          patient: prescription.patient,
          visitId: prescription.consultation_id,
          category: 'Pharmacy',
          description: prescription.catalog_item?.name || prescription.drug_code,
          quantity: Number(quantity),
          sourceRefId: `dispense:${prescription.id}:total:${dispensedTotal}`,
          sourceCode: prescription.drug_code,
          sourceStatus: 'Dispensed',
        });
        setBillingNotice(billing.status === 'unpriced'
          ? 'Medicine dispensed. This quantity is waiting for a tariff in Accounts → Tariffs & procedures.'
          : billing.status === 'billed'
            ? 'Medicine dispensed and the charge was added to the local billing ledger.'
            : 'Medicine dispensed. This quantity was already recorded for billing.');
      } catch {
        setBillingNotice('Medicine dispensed, but its local billing entry could not be recorded. Check Accounts before closing the encounter.');
      }
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Could not dispense prescription.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      className="patient-form-dialog clinical-dialog clinical-small-dialog clinical-workspace-dialog pharmacy-dispense-dialog"
      ref={dialogRef}
      aria-labelledby="dispense-modal-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="patient-modal-card">
        <header className="patient-modal-header">
          <span className="patient-modal-icon" aria-hidden="true">＋</span>
          <button className="staff-close-button" type="button" aria-label="Close" onClick={close} disabled={saving}>×</button>
        </header>
        <span className="workspace-overline">PHARMACY DISPENSING</span>
        <h2 className="patient-modal-title" id="dispense-modal-title">Dispense medicine</h2>
        <p className="patient-modal-description">
          <strong>{prescription?.catalog_item?.name}</strong> for {prescription?.patient?.full_name}
        </p>
        <div className="clinical-prescription-directions">
          <span>{prescription?.dose} · {prescription?.route || 'Route not specified'}</span>
          <span>{prescription?.frequency} · {prescription?.duration}</span>
          <span>Prescribed {prescription?.quantity} · previously dispensed {prescription?.dispensed_quantity} · remaining {remaining}</span>
          <span>Available stock: {prescription?.inventory?.quantity_on_hand ?? 0}</span>
          {prescription?.instructions && <span>{prescription.instructions}</span>}
        </div>
        {error && <p className="auth-notice auth-notice-error" role="alert">{error}</p>}
        {billingNotice && <p className="auth-notice" role="status">{billingNotice}</p>}
        <form className="patient-form" onSubmit={submit}>
          <label className="auth-field">
            <span>Quantity to dispense</span>
            <input type="number" min="1" max={Math.min(remaining, prescription?.inventory?.quantity_on_hand ?? 0)} step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <label className="auth-field">
            <span>Dispensing note</span>
            <textarea rows="2" maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <footer className="patient-form-actions">
            <button className="auth-button auth-button-back" type="button" onClick={close} disabled={saving}>Cancel</button>
            <button className="auth-button auth-button-primary patient-submit-button" type="submit" disabled={saving || !Number(quantity)}>{saving ? 'Saving…' : 'Confirm dispense'}</button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

export default DispenseModal;
