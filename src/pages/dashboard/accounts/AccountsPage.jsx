import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { patientRequest } from '../../../lib/patientApi.js';
import { supabase } from '../../../lib/supabase.js';
import { appendCharge, auditEvent, billUnpricedService, createCharge, formatGHS, getBillingCatalog, getLedger, getReconciliations, moneyToPesewas, patientBalance, recordPayment, saveBillingCatalog, saveReconciliation } from '../../../lib/billingLedger.js';
import ThermalReceipt from './ThermalReceipt.jsx';
import './accounts.css';

const tabs = [
  { id: 'overview', label: 'Overview', path: '' },
  { id: 'cashier', label: 'Cashier POS', path: '/cashier' },
  { id: 'receipts', label: 'Receipts & transactions', path: '/receipts' },
  { id: 'reconciliation', label: 'Daily reconciliation', path: '/reconciliation' },
  { id: 'analytics', label: 'Financial analytics', path: '/analytics' },
  { id: 'tariffs', label: 'Tariffs & procedures', path: '/tariffs' },
];

function todayKey() { return new Date().toISOString().slice(0, 10); }
function moneySum(items, key) { return items.reduce((sum, item) => sum + moneyToPesewas(item[key]), 0) / 100; }

export default function AccountsPage() {
  const { role } = useParams();
  const { profile, user } = useAuth();
  const [params] = useSearchParams();
  const page = window.location.pathname.split('/').filter(Boolean).at(-1);
  const activeTab = page === 'cashier' || page === 'receipts' || page === 'reconciliation' || page === 'analytics' || page === 'tariffs' ? page : 'overview';
  const basePath = `/dashboard/${profile?.role || role}`;
  const [ledger, setLedger] = useState(() => getLedger());
  const [billingCatalog, setBillingCatalog] = useState(() => getBillingCatalog());
  const [tariffDialogOpen, setTariffDialogOpen] = useState(false);
  const [procedureDialogOpen, setProcedureDialogOpen] = useState(false);
  const [procedureError, setProcedureError] = useState('');
  const [procedureForm, setProcedureForm] = useState({ patientId: '', tariffId: '', quantity: '1', sourceRefId: '', notes: '' });
  const [editingTariffId, setEditingTariffId] = useState('');
  const [tariffError, setTariffError] = useState('');
  const [tariffForm, setTariffForm] = useState({ category: 'Laboratory', sourceCode: '', name: '', cashPrice: '', nhisPrice: '' });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [patients, setPatients] = useState([]);
  const [hospital, setHospital] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedCharges, setSelectedCharges] = useState([]);
  const [method, setMethod] = useState('Cash');
  const [network, setNetwork] = useState('MTN MoMo');
  const [momoRef, setMomoRef] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [cashierName, setCashierName] = useState(profile?.full_name || user?.email?.split('@')[0] || 'Cashier');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [openingFloat, setOpeningFloat] = useState('');
  const [cashCount, setCashCount] = useState('');
  const [momoCount, setMomoCount] = useState('');
  const [cardCount, setCardCount] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [reconciliations, setReconciliations] = useState(() => getReconciliations());
  const [transactionSearch, setTransactionSearch] = useState('');
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState({ patientId: '', category: 'Consultation', description: '', quantity: '1', unitPrice: '', nhisPrice: '', sourceRefId: '', sourceStatus: 'Completed' });

  const refreshLedger = useCallback(() => setLedger(getLedger()), []);
  useEffect(() => {
    window.addEventListener('ascendhms:billing-change', refreshLedger);
    window.addEventListener('storage', refreshLedger);
    return () => {
      window.removeEventListener('ascendhms:billing-change', refreshLedger);
      window.removeEventListener('storage', refreshLedger);
    };
  }, [refreshLedger]);

  useEffect(() => {
    let active = true;
    patientRequest('list').then((result) => { if (active) setPatients(result.patients || []); }).catch((loadError) => { if (active) setError(loadError.message || 'Patient directory could not be loaded.'); });
    if (supabase && profile?.hospital_id) {
      supabase.from('hospitals').select('name, address, phone').eq('id', profile.hospital_id).maybeSingle().then(({ data }) => { if (active && data) setHospital(data); });
    }
    return () => { active = false; };
  }, [profile?.hospital_id]);

  const chargesToday = ledger.charges.filter((charge) => charge.createdAt?.slice(0, 10) === todayKey());
  const paymentsToday = ledger.payments.filter((payment) => payment.createdAt?.slice(0, 10) === todayKey());
  const pendingCharges = ledger.charges.filter((charge) => !['Settled', 'Claimed', 'Waived'].includes(charge.status));
  const patientMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return patients.filter((patient) => !query || [patient.full_name, patient.patient_number, patient.mrn, patient.phone].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [patients, search]);
  const chosenPatient = patients.find((patient) => patient.id === selectedPatientId);
  const chosenCharges = ledger.charges.filter((charge) => charge.patientId === selectedPatientId && selectedCharges.includes(charge.id));
  const gross = moneySum(chosenCharges, 'chargeAmount');
  const covered = moneySum(chosenCharges, 'insurerAmount');
  const due = chosenCharges.reduce((sum, charge) => sum + patientBalance(charge, ledger.payments), 0);
  const expectedCash = paymentsToday.filter((p) => p.paymentMethod === 'Cash').reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
  const expectedMomo = paymentsToday.filter((p) => p.paymentMethod === 'Mobile Money').reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
  const expectedCard = paymentsToday.filter((p) => p.paymentMethod === 'Bank Card').reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
  const physicalCash = Number(cashCount || 0);
  const variance = physicalCash - (Number(openingFloat || 0) + expectedCash);

  function submitFulfilledCharge(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const patient = patients.find((item) => item.id === chargeForm.patientId);
      if (!patient) throw new Error('Select a patient before adding a charge.');
      const charge = createCharge({
        patient,
        category: chargeForm.category,
        description: chargeForm.description,
        quantity: Number(chargeForm.quantity),
        unitPrice: Number(chargeForm.unitPrice),
        nhisPrice: Number(chargeForm.nhisPrice || 0),
        sourceRefId: chargeForm.sourceRefId,
        sourceStatus: chargeForm.sourceStatus,
      });
      appendCharge(charge);
      setLedger(getLedger());
      setChargeDialogOpen(false);
      setChargeForm({ patientId: '', category: 'Consultation', description: '', quantity: '1', unitPrice: '', nhisPrice: '', sourceRefId: '', sourceStatus: 'Completed' });
      auditEvent('billing.charge_created', `${charge.category}: ${charge.description} for ${patient.full_name}`, cashierName);
      setNotice('Fulfilled service added to the patient billing ledger.');
    } catch (chargeError) {
      setError(chargeError.message || 'The charge could not be recorded.');
    }
  }

  function openTariffEditor(tariff = null) {
    setEditingTariffId(tariff?.id || '');
    setTariffForm(tariff ? { category: tariff.category, sourceCode: tariff.sourceCode, name: tariff.name, cashPrice: String(tariff.cashPrice), nhisPrice: String(tariff.nhisPrice ?? 0) } : { category: 'Laboratory', sourceCode: '', name: '', cashPrice: '', nhisPrice: '' });
    setTariffError('');
    setTariffDialogOpen(true);
  }

  function submitTariff(event) {
    event.preventDefault();
    setTariffError('');
    try {
      const next = {
        id: editingTariffId || crypto.randomUUID(),
        category: tariffForm.category,
        sourceCode: tariffForm.sourceCode.trim(),
        name: tariffForm.name.trim(),
        cashPrice: Number(tariffForm.cashPrice),
        nhisPrice: Number(tariffForm.nhisPrice || 0),
      };
      const services = editingTariffId
        ? billingCatalog.services.map((item) => item.id === editingTariffId ? next : item)
        : [...billingCatalog.services, next];
      const saved = saveBillingCatalog({ services });
      setBillingCatalog(saved);
      setTariffDialogOpen(false);
      setNotice('Local tariff saved. Unpriced fulfilled services can now be billed.');
      auditEvent('billing.tariff_saved', `${next.category} tariff: ${next.name} (${next.sourceCode})`, cashierName);
    } catch (saveError) {
      setTariffError(saveError.message || 'Tariff could not be saved.');
    }
  }

  function removeTariff(id) {
    const tariff = billingCatalog.services.find((item) => item.id === id);
    if (!tariff || !window.confirm(`Remove the local tariff for ${tariff.name}?`)) return;
    try {
      const saved = saveBillingCatalog({ services: billingCatalog.services.filter((item) => item.id !== id) });
      setBillingCatalog(saved);
      setNotice('Tariff removed. Existing charges are unchanged.');
    } catch (saveError) {
      setTariffError(saveError.message || 'Tariff could not be removed.');
    }
  }

  function submitProcedure(event) {
    event.preventDefault();
    setProcedureError('');
    try {
      const patient = patients.find((item) => item.id === procedureForm.patientId);
      const tariff = billingCatalog.services.find((item) => item.id === procedureForm.tariffId && item.category === 'Procedure');
      if (!patient) throw new Error('Select a patient for the completed procedure.');
      if (!tariff) throw new Error('Add or select a procedure tariff first.');
      const sourceRefId = `procedure:${procedureForm.sourceRefId.trim()}`;
      const result = recordFulfilledService({
        patient,
        category: 'Procedure',
        description: procedureForm.notes.trim() ? `${tariff.name} · ${procedureForm.notes.trim()}` : tariff.name,
        quantity: Number(procedureForm.quantity),
        sourceRefId,
        sourceCode: tariff.sourceCode,
        sourceStatus: 'Confirmed',
      });
      if (result.status === 'duplicate') throw new Error('That procedure reference has already been recorded.');
      setLedger(getLedger());
      setProcedureDialogOpen(false);
      setProcedureForm({ patientId: '', tariffId: '', quantity: '1', sourceRefId: '', notes: '' });
      setNotice(`Completed procedure recorded for ${patient.full_name}. The charge is saved in the local billing ledger.`);
      auditEvent('billing.procedure_completed', `${tariff.name} for ${patient.full_name} · ${sourceRefId}`, cashierName);
    } catch (submitError) {
      setProcedureError(submitError.message || 'Procedure could not be recorded.');
    }
  }

  function resolveUnpricedService(service) {
    setError('');
    setNotice('');
    try {
      const result = billUnpricedService(service.id);
      setLedger(getLedger());
      setNotice(result.status === 'billed' ? `Charge created for ${service.patientName}.` : 'The service was already billed; the duplicate queue item was cleared.');
    } catch (billError) {
      setError(billError.message || 'Service could not be billed.');
    }
  }

  function selectPatient(id) {
    setSelectedPatientId(id);
    const initialSelected = ledger.charges.filter((charge) => charge.patientId === id && !['Settled', 'Claimed', 'Waived'].includes(charge.status)).map((charge) => charge.id);
    setSelectedCharges(initialSelected);
    setPaymentAmount(String(initialSelected.reduce((sum, chargeId) => { const charge = ledger.charges.find((item) => item.id === chargeId); return sum + (charge ? patientBalance(charge, ledger.payments) : 0); }, 0).toFixed(2)));
    setError('');
    setNotice('');
  }

  function submitPayment(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const payment = recordPayment({
        patientId: selectedPatientId,
        visitId: chosenCharges[0]?.visitId,
        chargeIds: selectedCharges,
        amountPaid: Number(paymentAmount),
        paymentMethod: method,
        cashierName,
        cashierId: user?.id,
        momoRef: method === 'Mobile Money' ? momoRef : '',
        network: method === 'Mobile Money' ? network : '',
        cashTendered: method === 'Cash' ? Number(cashTendered) : undefined,
      });
      const nextLedger = getLedger();
      setLedger(nextLedger);
      setReceipt({ payment, charges: nextLedger.charges, patient: chosenPatient });
      auditEvent('payment.settled', `${payment.receiptNumber} for ${chosenPatient?.full_name || selectedPatientId}`, cashierName);
      setNotice(`Payment recorded. Receipt ${payment.receiptNumber} is ready to print.`);
      setSelectedCharges([]);
      setPaymentAmount('');
      setMomoRef('');
      setCashTendered('');
    } catch (submitError) {
      setError(submitError.message || 'Payment could not be recorded.');
    }
  }

  function closeShift(event) {
    event.preventDefault();
    const momoVariance = Number(momoCount || 0) - expectedMomo;
    const cardVariance = Number(cardCount || 0) - expectedCard;
    if ((Math.abs(variance) >= 0.01 || Math.abs(momoVariance) >= 0.01 || Math.abs(cardVariance) >= 0.01) && !varianceReason.trim()) {
      setError('Enter an explanation when any payment method has a reconciliation variance.');
      return;
    }
    setError('');
    const record = {
      id: crypto.randomUUID(),
      date: todayKey(),
      cashierName,
      openingFloat: Number(openingFloat || 0),
      expectedCash: Number(openingFloat || 0) + expectedCash,
      cashCount: physicalCash,
      cashVariance: Number(variance.toFixed(2)),
      expectedMomo,
      countedMomo: Number(momoCount || 0),
      expectedCard,
      countedCard: Number(cardCount || 0),
      momoVariance: Number(momoVariance.toFixed(2)),
      cardVariance: Number(cardVariance.toFixed(2)),
      reason: varianceReason.trim(),
      createdAt: new Date().toISOString(),
    };
    if ((record.cashVariance !== 0 || Math.abs(record.expectedMomo - record.countedMomo) > 0.009 || Math.abs(record.expectedCard - record.countedCard) > 0.009) && !record.reason) {
      setError('Add a reason for any cash, Mobile Money or card variance.');
      return;
    }
    saveReconciliation(record);
    setReconciliations(getReconciliations());
    auditEvent('cashier.shift_reconciled', `Cash variance ${formatGHS(record.cashVariance)}`, cashierName);
    setNotice('Shift reconciliation saved.');
    setError('');
  }

  if (!['hospitaladmin', 'superadmin', 'cashier', 'billing_claims', 'reception'].includes(profile?.role)) return <Navigate to={basePath} replace />;

  const visibleTransactions = ledger.payments.filter((payment) => `${payment.receiptNumber} ${payment.cashierName} ${payment.momoRef || ''}`.toLowerCase().includes(transactionSearch.toLowerCase()));
  const cashCollected = moneySum(paymentsToday.filter((p) => p.paymentMethod === 'Cash'), 'amountPaid');
  const momoCollected = moneySum(paymentsToday.filter((p) => p.paymentMethod === 'Mobile Money'), 'amountPaid');
  const cardCollected = moneySum(paymentsToday.filter((p) => p.paymentMethod === 'Bank Card'), 'amountPaid');
  const insuranceValue = moneySum(chargesToday, 'insurerAmount');
  const grossValue = moneySum(chargesToday, 'chargeAmount');
  const netPatientDue = moneySum(chargesToday, 'patientAmount');

  return (
    <section className="accounts-page">
      <header className="accounts-page-heading">
        <div><span className="workspace-overline">FINANCE AND REVENUE</span><h1>Accounts & Cashier</h1><p>Patient balances, payment collection and shift controls.</p></div>
        <span className="accounts-date">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </header>
      <nav className="accounts-tabs" aria-label="Accounts workspace">
        {tabs.map((tab) => <Link key={tab.id} className={activeTab === tab.id ? 'is-active' : ''} to={`${basePath}/accounts${tab.path}`}>{tab.label}</Link>)}
      </nav>
      {error && <p className="auth-notice auth-notice-error" role="alert">{error}</p>}
      {notice && <p className="settings-success" role="status">{notice}</p>}

      {activeTab === 'overview' && <>
        <div className="accounts-overview-actions"><p>Only completed or fulfilled service facts can enter the billing ledger.</p><button className="staff-primary-button" type="button" onClick={() => setChargeDialogOpen(true)}>Record fulfilled service</button></div>
        <div className="accounts-metric-grid">
          <Metric label="Gross charges today" value={formatGHS(grossValue)} hint={`${chargesToday.length} charge facts recorded`} />
          <Metric label="Patient payments today" value={formatGHS(cashCollected + momoCollected + cardCollected)} hint="Confirmed local transactions" />
          <Metric label="Insurance portion" value={formatGHS(insuranceValue)} hint="For claim follow-up, not cashier collection" />
          <Metric label="Outstanding patient balance" value={formatGHS(pendingCharges.reduce((sum, charge) => sum + patientBalance(charge, ledger.payments), 0))} hint={`${pendingCharges.length} unsettled charge lines`} />
        </div>
        <div className="accounts-two-column">
          <section className="accounts-panel"><PanelHeading title="Today's collection" subtitle="Settlements recorded by payment method" /><div className="accounts-collection-row"><span>Cash</span><strong>{formatGHS(cashCollected)}</strong></div><div className="accounts-collection-row"><span>Mobile Money</span><strong>{formatGHS(momoCollected)}</strong></div><div className="accounts-collection-row"><span>Bank card</span><strong>{formatGHS(cardCollected)}</strong></div><div className="accounts-collection-row accounts-collection-total"><span>Total collected</span><strong>{formatGHS(cashCollected + momoCollected + cardCollected)}</strong></div></section>
          <section className="accounts-panel"><PanelHeading title="Cashier shortcuts" subtitle="Move directly to daily operations" /><Link className="accounts-shortcut" to={`${basePath}/accounts/cashier`}><span><strong>Collect a payment</strong><small>Find a patient and settle their balance</small></span><b>→</b></Link><Link className="accounts-shortcut" to={`${basePath}/accounts/reconciliation`}><span><strong>Reconcile a shift</strong><small>Compare expected and counted totals</small></span><b>→</b></Link><Link className="accounts-shortcut" to={`${basePath}/accounts/receipts`}><span><strong>Review receipts</strong><small>Search and reprint past transactions</small></span><b>→</b></Link><Link className="accounts-shortcut" to={`${basePath}/accounts/tariffs`}><span><strong>Configure tariffs</strong><small>Price consultations, tests, medicines and procedures</small></span><b>→</b></Link></section>
        </div>
      </>}

      {activeTab === 'cashier' && <div className="accounts-pos-layout">
        <section className="accounts-panel accounts-patient-picker"><PanelHeading title="Patient bill queue" subtitle="Search patients with an outstanding balance" /><label className="accounts-field"><span>Search patient</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, MRN or phone" /></label><div className="accounts-patient-results">{patientMatches.slice(0, 30).map((patient) => { const count = pendingCharges.filter((charge) => charge.patientId === patient.id).length; return <button type="button" key={patient.id} className={selectedPatientId === patient.id ? 'is-selected' : ''} onClick={() => selectPatient(patient.id)}><span className="accounts-avatar">{patient.full_name?.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</span><span><strong>{patient.full_name}</strong><small>{patient.patient_number || patient.mrn || 'MRN not recorded'} · {count} open line{count === 1 ? '' : 's'}</small></span><b>→</b></button>; })}{!patientMatches.length && <p className="accounts-empty">No matching patients found.</p>}</div></section>
        <section className="accounts-panel accounts-settlement-panel"><PanelHeading title="Settlement" subtitle={chosenPatient ? `${chosenPatient.full_name} · ${chosenPatient.patient_number || chosenPatient.mrn || 'MRN not recorded'}` : 'Choose a patient to load their bill'} />
          {!chosenPatient ? <div className="accounts-empty accounts-large-empty">Select a patient from the queue to review billable facts.</div> : <>
            <div className="accounts-bill-table-wrap"><table className="staff-table accounts-bill-table"><thead><tr><th>Service</th><th>Qty</th><th>Gross</th><th>Insurer</th><th>Patient due</th></tr></thead><tbody>{ledger.charges.filter((charge) => charge.patientId === selectedPatientId && !['Settled', 'Claimed', 'Waived'].includes(charge.status)).map((charge) => <tr key={charge.id}><td><label className="accounts-charge-label"><input type="checkbox" checked={selectedCharges.includes(charge.id)} onChange={(event) => setSelectedCharges((current) => event.target.checked ? [...current, charge.id] : current.filter((id) => id !== charge.id))} /><span><strong>{charge.description}</strong><small>{charge.category} · {charge.status}</small></span></label></td><td>{charge.quantity}</td><td>{formatGHS(charge.chargeAmount)}</td><td>{formatGHS(charge.insurerAmount)}</td><td>{formatGHS(patientBalance(charge, ledger.payments))}</td></tr>)}</tbody></table></div>
            <div className="accounts-total-strip"><div><small>Gross bill</small><strong>{formatGHS(gross)}</strong></div><div><small>Insurance coverage</small><strong>{formatGHS(covered)}</strong></div><div><small>Patient payable</small><strong>{formatGHS(due)}</strong></div><div><small>Balance due</small><strong>{formatGHS(due)}</strong></div></div>
            <form className="accounts-payment-form" onSubmit={submitPayment}><h3>Payment details</h3><div className="accounts-methods" role="group" aria-label="Payment method">{['Cash', 'Mobile Money', 'Bank Card'].map((item) => <button key={item} type="button" className={method === item ? 'is-active' : ''} onClick={() => setMethod(item)}>{item}</button>)}</div>
              {method === 'Cash' && <><label className="accounts-field"><span>Amount tendered (GH₵)</span><input type="number" min={due} step="0.01" value={cashTendered} onChange={(event) => setCashTendered(event.target.value)} required /></label><div className="accounts-denominations">{[10, 20, 50, 100, 200].map((amount) => <button key={amount} type="button" onClick={() => setCashTendered(String(amount))}>GH₵ {amount}</button>)}</div><p className="accounts-change-line">Change due <strong>{formatGHS(Math.max(0, Number(cashTendered || 0) - due))}</strong></p></>}
              {method === 'Mobile Money' && <><label className="accounts-field"><span>Network</span><select value={network} onChange={(event) => setNetwork(event.target.value)}><option>MTN MoMo</option><option>Telecel Cash</option><option>AT Money</option></select></label><label className="accounts-field"><span>Transaction reference</span><input value={momoRef} onChange={(event) => setMomoRef(event.target.value)} required /></label></>}
              <label className="accounts-field"><span>Amount to collect (GH₵)</span><input type="number" min="0.01" max={due} step="0.01" required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label><p className="accounts-payment-note">Outstanding selected balance: <strong>{formatGHS(due)}</strong>. Partial payments are supported. Insurance coverage is excluded from cashier settlement.</p><button className="staff-primary-button accounts-confirm-payment" type="submit" disabled={!chosenCharges.length || due <= 0 || !(Number(paymentAmount) > 0) || Number(paymentAmount) > due}>Confirm payment and print receipt</button>
            </form>
          </>}
        </section>
      </div>}

      {activeTab === 'receipts' && <section className="accounts-panel"><PanelHeading title="Receipts and transactions" subtitle="Search recorded payments and reprint receipts" /><label className="accounts-field accounts-transaction-search"><span>Search transaction journal</span><input value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} placeholder="Receipt number, cashier or MoMo reference" /></label><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Receipt</th><th>Date</th><th>Cashier</th><th>Method</th><th>Amount</th><th /></tr></thead><tbody>{visibleTransactions.map((payment) => <tr key={payment.id}><td><strong>{payment.receiptNumber}</strong></td><td>{new Date(payment.createdAt).toLocaleString('en-GB')}</td><td>{payment.cashierName}</td><td>{payment.paymentMethod}{payment.network ? ` · ${payment.network}` : ''}</td><td>{formatGHS(payment.amountPaid)}</td><td><button className="staff-secondary-button" type="button" onClick={() => setReceipt({ payment, charges: ledger.charges, patient: patients.find((p) => p.id === payment.patientId) })}>Reprint</button></td></tr>)}</tbody></table>{!visibleTransactions.length && <p className="accounts-empty">No transactions recorded yet.</p>}</div></section>}

      {activeTab === 'reconciliation' && <div className="accounts-two-column"><section className="accounts-panel"><PanelHeading title="Shift reconciliation" subtitle="Reconcile payment methods against physical counts" /><form className="accounts-reconciliation-form" onSubmit={closeShift}><label className="accounts-field"><span>Opening cash float (GH₵)</span><input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} required /></label><div className="accounts-expected-row"><span>Expected cash in drawer</span><strong>{formatGHS(Number(openingFloat || 0) + expectedCash)}</strong></div><label className="accounts-field"><span>Physical cash count (GH₵)</span><input type="number" min="0" step="0.01" value={cashCount} onChange={(event) => setCashCount(event.target.value)} required /></label><p className={Math.abs(variance) < 0.01 ? 'accounts-variance is-balanced' : 'accounts-variance'}>{Math.abs(variance) < 0.01 ? 'Balanced' : variance < 0 ? 'Short' : 'Over'} <strong>{formatGHS(variance)}</strong></p><p className={Math.abs(Number(momoCount || 0) - expectedMomo) < 0.01 ? 'accounts-variance is-balanced' : 'accounts-variance'}>Mobile Money variance <strong>{formatGHS(Number(momoCount || 0) - expectedMomo)}</strong></p><div className="accounts-expected-row"><span>Expected Mobile Money</span><strong>{formatGHS(expectedMomo)}</strong></div><label className="accounts-field"><span>Counted Mobile Money (GH₵)</span><input type="number" min="0" step="0.01" value={momoCount} onChange={(event) => setMomoCount(event.target.value)} /></label><div className="accounts-expected-row"><span>Expected card payments</span><strong>{formatGHS(expectedCard)}</strong></div><label className="accounts-field"><span>Counted card payments (GH₵)</span><input type="number" min="0" step="0.01" value={cardCount} onChange={(event) => setCardCount(event.target.value)} /></label><p className={Math.abs(Number(cardCount || 0) - expectedCard) < 0.01 ? 'accounts-variance is-balanced' : 'accounts-variance'}>Bank card variance <strong>{formatGHS(Number(cardCount || 0) - expectedCard)}</strong></p><label className="accounts-field"><span>Variance explanation</span><textarea rows="3" value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} placeholder="Required when totals do not match" /></label><button className="staff-primary-button" type="submit">Close and reconcile shift</button></form></section><section className="accounts-panel"><PanelHeading title="Recent reconciliations" subtitle="Saved shift close records" />{reconciliations.slice(0, 12).map((item) => <div className="accounts-collection-row" key={item.id}><span><strong>{item.cashierName}</strong><small>{item.date} · Cash variance {formatGHS(item.cashVariance)}</small></span><strong>{formatGHS(item.expectedCash)}</strong></div>)}{!reconciliations.length && <p className="accounts-empty">No shifts have been reconciled.</p>}</section></div>}

      {activeTab === 'tariffs' && <div className="accounts-two-column">
        <section className="accounts-panel">
          <header className="accounts-panel-heading accounts-tariff-heading"><div><h2>Local service tariffs</h2><p>Prices are stored in this browser only. Use the exact lab or medicine code to enable automatic billing.</p></div><div className="accounts-inline-actions"><button className="staff-secondary-button" type="button" onClick={() => { setProcedureError(''); setProcedureDialogOpen(true); }}>Record completed procedure</button><button className="staff-primary-button" type="button" onClick={() => openTariffEditor()}>Add tariff</button></div></header>
          <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Service</th><th>Category</th><th>Source code</th><th>Cash</th><th>NHIS</th><th /></tr></thead><tbody>{billingCatalog.services.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.category}</td><td><code>{item.sourceCode}</code></td><td>{formatGHS(item.cashPrice)}</td><td>{formatGHS(item.nhisPrice || 0)}</td><td><div className="accounts-inline-actions"><button className="staff-secondary-button" type="button" onClick={() => openTariffEditor(item)}>Edit</button><button className="staff-secondary-button" type="button" onClick={() => removeTariff(item.id)}>Remove</button></div></td></tr>)}</tbody></table>{!billingCatalog.services.length && <p className="accounts-empty">No tariffs configured. Add a tariff with the exact source code used by the clinical catalog, for example LAB-001 or PH-004.</p>}</div>
        </section>
        <section className="accounts-panel"><PanelHeading title="Fulfilled services awaiting a price" subtitle="Completed services are recorded here when no matching tariff exists." />{ledger.unpricedServices.map((service) => <article className="accounts-unpriced-row" key={service.id}><div><strong>{service.description}</strong><small>{service.patientName} · {service.category} · {service.sourceCode || 'No source code'} · {new Date(service.createdAt).toLocaleString('en-GB')}</small></div><button className="staff-primary-button" type="button" onClick={() => resolveUnpricedService(service)}>Apply tariff</button></article>)}{!ledger.unpricedServices.length && <p className="accounts-empty">No fulfilled services are waiting for a tariff.</p>}</section>
      </div>}

      {activeTab === 'analytics' && <><div className="accounts-metric-grid"><Metric label="Gross charge value" value={formatGHS(grossValue)} hint="Charges created today" /><Metric label="Insurance allocation" value={formatGHS(insuranceValue)} hint="Insurer portion only" /><Metric label="Patient portion" value={formatGHS(netPatientDue)} hint="Before payments" /><Metric label="Payments recorded" value={formatGHS(cashCollected + momoCollected + cardCollected)} hint="Cash, Mobile Money and card" /></div><section className="accounts-panel"><PanelHeading title="Revenue by department" subtitle="Based on recorded charge facts, not pending orders" />{['Consultation', 'Laboratory', 'Pharmacy', 'Procedure'].map((category) => { const amount = moneySum(chargesToday.filter((charge) => charge.category === category), 'chargeAmount'); const max = Math.max(1, grossValue); return <div className="accounts-chart-row" key={category}><span>{category}</span><div><i style={{ width: `${Math.min(100, amount / max * 100)}%` }} /></div><strong>{formatGHS(amount)}</strong></div>; })}</section></>}

      {procedureDialogOpen && <div className="billing-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProcedureDialogOpen(false); }}><section className="accounts-charge-dialog" role="dialog" aria-modal="true" aria-labelledby="procedure-dialog-title"><header className="accounts-panel-heading"><div><h2 id="procedure-dialog-title">Record completed procedure</h2><p>This records a fulfilled procedure and creates a charge using the selected local tariff.</p></div><button className="staff-secondary-button" type="button" onClick={() => setProcedureDialogOpen(false)}>Close</button></header>{procedureError && <p className="auth-notice auth-notice-error" role="alert">{procedureError}</p>}<form className="accounts-charge-form" onSubmit={submitProcedure}><label className="accounts-field"><span>Patient</span><select required value={procedureForm.patientId} onChange={(event) => setProcedureForm((current) => ({ ...current, patientId: event.target.value }))}><option value="">Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name} · {patient.patient_number || patient.mrn || 'MRN not recorded'}</option>)}</select></label><label className="accounts-field"><span>Procedure tariff</span><select required value={procedureForm.tariffId} onChange={(event) => setProcedureForm((current) => ({ ...current, tariffId: event.target.value }))}><option value="">Select procedure</option>{billingCatalog.services.filter((item) => item.category === 'Procedure').map((item) => <option key={item.id} value={item.id}>{item.name} · {formatGHS(item.cashPrice)}</option>)}</select></label><div className="accounts-charge-form-grid"><label className="accounts-field"><span>Quantity</span><input type="number" min="1" step="1" required value={procedureForm.quantity} onChange={(event) => setProcedureForm((current) => ({ ...current, quantity: event.target.value }))} /></label><label className="accounts-field"><span>Procedure / encounter reference</span><input required maxLength="120" value={procedureForm.sourceRefId} onChange={(event) => setProcedureForm((current) => ({ ...current, sourceRefId: event.target.value }))} placeholder="Procedure record ID" /></label></div><label className="accounts-field"><span>Completion note (optional)</span><textarea rows="2" maxLength="500" value={procedureForm.notes} onChange={(event) => setProcedureForm((current) => ({ ...current, notes: event.target.value }))} /></label><button className="staff-primary-button" type="submit" disabled={!billingCatalog.services.some((item) => item.category === 'Procedure')}>Record procedure and charge</button></form></section></div>}
      {tariffDialogOpen && <div className="billing-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTariffDialogOpen(false); }}><section className="accounts-charge-dialog" role="dialog" aria-modal="true" aria-labelledby="tariff-dialog-title"><header className="accounts-panel-heading"><div><h2 id="tariff-dialog-title">{editingTariffId ? 'Edit tariff' : 'Add service tariff'}</h2><p>Saved locally on this browser. No database migration is used for billing.</p></div><button className="staff-secondary-button" type="button" onClick={() => setTariffDialogOpen(false)}>Close</button></header>{tariffError && <p className="auth-notice auth-notice-error" role="alert">{tariffError}</p>}<form className="accounts-charge-form" onSubmit={submitTariff}><label className="accounts-field"><span>Category</span><select value={tariffForm.category} onChange={(event) => setTariffForm((current) => ({ ...current, category: event.target.value }))}>{['Consultation', 'Laboratory', 'Pharmacy', 'Procedure'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="accounts-field"><span>Source code</span><input required maxLength="80" value={tariffForm.sourceCode} onChange={(event) => setTariffForm((current) => ({ ...current, sourceCode: event.target.value }))} placeholder="LAB-001, PH-004, CONSULTATION, PROC-001" /></label><label className="accounts-field"><span>Service name</span><input required maxLength="160" value={tariffForm.name} onChange={(event) => setTariffForm((current) => ({ ...current, name: event.target.value }))} /></label><div className="accounts-charge-form-grid"><label className="accounts-field"><span>Cash price per unit (GH₵)</span><input required type="number" min="0" step="0.01" value={tariffForm.cashPrice} onChange={(event) => setTariffForm((current) => ({ ...current, cashPrice: event.target.value }))} /></label><label className="accounts-field"><span>NHIS tariff per unit (GH₵)</span><input type="number" min="0" step="0.01" value={tariffForm.nhisPrice} onChange={(event) => setTariffForm((current) => ({ ...current, nhisPrice: event.target.value }))} /></label></div><p className="accounts-payment-note">Automatic billing only runs when a matching local tariff exists. Without one, the fulfilled service is queued here until priced.</p><button className="staff-primary-button" type="submit">{editingTariffId ? 'Save changes' : 'Save tariff'}</button></form></section></div>}
      {chargeDialogOpen && <div className="billing-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setChargeDialogOpen(false); }}><section className="accounts-charge-dialog" role="dialog" aria-modal="true" aria-labelledby="charge-dialog-title"><header className="accounts-panel-heading"><div><h2 id="charge-dialog-title">Record fulfilled service</h2><p>Use a completed consultation, completed lab, dispensed medicine or confirmed procedure reference.</p></div><button className="staff-secondary-button" type="button" onClick={() => setChargeDialogOpen(false)}>Close</button></header><form onSubmit={submitFulfilledCharge} className="accounts-charge-form"><label className="accounts-field"><span>Patient</span><select required value={chargeForm.patientId} onChange={(event) => setChargeForm((current) => ({ ...current, patientId: event.target.value }))}><option value="">Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name} · {patient.patient_number || patient.mrn || 'MRN not recorded'}</option>)}</select></label><label className="accounts-field"><span>Charge category</span><select value={chargeForm.category} onChange={(event) => setChargeForm((current) => ({ ...current, category: event.target.value }))}>{['Consultation', 'Laboratory', 'Pharmacy', 'Procedure'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="accounts-field"><span>Service description</span><input required value={chargeForm.description} onChange={(event) => setChargeForm((current) => ({ ...current, description: event.target.value }))} /></label><div className="accounts-charge-form-grid"><label className="accounts-field"><span>Quantity</span><input required type="number" min="1" step="1" value={chargeForm.quantity} onChange={(event) => setChargeForm((current) => ({ ...current, quantity: event.target.value }))} /></label><label className="accounts-field"><span>Cash unit price (GH₵)</span><input required type="number" min="0" step="0.01" value={chargeForm.unitPrice} onChange={(event) => setChargeForm((current) => ({ ...current, unitPrice: event.target.value }))} /></label><label className="accounts-field"><span>NHIS tariff per unit (GH₵)</span><input type="number" min="0" step="0.01" value={chargeForm.nhisPrice} onChange={(event) => setChargeForm((current) => ({ ...current, nhisPrice: event.target.value }))} /></label><label className="accounts-field"><span>Source status</span><select value={chargeForm.sourceStatus} onChange={(event) => setChargeForm((current) => ({ ...current, sourceStatus: event.target.value }))}><option>Completed</option><option>Dispensed</option><option>Confirmed</option><option>Pending</option></select></label></div><label className="accounts-field"><span>Completed source record ID</span><input required value={chargeForm.sourceRefId} onChange={(event) => setChargeForm((current) => ({ ...current, sourceRefId: event.target.value }))} placeholder="Lab order, dispensation, procedure or visit ID" /></label><p className="accounts-payment-note">The ledger blocks pending sources. Keep the source ID from the original clinical record to prevent duplicate billing.</p><button className="staff-primary-button" type="submit">Add charge to ledger</button></form></section></div>}
      {receipt && <ThermalReceipt payment={receipt.payment} charges={receipt.charges} patient={receipt.patient} hospital={hospital} onClose={() => setReceipt(null)} />}
    </section>
  );
}

function Metric({ label, value, hint }) { return <article className="accounts-metric"><small>{label}</small><strong>{value}</strong><span>{hint}</span></article>; }
function PanelHeading({ title, subtitle }) { return <header className="accounts-panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></header>; }
