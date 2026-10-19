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
  const [catalogError, setCatalogError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [stockItem, setStockItem] = useState(null);
  const [activeView, setActiveView] = useState('queue');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [catalogResult, queueResult] = await Promise.allSettled([
      clinicalRequest('catalogs'),
      clinicalRequest('lab_queue'),
    ]);
    if (catalogResult.status === 'fulfilled') {
      setCatalogs(catalogResult.value);
      setCatalogError('');
    } else {
      setCatalogs({ labs: [] });
      setCatalogError(catalogResult.reason?.message || 'Could not load the laboratory catalog.');
    }
    if (queueResult.status === 'fulfilled') {
      setOrders(queueResult.value.items || []);
      setQueueError('');
    } else {
      setOrders([]);
      setQueueError(queueResult.reason?.message || 'Could not load laboratory requests.');
    }
    setLoading(false);
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
  const pendingCount = orders.filter((order) => order.status === 'pending').length;
  const inProgressCount = orders.filter((order) => order.status === 'in_progress').length;
  const lowStockCount = catalogs.labs.filter((item) =>
    (item.inventory?.quantity_on_hand ?? 0) <= (item.inventory?.reorder_level ?? 0),
  ).length;

  if (profile?.role !== 'labs') return <Navigate to={basePath} replace />;

  return (
    <section className="clinical-page clinical-workspace-page laboratory-workspace-page">
      <header className="clinical-workspace-heading">
        <div>
          <span className="workspace-overline">LABORATORY WORKSPACE</span>
          <h1>Testing &amp; results</h1>
          <p>Process requested investigations, record results, and monitor test supplies.</p>
        </div>
        <span className="clinical-workspace-heading-mark" aria-hidden="true">Lab</span>
      </header>
      <div className="clinical-workspace-stats" aria-label="Laboratory summary">
        <article><span>Open requests</span><strong>{loading ? '—' : orders.length}</strong><small>Awaiting a result</small></article>
        <article><span>Pending</span><strong>{loading ? '—' : pendingCount}</strong><small>Ready to process</small></article>
        <article><span>In progress</span><strong>{loading ? '—' : inProgressCount}</strong><small>Currently being processed</small></article>
        <article className={lowStockCount ? 'is-attention' : ''}><span>Low-stock tests</span><strong>{loading ? '—' : lowStockCount}</strong><small>At or below reorder level</small></article>
      </div>
      {realtime.error && <p className="auth-notice auth-notice-error" role="status">Live lab and inventory updates are unavailable: {realtime.error}</p>}
      {activeView === 'queue' && queueError && <p className="auth-notice auth-notice-error" role="alert">{queueError}<button className="staff-inline-button" type="button" onClick={() => void loadData()}>Try again</button></p>}
      {activeView === 'inventory' && catalogError && <p className="auth-notice auth-notice-error" role="alert">{catalogError}<button className="staff-inline-button" type="button" onClick={() => void loadData()}>Try again</button></p>}

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
                  <div className="clinical-work-patient-row">
                    <Link className="patient-table-name" to={`${basePath}/patients/${order.patient_id}?tab=labs`}>{order.patient?.full_name || 'Patient record'} <span aria-hidden="true">↗</span></Link>
                    <span className="clinical-work-item-date">Requested {formatDateTime(order.requested_at)}</span>
                  </div>
                  <div className="clinical-work-item-heading">
                    <span className={`clinical-priority-badge is-${order.priority}`}>{order.priority}</span>
                    <h2>{order.catalog_item?.name || 'Laboratory test'}</h2>
                    <span className={`clinical-status-badge is-${order.status}`}>{order.status.replace('_', ' ')}</span>
                  </div>
                  <p className="clinical-prescription-summary">{order.catalog_item?.category} · {order.catalog_item?.code}</p>
                  {order.request_notes && <p className="clinical-notes">{order.request_notes}</p>}
                </div>
                <button className="staff-primary-button clinical-work-action" type="button" onClick={() => setSelectedOrder(order)}>Record result</button>
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
        <button className="staff-secondary-button" type="button" onClick={onAdd}>Receive stock</button>
      </div>
    </article>
  );
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default LaboratoryPage;
