import { useEffect, useRef, useState } from 'react';
import { clinicalRequest } from '../../../lib/clinicalApi.js';

function InventoryStockModal({ item, itemType, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [quantity, setQuantity] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item && !dialogRef.current?.open) {
      setQuantity('');
      setReorderLevel(String(item.inventory?.reorder_level ?? 5));
      setError('');
      dialogRef.current?.showModal();
    } else if (!item && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [item]);

  function close() {
    if (!saving) onClose();
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await clinicalRequest('inventory_add', {
        item_type: itemType,
        item_code: item.code,
        quantity,
        reorder_level: reorderLevel,
        replace_demo: item.inventory?.demo_stock === true,
      });
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Could not update inventory.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      className={`patient-form-dialog clinical-dialog clinical-small-dialog clinical-workspace-dialog ${itemType}-inventory-dialog`}
      ref={dialogRef}
      aria-labelledby="inventory-modal-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="patient-modal-card">
        <header className="patient-modal-header">
          <span className="patient-modal-icon" aria-hidden="true">▤</span>
          <button className="staff-close-button" type="button" aria-label="Close" onClick={close} disabled={saving}>×</button>
        </header>
        <span className="workspace-overline">{item?.inventory?.demo_stock ? 'INVENTORY COUNT' : 'INVENTORY RECEIPT'}</span>
        <h2 className="patient-modal-title" id="inventory-modal-title">{item?.inventory?.demo_stock ? 'Set counted stock' : 'Add stock'}</h2>
        <p className="patient-modal-description"><strong>{item?.name}</strong> · {item?.code}</p>
        {error && <p className="auth-notice auth-notice-error" role="alert">{error}</p>}
        <form className="patient-form" onSubmit={submit}>
          <div className="clinical-form-grid clinical-form-grid-2">
            <label className="auth-field">
              <span>{item?.inventory?.demo_stock ? 'Counted quantity on hand' : 'Quantity received'}</span>
              <input type="number" min={item?.inventory?.demo_stock ? '0' : '1'} max="1000000" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Low-stock threshold</span>
              <input type="number" min="0" max="1000000" step="1" required value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} />
            </label>
          </div>
          <footer className="patient-form-actions">
            <button className="auth-button auth-button-back" type="button" onClick={close} disabled={saving}>Cancel</button>
            <button className="auth-button auth-button-primary patient-submit-button" type="submit" disabled={saving}>{saving ? 'Saving…' : item?.inventory?.demo_stock ? 'Save counted stock' : 'Receive stock'}</button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

export default InventoryStockModal;
