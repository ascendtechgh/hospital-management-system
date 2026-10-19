import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { usePatientRealtime } from '../../../hooks/usePatientRealtime.js';
import { clinicalRequest, groupByCategory } from '../../../lib/clinicalApi.js';
import { InventoryCard } from '../labs/LaboratoryPage.jsx';
import InventoryStockModal from '../clinical/InventoryStockModal.jsx';
import DispenseModal from './DispenseModal.jsx';

function PharmacyPage() {
  const { role } = useParams();
  const { profile } = useAuth();
  const basePath = `/dashboard/${profile?.role || role}`;
  const [catalogs, setCatalogs] = useState({ drugs: [] });
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState('queue');
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [stockItem, setStockItem] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogResult, queueResult] = await Promise.all([
        clinicalRequest('catalogs'),
        clinicalRequest('pharmacy_queue'),
      ]);
      setCatalogs(catalogResult);
      setPrescriptions(queueResult.items || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load pharmacy workspace.');
    } finally {
      setLoading(false);
    }
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
    <section className="clinical-page">
      <header className="patients-page-heading">
        <div><span className="workspace-overline">PHARMACY WORKSPACE</span><h1>Pharmacy</h1></div>
        <div className="clinical-header-counts">
          <span className="nurse-patient-count">{loading ? '—' : `${prescriptions.length} to dispense`}</span>
          <span className="nurse-patient-count">{catalogs.drugs.length} items</span>
        </div>
      </header>
      <p className="clinical-demo-warning" role="note">Example pharmacy quantities are demo values. Reconcile all stock before operational use.</p>
      {realtime.error && <p className="auth-notice auth-notice-error" role="status">Live prescription and inventory updates are unavailable: {realtime.error}</p>}
      {error && <p className="auth-notice auth-notice-error" role="alert">{error}<button className="staff-inline-button" type="button" onClick={() => void loadData()}>Try again</button></p>}

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
                    <div className="clinical-work-item-heading">
                      <span className={`clinical-status-badge is-${item.status}`}>{item.status}</span>
                      <h2>{item.catalog_item?.name || 'Medication'}</h2>
                      <span className={`clinical-stock-label is-${item.inventory?.quantity_on_hand <= item.inventory?.reorder_level ? 'low' : 'in'}`}>
                        Stock {item.inventory?.quantity_on_hand ?? 0}
                      </span>
                    </div>
                    <Link className="patient-table-name" to={`${basePath}/patients/${item.patient_id}?tab=pharmacy`}>{item.patient?.full_name || 'Patient record'} →</Link>
                    <p>{item.dose} · {item.route || 'Route not specified'} · {item.frequency} · {item.duration}</p>
                    <p>Prescribed {item.quantity} · dispensed {item.dispensed_quantity} · remaining {remaining}</p>
                    {item.instructions && <p className="clinical-notes">{item.instructions}</p>}
                  </div>
                  <button className="staff-primary-button" type="button" onClick={() => setSelectedPrescription(item)} disabled={!item.inventory?.quantity_on_hand || remaining <= 0}>Dispense</button>
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
