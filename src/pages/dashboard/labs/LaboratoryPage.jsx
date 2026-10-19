import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { usePatientRealtime } from '../../../hooks/usePatientRealtime.js';
import { clinicalRequest, groupByCategory } from '../../../lib/clinicalApi.js';
import InventoryStockModal from '../clinical/InventoryStockModal.jsx';
import LabResultModal from './LabResultModal.jsx';

function LaboratoryPage() {
  const { role } = useParams();
  const { profile } = useAuth();
  const basePath = `/dashboard/${profile?.role || role}`;
  const [catalogs, setCatalogs] = useState({ labs: [] });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [stockItem, setStockItem] = useState(null);
  const [activeView, setActiveView] = useState('queue');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogResult, queueResult] = await Promise.all([
        clinicalRequest('catalogs'),
        clinicalRequest('lab_queue'),
      ]);
      setCatalogs(catalogResult);
      setOrders(queueResult.items || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load laboratory workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  const realtime = usePatientRealtime(profile?.hospital_id, () => {
    void loadData();
  });

  useEffect(() => {
    if (profile?.role === 'labs') void loadData();
  }, [loadData, profile?.role]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? orders.filter((order) =>
      `${order.patient?.full_name || ''} ${order.catalog_item?.name || ''} ${order.catalog_item?.code || ''}`
        .toLocaleLowerCase().includes(query)) : orders;
  }, [orders, search]);
  const labGroups = useMemo(() => groupByCategory(
    catalogs.labs.filter((item) => `${item.name} ${item.code} ${item.category}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
  ), [catalogs.labs, search]);

  if (profile?.role !== 'labs') return <Navigate to={basePath} replace />;

  return (
    <section className="clinical-page">
      <header className="patients-page-heading">
        <div><span className="workspace-overline">LABORATORY WORKSPACE</span><h1>Laboratory</h1></div>
        <div className="clinical-header-counts">
          <span className="nurse-patient-count">{loading ? '—' : `${orders.length} open requests`}</span>
          <span className="nurse-patient-count">{catalogs.labs.length} tests</span>
        </div>
      </header>
      <p className="clinical-demo-warning" role="note">Example inventory quantities are demo values. Lab requests do not deduct stock.</p>
      {realtime.error && <p className="auth-notice auth-notice-error" role="status">Live lab and inventory updates are unavailable: {realtime.error}</p>}
      {error && <p className="auth-notice auth-notice-error" role="alert">{error}<button className="staff-inline-button" type="button" onClick={() => void loadData()}>Try again</button></p>}

      <div className="clinical-workspace-toolbar">
        <div className="staff-view-toggle" role="group" aria-label="Laboratory workspace">
          <button type="button" className={activeView === 'queue' ? 'is-active' : ''} aria-pressed={activeView === 'queue'} onClick={() => setActiveView('queue')}>Requests</button>
          <button type="button" className={activeView === 'inventory' ? 'is-active' : ''} aria-pressed={activeView === 'inventory'} onClick={() => setActiveView('inventory')}>Test inventory</button>
        </div>
        <label className="staff-search clinical-search">
          <span className="sr-only">Search laboratory workspace</span><span aria-hidden="true">⌕</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeView === 'queue' ? 'Search patient or requested test' : 'Search catalog'} />
        </label>
      </div>

      {loading ? (
        <div className="staff-state"><span className="auth-spinner" aria-hidden="true" /> Loading laboratory workspace…</div>
      ) : activeView === 'queue' ? (
        filteredOrders.length ? (
          <div className="clinical-record-list">
            {filteredOrders.map((order) => (
              <article className="clinical-work-item" key={order.id}>
                <div className="clinical-work-item-main">
                  <div className="clinical-work-item-heading">
                    <span className={`clinical-priority-badge is-${order.priority}`}>{order.priority}</span>
                    <h2>{order.catalog_item?.name || 'Laboratory test'}</h2>
                    <span className="clinical-status-badge">{order.status.replace('_', ' ')}</span>
                  </div>
                  <Link className="patient-table-name" to={`${basePath}/patients/${order.patient_id}?tab=labs`}>{order.patient?.full_name || 'Patient record'} →</Link>
                  <p>{order.catalog_item?.category} · {order.catalog_item?.code} · Requested {formatDateTime(order.requested_at)}</p>
                  {order.request_notes && <p className="clinical-notes">{order.request_notes}</p>}
                </div>
                <button className="staff-primary-button" type="button" onClick={() => setSelectedOrder(order)}>Record result</button>
              </article>
            ))}
          </div>
        ) : (
          <div className="staff-empty-state"><span className="staff-empty-icon">⌕</span><h3>No open lab requests</h3><p>New requests from consulting will appear here in real time.</p></div>
        )
      ) : (
        <div className="clinical-catalog">
          {Object.entries(labGroups).map(([category, items]) => (
            <section className="clinical-catalog-group" key={category}>
              <header><h2>{category}</h2><span>{items.length} tests</span></header>
              <div className="clinical-inventory-grid">
                {items.map((item) => (
                  <InventoryCard
                    key={item.code}
                    item={item}
                    onAdd={() => setStockItem(item)}
                  />
                ))}
              </div>
            </section>
          ))}
          {!Object.keys(labGroups).length && <div className="staff-empty-state"><h3>No matching tests</h3><p>Try another search.</p></div>}
        </div>
      )}

      <LabResultModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onSaved={() => void loadData()} />
      <InventoryStockModal item={stockItem} itemType="lab" onClose={() => setStockItem(null)} onSaved={() => void loadData()} />
    </section>
  );
}

export function InventoryCard({ item, onAdd }) {
  const inventory = item.inventory;
  const quantity = inventory?.quantity_on_hand ?? 0;
  const status = quantity === 0 ? 'out' : quantity <= (inventory?.reorder_level ?? 0) ? 'low' : 'in';
  const statusLabel = status === 'out' ? 'Out of stock' : status === 'low' ? 'Low stock' : 'In stock';
  return (
    <article className="clinical-inventory-card">
      <div><span className={`clinical-stock-dot is-${status}`} /><span className={`clinical-stock-label is-${status}`}>{statusLabel}</span></div>
      <h3>{item.name}</h3>
      <p>{item.code} · {item.category}</p>
      <div className="clinical-inventory-card-footer">
        <span><strong>{quantity}</strong> on hand <small>· reorder at {inventory?.reorder_level ?? 0}</small></span>
        {inventory?.demo_stock && <small className="clinical-demo-tag">Example</small>}
        <button className="staff-secondary-button" type="button" onClick={onAdd}>Receive stock</button>
      </div>
    </article>
  );
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default LaboratoryPage;
