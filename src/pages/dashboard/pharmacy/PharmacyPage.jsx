import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { usePatientRealtime } from '../../../hooks/usePatientRealtime.js';
import { clinicalRequest, groupByCategory } from '../../../lib/clinicalApi.js';
import { setBillingScope } from '../../../lib/billingLedger.js';
import { InventoryCard } from '../labs/LaboratoryPage.jsx';
import InventoryStockModal from '../clinical/InventoryStockModal.jsx';
import DispenseModal from './DispenseModal.jsx';

function formatDateTime(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function PharmacyPage() {
  const { role } = useParams();
  const { profile } = useAuth();
  setBillingScope(profile?.hospital_id || 'local');
  const basePath = `/dashboard/${profile?.role || role}`;
  const [catalogs, setCatalogs] = useState({ drugs: [] });
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState('queue');
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [stockItem, setStockItem] = useState(null);
  const pendingCount = prescriptions.filter((item) => item.status === 'pending').length;
  const partialCount = prescriptions.filter((item) => item.status === 'partial').length;
  const lowStockCount = catalogs.drugs.filter((item) =>
    (item.inventory?.quantity_on_hand ?? 0) <= (item.inventory?.reorder_level ?? 0),
  ).length;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [catalogResult, queueResult] = await Promise.allSettled([
      clinicalRequest('catalogs'),
      clinicalRequest('pharmacy_queue'),
    ]);
    if (catalogResult.status === 'fulfilled') {
      setCatalogs(catalogResult.value);
      setCatalogError('');
    } else {
      setCatalogs({ drugs: [] });
      setCatalogError(catalogResult.reason?.message || 'Could not load the drug catalog.');
    }
    if (queueResult.status === 'fulfilled') {
      setPrescriptions(queueResult.value.items || []);
      setQueueError('');
    } else {
      setPrescriptions([]);
      setQueueError(queueResult.reason?.message || 'Could not load prescriptions to dispense.');
    }
    setLoading(false);
  }, []);

  const realtime = usePatientRealtime(profile?.hospital_id, () => {
    void loadData();
  });

  useEffect(() => {
    if (profile?.role === 'pharmacy') void loadData();
  }, [loadData, profile?.role]);

  const filteredPrescriptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? prescriptions.filter((item) =>
      `${item.patient?.full_name || ''} ${item.catalog_item?.name || ''} ${item.catalog_item?.code || ''}`
        .toLocaleLowerCase().includes(query)) : prescriptions;
  }, [prescriptions, search]);
  const drugGroups = useMemo(() => groupByCategory(
    catalogs.drugs.filter((item) => `${item.name} ${item.code} ${item.category}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
  ), [catalogs.drugs, search]);

  if (profile?.role !== 'pharmacy') return <Navigate to={basePath} replace />;

  return (
    <section className="clinical-page clinical-workspace-page pharmacy-workspace-page">
      <header className="clinical-workspace-heading">
        <div>
          <span className="workspace-overline">PHARMACY WORKSPACE</span>
          <h1>Dispensing &amp; inventory</h1>
          <p>Review prescriptions, dispense safely, and keep medicine stock up to date.</p>
        </div>
        <span className="clinical-workspace-heading-mark" aria-hidden="true">Rx</span>
      </header>
      <div className="clinical-workspace-stats" aria-label="Pharmacy summary">
        <article><span>Open prescriptions</span><strong>{loading ? '—' : prescriptions.length}</strong><small>Awaiting a pharmacy action</small></article>
        <article><span>Pending</span><strong>{loading ? '—' : pendingCount}</strong><small>Not yet dispensed</small></article>
        <article><span>Partially dispensed</span><strong>{loading ? '—' : partialCount}</strong><small>Quantity remaining</small></article>
        <article className={lowStockCount ? 'is-attention' : ''}><span>Low-stock medicines</span><strong>{loading ? '—' : lowStockCount}</strong><small>At or below reorder level</small></article>
      </div>
      {realtime.error && <p className="auth-notice auth-notice-error" role="status">Live prescription and inventory updates are unavailable: {realtime.error}</p>}
      {activeView === 'queue' && queueError && <p className="auth-notice auth-notice-error" role="alert">{queueError}<button className="staff-inline-button" type="button" onClick={() => void loadData()}>Try again</button></p>}
      {activeView === 'inventory' && catalogError && <p className="auth-notice auth-notice-error" role="alert">{catalogError}<button className="staff-inline-button" type="button" onClick={() => void loadData()}>Try again</button></p>}

      <div className="clinical-workspace-toolbar">
        <div className="staff-view-toggle" role="group" aria-label="Pharmacy workspace">
          <button type="button" className={activeView === 'queue' ? 'is-active' : ''} aria-pressed={activeView === 'queue'} onClick={() => setActiveView('queue')}>Prescriptions</button>
          <button type="button" className={activeView === 'inventory' ? 'is-active' : ''} aria-pressed={activeView === 'inventory'} onClick={() => setActiveView('inventory')}>Drug inventory</button>
        </div>
        <label className="staff-search clinical-search">
          <span className="sr-only">Search pharmacy workspace</span><span aria-hidden="true">⌕</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeView === 'queue' ? 'Search patient or medicine' : 'Search drug catalog'} />
        </label>
      </div>

      {loading ? (
        <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading pharmacy workspace…</div>
      ) : activeView === 'queue' ? (
        filteredPrescriptions.length ? (
          <div className="clinical-record-list">
            {filteredPrescriptions.map((item) => {
              const remaining = item.quantity - item.dispensed_quantity;
              return (
                <article className="clinical-work-item" key={item.id}>
                  <div className="clinical-work-item-main">
                    <div className="clinical-work-patient-row">
                      <Link className="patient-table-name" to={`${basePath}/patients/${item.patient_id}?tab=pharmacy`}>{item.patient?.full_name || 'Patient record'} <span aria-hidden="true">↗</span></Link>
                      <span className="clinical-work-item-date">Prescribed {formatDateTime(item.created_at)}</span>
                    </div>
                    <div className="clinical-work-item-heading">
                      <span className={`clinical-status-badge is-${item.status}`}>{item.status}</span>
                      <h2>{item.catalog_item?.name || 'Medication'}</h2>
                      <span className={`clinical-stock-label is-${item.inventory?.quantity_on_hand <= item.inventory?.reorder_level ? 'low' : 'in'}`}>
                        {item.inventory?.quantity_on_hand ?? 0} in stock
                      </span>
                    </div>
                    <p className="clinical-prescription-summary">{item.dose} · {item.route || 'Route not specified'} · {item.frequency} · {item.duration}</p>
                    <div className="clinical-quantity-summary">
                      <span>Prescribed <b>{item.quantity}</b></span>
                      <span>Dispensed <b>{item.dispensed_quantity}</b></span>
                      <span>Remaining <b>{remaining}</b></span>
                    </div>
                    {item.instructions && <p className="clinical-notes">{item.instructions}</p>}
                  </div>
                  <button className="staff-primary-button clinical-work-action" type="button" onClick={() => setSelectedPrescription(item)} disabled={!item.inventory?.quantity_on_hand || remaining <= 0}>
                    {remaining <= 0 ? 'Complete' : 'Dispense'}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="staff-empty-state"><span className="staff-empty-icon">＋</span><h3>No prescriptions waiting</h3><p>Prescriptions from consultations will appear here in real time.</p></div>
        )
      ) : (
        <div className="clinical-catalog">
          {Object.entries(drugGroups).map(([category, items]) => (
            <section className="clinical-catalog-group" key={category}>
              <header><h2>{category}</h2><span>{items.length} items</span></header>
              <div className="clinical-inventory-grid">
                {items.map((item) => <InventoryCard key={item.code} item={item} onAdd={() => setStockItem(item)} />)}
              </div>
            </section>
          ))}
          {!Object.keys(drugGroups).length && <div className="staff-empty-state"><h3>No matching medicines</h3><p>Try another search.</p></div>}
        </div>
      )}

      <DispenseModal prescription={selectedPrescription} onClose={() => setSelectedPrescription(null)} onSaved={() => void loadData()} />
      <InventoryStockModal item={stockItem} itemType="drug" onClose={() => setStockItem(null)} onSaved={() => void loadData()} />
    </section>
  );
}

export default PharmacyPage;
